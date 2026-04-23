const BankAccount = require('../models/BankAccount');

exports.createBankAccount = async (req, res) => {
  try {
    const { name, bankName, accountNumber, currency, balance, description, status } = req.body;

    if (!name || !bankName || !accountNumber) {
      return res.status(400).json({ error: 'name, bankName and accountNumber are required' });
    }

    const exists = await BankAccount.findOne({ accountNumber });
    if (exists) return res.status(400).json({ error: 'Account number already exists' });

    const account = await BankAccount.create({
      name,
      bankName,
      accountNumber,
      currency: currency || 'ETB',
      balance: Number(balance || 0),
      description: description || '',
      status: status || 'inactive',
      createdBy: req.user?._id,
    });

    res.status(201).json({ data: account });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBankAccounts = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const accounts = await BankAccount.find(query)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ data: accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findById(req.params.id).populate('createdBy', 'firstName lastName email');
    if (!account) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data: account });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!account) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data: account });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ message: 'Bank account deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.activateBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    if (!account) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data: account });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deactivateBankAccount = async (req, res) => {
  try {
    const account = await BankAccount.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true }
    );
    if (!account) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ data: account });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
