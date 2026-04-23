const mongoose = require('mongoose');
const Credit = require('../models/Credit');
const FinancialTransaction = require('../models/FinancialTransaction');
const BankAccount = require('../models/BankAccount');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('transaction numbers are only allowed') || message.includes('replica set');
};

const getDirectionForPartyType = (partyType) => (partyType === 'customer' ? 'receivable' : 'payable');

const computeStatus = (dueAmount, paidAmount) => {
  if (dueAmount <= 0) return 'settled';
  if (paidAmount <= 0) return 'open';
  return 'partial';
};

const getSourceType = (referenceType) => (referenceType === 'sale' || referenceType === 'purchase' ? referenceType : 'manual');

const validateReference = async ({ referenceType, referenceId, partyType, direction, amountNum }) => {
  if (!referenceType || referenceType === 'manual') {
    return null;
  }

  if (!referenceId) {
    throw new Error('referenceId is required when referenceType is sale or purchase');
  }

  if (referenceType === 'sale') {
    if (partyType !== 'customer' || direction !== 'receivable') {
      throw new Error('Sale credit must be customer receivable');
    }
    const sale = await Sale.findById(referenceId).select('_id total_amount');
    if (!sale) throw new Error('Referenced sale not found');
    if (Number(amountNum) > Number(sale.total_amount || 0)) {
      throw new Error('Credit amount cannot exceed referenced sale total');
    }
    return sale;
  }

  if (referenceType === 'purchase') {
    if (partyType !== 'supplier' || direction !== 'payable') {
      throw new Error('Purchase credit must be supplier payable');
    }
    const purchase = await Purchase.findById(referenceId).select('_id total_amount');
    if (!purchase) throw new Error('Referenced purchase not found');
    if (Number(amountNum) > Number(purchase.total_amount || 0)) {
      throw new Error('Credit amount cannot exceed referenced purchase total');
    }
    return purchase;
  }

  throw new Error('Invalid referenceType');
};

exports.createCredit = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const {
      partyType,
      partyName,
      direction,
      referenceType,
      referenceId,
      amount,
      paidAmount = 0,
      paymentBankAccount,
      dueDate,
      note,
    } = req.body;

    const amountNum = Number(amount);
    const paidNum = Number(paidAmount || 0);

    if (!partyType || !partyName || !direction || !amountNum || amountNum <= 0) {
      return res.status(400).json({ error: 'partyType, partyName, direction and amount > 0 are required' });
    }

    if (getDirectionForPartyType(partyType) !== direction) {
      return res.status(400).json({ error: 'Direction must match party type (customer=receivable, supplier=payable)' });
    }

    if (paidNum < 0 || paidNum > amountNum) {
      return res.status(400).json({ error: 'paidAmount must be between 0 and amount' });
    }

    if (paidNum > 0 && !paymentBankAccount) {
      return res.status(400).json({ error: 'paymentBankAccount is required when paidAmount is greater than zero' });
    }

    const normalizedReferenceType = referenceType || 'manual';
    await validateReference({
      referenceType: normalizedReferenceType,
      referenceId,
      partyType,
      direction,
      amountNum,
    });

    const dueAmount = Number((amountNum - paidNum).toFixed(2));

    let createdCredit = null;
    const executeCreateFlow = async (txnSession) => {
      const createOptions = txnSession ? { session: txnSession } : {};

      let bankAccount = null;
      if (paidNum > 0) {
        bankAccount = txnSession
          ? await BankAccount.findById(paymentBankAccount).session(txnSession)
          : await BankAccount.findById(paymentBankAccount);
        if (!bankAccount) throw new Error('Selected payment bank account not found');
        if (bankAccount.status !== 'active') throw new Error('Selected payment bank account is inactive');

        if (direction === 'payable' && Number(bankAccount.balance || 0) < paidNum) {
          throw new Error(
            `Insufficient bank account balance. Required: ${paidNum.toFixed(2)}, Available: ${Number(bankAccount.balance || 0).toFixed(2)}`
          );
        }
      }

      const creditRows = await Credit.create(
        [{
          partyType,
          partyName,
          direction,
          referenceType: normalizedReferenceType,
          referenceId: referenceId || null,
          amount: amountNum,
          paidAmount: paidNum,
          dueAmount,
          dueDate: dueDate || null,
          note: note || '',
          status: computeStatus(dueAmount, paidNum),
          createdBy: req.user?._id,
        }],
        createOptions
      );

      createdCredit = creditRows[0];

      if (paidNum > 0 && bankAccount) {
        const sourceType = getSourceType(normalizedReferenceType);
        await FinancialTransaction.create(
          [{
            type: direction === 'receivable' ? 'in' : 'out',
            sourceType,
            sourceId: referenceId || createdCredit._id,
            amount: paidNum,
            bankAccount: bankAccount._id,
            description:
              direction === 'receivable'
                ? `Credit payment received from ${partyName}`
                : `Credit payment made to ${partyName}`,
            createdBy: req.user?._id,
          }],
          createOptions
        );

        const balanceDelta = direction === 'receivable' ? paidNum : -paidNum;
        if (txnSession) {
          await BankAccount.findByIdAndUpdate(
            bankAccount._id,
            { $inc: { balance: balanceDelta } },
            { session: txnSession }
          );
        } else {
          await BankAccount.findByIdAndUpdate(bankAccount._id, { $inc: { balance: balanceDelta } });
        }
      }
    };

    try {
      await session.withTransaction(async () => {
        await executeCreateFlow(session);
      });
    } catch (transactionError) {
      if (!isTransactionUnsupportedError(transactionError)) throw transactionError;
      await executeCreateFlow(null);
    }

    const populatedCredit = await Credit.findById(createdCredit._id).populate('createdBy', 'firstName lastName email');
    res.status(201).json({ data: populatedCredit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

exports.getCredits = async (req, res) => {
  try {
    const { status, partyType, direction } = req.query;
    const query = {};

    if (status) query.status = status;
    if (partyType) query.partyType = partyType;
    if (direction) query.direction = direction;

    const credits = await Credit.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ data: credits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCredit = async (req, res) => {
  try {
    const credit = await Credit.findById(req.params.id).populate('createdBy', 'firstName lastName email');
    if (!credit) return res.status(404).json({ error: 'Credit record not found' });
    res.json({ data: credit });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.recordCreditPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { amount, bankAccount } = req.body;
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      return res.status(400).json({ error: 'Positive payment amount is required' });
    }
    if (!bankAccount) {
      return res.status(400).json({ error: 'bankAccount is required for credit payment' });
    }

    let updatedCredit = null;

    const executePaymentFlow = async (txnSession) => {
      const saveOptions = txnSession ? { session: txnSession } : {};

      const credit = txnSession
        ? await Credit.findById(req.params.id).session(txnSession)
        : await Credit.findById(req.params.id);

      if (!credit) throw new Error('Credit record not found');
      if (credit.status === 'cancelled' || credit.status === 'settled') {
        throw new Error(`Cannot add payment to ${credit.status} credit`);
      }

      const account = txnSession
        ? await BankAccount.findById(bankAccount).session(txnSession)
        : await BankAccount.findById(bankAccount);
      if (!account) throw new Error('Selected payment bank account not found');
      if (account.status !== 'active') throw new Error('Selected payment bank account is inactive');

      const nextPaid = Number((Number(credit.paidAmount || 0) + amountNum).toFixed(2));
      if (nextPaid > Number(credit.amount)) {
        throw new Error('Payment exceeds credit amount');
      }

      if (credit.direction === 'payable' && Number(account.balance || 0) < amountNum) {
        throw new Error(
          `Insufficient bank account balance. Required: ${amountNum.toFixed(2)}, Available: ${Number(account.balance || 0).toFixed(2)}`
        );
      }

      credit.paidAmount = nextPaid;
      credit.dueAmount = Number((Number(credit.amount) - nextPaid).toFixed(2));
      credit.status = computeStatus(credit.dueAmount, nextPaid);
      await credit.save(saveOptions);

      await FinancialTransaction.create(
        [{
          type: credit.direction === 'receivable' ? 'in' : 'out',
          sourceType: getSourceType(credit.referenceType),
          sourceId: credit.referenceId || credit._id,
          amount: amountNum,
          bankAccount: account._id,
          description:
            credit.direction === 'receivable'
              ? `Credit payment received from ${credit.partyName}`
              : `Credit payment made to ${credit.partyName}`,
          createdBy: req.user?._id,
        }],
        txnSession ? { session: txnSession } : {}
      );

      const balanceDelta = credit.direction === 'receivable' ? amountNum : -amountNum;
      if (txnSession) {
        await BankAccount.findByIdAndUpdate(
          account._id,
          { $inc: { balance: balanceDelta } },
          { session: txnSession }
        );
      } else {
        await BankAccount.findByIdAndUpdate(account._id, { $inc: { balance: balanceDelta } });
      }

      updatedCredit = credit;
    };

    try {
      await session.withTransaction(async () => {
        await executePaymentFlow(session);
      });
    } catch (transactionError) {
      if (!isTransactionUnsupportedError(transactionError)) throw transactionError;
      await executePaymentFlow(null);
    }

    const populatedCredit = await Credit.findById(updatedCredit._id).populate('createdBy', 'firstName lastName email');
    res.json({ data: populatedCredit });
  } catch (error) {
    if (error.message === 'Credit record not found') {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message.includes('Cannot add payment') ||
      error.message.includes('Payment exceeds credit amount') ||
      error.message.includes('Insufficient bank account balance') ||
      error.message.includes('bank account')
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  } finally {
    session.endSession();
  }
};

exports.updateCredit = async (req, res) => {
  try {
    const credit = await Credit.findById(req.params.id);
    if (!credit) return res.status(404).json({ error: 'Credit record not found' });

    if (typeof req.body.status !== 'undefined') {
      if (req.body.status !== 'cancelled') {
        return res.status(400).json({ error: 'Only status transition allowed is to cancelled' });
      }
      if (Number(credit.paidAmount || 0) > 0) {
        return res.status(400).json({ error: 'Cannot cancel a credit that already has payments' });
      }
      credit.status = 'cancelled';
    }

    ['partyName', 'dueDate', 'note'].forEach((key) => {
      if (typeof req.body[key] !== 'undefined') credit[key] = req.body[key];
    });

    await credit.save();
    res.json({ data: credit });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteCredit = async (req, res) => {
  try {
    const credit = await Credit.findById(req.params.id);
    if (!credit) return res.status(404).json({ error: 'Credit record not found' });

    if (credit.status !== 'settled') {
      return res.status(400).json({ error: 'Credit can only be deleted after it is fully paid' });
    }

    await Credit.findByIdAndDelete(req.params.id);
    res.json({ message: 'Credit deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
