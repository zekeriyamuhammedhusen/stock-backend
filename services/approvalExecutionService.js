const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Unit = require('../models/Unit');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const StockTransaction = require('../models/StockTransaction');
const User = require('../models/User');
const FinancialTransaction = require('../models/FinancialTransaction');
const BankAccount = require('../models/BankAccount');

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('transaction numbers are only allowed') || message.includes('replica set');
};

const getActorDisplayName = async (userId) => {
  if (!userId) return 'Unknown User';
  const user = await User.findById(userId).select('firstName lastName email');
  if (!user) return 'Unknown User';
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email || 'Unknown User';
};

async function createProductFromPayload(payload, createdBy) {
  const {
    name,
    description,
    category,
    unit,
    quantity,
    costPrice,
    sellingPrice,
    reorderLevel,
    status,
    warehouse,
  } = payload;

  if (!name || !category || !unit || typeof quantity === 'undefined' || typeof costPrice === 'undefined') {
    throw new Error('name, category, unit, quantity, and costPrice are required');
  }

  const quantityNum = Number(quantity);
  const costPriceNum = Number(costPrice);
  if (Number.isNaN(quantityNum) || quantityNum < 0) {
    throw new Error('quantity must be a non-negative number');
  }
  if (Number.isNaN(costPriceNum) || costPriceNum < 0) {
    throw new Error('costPrice must be a non-negative number');
  }

  const [categoryExists, unitExists] = await Promise.all([
    Category.findById(category),
    Unit.findById(unit),
  ]);

  if (!categoryExists) throw new Error('Category not found');
  if (!unitExists) throw new Error('Unit not found');

  const product = await Product.create({
    name,
    description,
    category,
    unit,
    quantity: quantityNum,
    costPrice: costPriceNum,
    sellingPrice,
    reorderLevel,
    status: status || 'inactive',
    createdBy,
  });

  // Seed initial stock into selected warehouse (or fallback) so new products can be sold.
  if (quantityNum > 0) {
    let targetWarehouse = null;

    if (warehouse) {
      targetWarehouse = await Warehouse.findById(warehouse).select('_id status');
      if (!targetWarehouse) {
        throw new Error('Selected warehouse not found');
      }
      if (targetWarehouse.status === 'inactive') {
        throw new Error('Selected warehouse is inactive');
      }
    } else {
      targetWarehouse = await Warehouse.findOne({ status: 'active' }).sort({ createdAt: 1 }).select('_id');
    }

    if (targetWarehouse?._id) {
      await Inventory.findOneAndUpdate(
        { product: product._id, warehouse: targetWarehouse._id },
        { $inc: { quantity: quantityNum } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  return Product.findById(product._id)
    .populate('category', 'name code')
    .populate('unit', 'name abbreviation')
    .populate('createdBy', 'firstName lastName email');
}

async function createPurchaseFromPayload(payload, createdBy) {
  const session = await mongoose.startSession();
  try {
    const { date, items_list, supplier: requestedSupplier, bankAccount: bankAccountId } = payload;
    const defaultSupplier = await getActorDisplayName(createdBy);
    const supplier = String(requestedSupplier || '').trim() || defaultSupplier;

    if (!Array.isArray(items_list) || items_list.length === 0) {
      throw new Error('non-empty items_list is required');
    }

    let totalAmount = 0;
    const groupedByProduct = new Map();

    for (const item of items_list) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);

      if (!item.product || !item.warehouse || !qty || qty <= 0 || unitCost < 0) {
        throw new Error('Each item requires product, warehouse, quantity, unitCost');
      }

      const [product, warehouse] = await Promise.all([
        Product.findById(item.product).session(session),
        Warehouse.findById(item.warehouse).session(session),
      ]);

      if (!product) throw new Error('Product not found in one or more items');
      if (!warehouse) throw new Error('Warehouse not found in one or more items');
      if (product.status === 'inactive') throw new Error('One or more products are inactive');
      if (warehouse.status === 'inactive') throw new Error('One or more warehouses are inactive');

      item.lineTotal = Number((qty * unitCost).toFixed(2));
      totalAmount += item.lineTotal;

      const productKey = String(item.product);
      groupedByProduct.set(productKey, (groupedByProduct.get(productKey) || 0) + qty);
    }

    let purchase;
    const executePurchaseFlow = async (txnSession) => {
      const createOptions = txnSession ? { session: txnSession } : {};

      const paymentAmount = Number(totalAmount.toFixed(2));
      
      let bankAccount = null;
      if (bankAccountId) {
        bankAccount = txnSession
          ? await BankAccount.findById(bankAccountId).session(txnSession)
          : await BankAccount.findById(bankAccountId);
        if (!bankAccount) throw new Error('Selected bank account not found');
        if (bankAccount.status !== 'active') throw new Error('Selected bank account is inactive');
        if (String(bankAccount.createdBy) !== String(createdBy)) {
          throw new Error('Bank account does not belong to the logged-in user');
        }
      } else {
        // Auto-find logged-in buyer's primary bank account (must belong to current user)
        bankAccount = txnSession
          ? await BankAccount.findOne({ createdBy, status: 'active' }).sort({ createdAt: 1 }).session(txnSession)
          : await BankAccount.findOne({ createdBy, status: 'active' }).sort({ createdAt: 1 });
        if (!bankAccount) throw new Error('No active bank account found for logged-in user. Please create a bank account first.');
      }

      if (Number(bankAccount.balance || 0) < paymentAmount) {
        throw new Error(
          `Insufficient bank account balance. Required: ${paymentAmount.toFixed(2)}, Available: ${Number(bankAccount.balance || 0).toFixed(2)}`
        );
      }

      purchase = await Purchase.create(
        [{
          supplier,
          date: date || new Date(),
          items_list,
          total_amount: Number(totalAmount.toFixed(2)),
          createdBy,
        }],
        createOptions
      );

      for (const item of items_list) {
        const qty = Number(item.quantity);
        const updateOptions = txnSession
          ? { upsert: true, new: true, setDefaultsOnInsert: true, session: txnSession }
          : { upsert: true, new: true, setDefaultsOnInsert: true };

        await Inventory.findOneAndUpdate(
          { product: item.product, warehouse: item.warehouse },
          { $inc: { quantity: qty } },
          updateOptions
        );

        await StockTransaction.create(
          [{
            type: 'purchase_in',
            quantity: qty,
            product: item.product,
            warehouse: item.warehouse,
            note: `Purchase from supplier ${supplier}`,
            createdBy,
          }],
          createOptions
        );
      }

      for (const [productId, qty] of groupedByProduct.entries()) {
        if (txnSession) {
          await Product.findByIdAndUpdate(productId, { $inc: { quantity: qty } }, { session: txnSession });
        } else {
          await Product.findByIdAndUpdate(productId, { $inc: { quantity: qty } });
        }
      }

      await FinancialTransaction.create(
        [{
          type: 'out',
          sourceType: 'purchase',
          sourceId: purchase[0]._id,
          amount: paymentAmount,
          bankAccount: bankAccount._id,
          description: `Purchase payment for supplier ${supplier}`,
          createdBy,
        }],
        createOptions
      );

      if (txnSession) {
        await BankAccount.findByIdAndUpdate(
          bankAccount._id,
          { $inc: { balance: -paymentAmount } },
          { session: txnSession }
        );
      } else {
        await BankAccount.findByIdAndUpdate(bankAccount._id, {
          $inc: { balance: -paymentAmount },
        });
      }
    };

    try {
      await session.withTransaction(async () => {
        await executePurchaseFlow(session);
      });
    } catch (transactionError) {
      if (!isTransactionUnsupportedError(transactionError)) throw transactionError;
      await executePurchaseFlow(null);
    }

    const createdPurchase = purchase?.[0];
    return Purchase.findById(createdPurchase._id)
      .populate('items_list.product', 'name')
      .populate('items_list.warehouse', 'name')
      .populate('createdBy', 'firstName lastName email');
  } finally {
    session.endSession();
  }
}

async function createSaleFromPayload(payload, createdBy) {
  const session = await mongoose.startSession();
  try {
    const { date, items_list, customer: requestedCustomer, bankAccount: bankAccountId } = payload;
    const defaultCustomer = await getActorDisplayName(createdBy);
    const customer = String(requestedCustomer || '').trim() || defaultCustomer;

    if (!Array.isArray(items_list) || items_list.length === 0) {
      throw new Error('non-empty items_list is required');
    }

    let totalAmount = 0;
    const groupedWarehouseDeductions = new Map();
    const groupedProductDeductions = new Map();

    for (const item of items_list) {
      const qty = Number(item.quantity);

      if (!item.product || !item.warehouse || !qty || qty <= 0) {
        throw new Error('Each item requires product, warehouse, and quantity greater than zero');
      }

      const [product, warehouse] = await Promise.all([
        Product.findById(item.product).session(session),
        Warehouse.findById(item.warehouse).session(session),
      ]);

      if (!product) throw new Error('Product not found in one or more items');
      if (!warehouse) throw new Error('Warehouse not found in one or more items');
      if (product.status === 'inactive') throw new Error('One or more products are inactive');
      if (warehouse.status === 'inactive') throw new Error('One or more warehouses are inactive');

      const unitPrice = Number(product.sellingPrice || 0);
      if (!unitPrice || unitPrice <= 0) {
        throw new Error(`Selling price must be greater than zero for product ${product.name}`);
      }

      let inventory = await Inventory.findOne({ product: item.product, warehouse: item.warehouse }).session(session);

      // Backfill legacy inventory for products created before warehouse-level inventory enforcement.
      if (!inventory) {
        const inventoryRows = await Inventory.find({ product: item.product }).select('quantity').session(session);
        const totalInventoryQty = inventoryRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

        if (totalInventoryQty <= 0 && Number(product.quantity || 0) > 0) {
          inventory = await Inventory.findOneAndUpdate(
            { product: item.product, warehouse: item.warehouse },
            { $setOnInsert: { quantity: Number(product.quantity || 0) } },
            { upsert: true, new: true, setDefaultsOnInsert: true, session }
          );
        }
      }

      const invKey = `${String(item.product)}:${String(item.warehouse)}`;
      const nextGroupedInvQty = (groupedWarehouseDeductions.get(invKey) || 0) + qty;
      groupedWarehouseDeductions.set(invKey, nextGroupedInvQty);
      if (!inventory || inventory.quantity < nextGroupedInvQty) {
        throw new Error('Insufficient stock for one or more sale items');
      }

      const productKey = String(item.product);
      const nextGroupedProductQty = (groupedProductDeductions.get(productKey) || 0) + qty;
      groupedProductDeductions.set(productKey, nextGroupedProductQty);
      if (product.quantity < nextGroupedProductQty) {
        throw new Error('Insufficient total product stock for one or more sale items');
      }

      item.unitPrice = unitPrice;
      item.lineTotal = Number((qty * unitPrice).toFixed(2));
      totalAmount += item.lineTotal;
    }

    let sale;
    const executeSaleFlow = async (txnSession) => {
      const createOptions = txnSession ? { session: txnSession } : {};

      let bankAccount = null;
      if (bankAccountId) {
        bankAccount = txnSession
          ? await BankAccount.findById(bankAccountId).session(txnSession)
          : await BankAccount.findById(bankAccountId);
        if (!bankAccount) throw new Error('Selected bank account not found');
        if (bankAccount.status !== 'active') throw new Error('Selected bank account is inactive');
        if (String(bankAccount.createdBy) !== String(createdBy)) {
          throw new Error('Bank account does not belong to the logged-in user');
        }
      } else {
        // Auto-find logged-in seller's primary bank account (must belong to current user)
        bankAccount = txnSession
          ? await BankAccount.findOne({ createdBy, status: 'active' }).sort({ createdAt: 1 }).session(txnSession)
          : await BankAccount.findOne({ createdBy, status: 'active' }).sort({ createdAt: 1 });
        if (!bankAccount) throw new Error('No active bank account found for logged-in user. Please create a bank account first.');
      }

      sale = await Sale.create(
        [{
          customer,
          date: date || new Date(),
          items_list,
          total_amount: Number(totalAmount.toFixed(2)),
          createdBy,
        }],
        createOptions
      );

      for (const [key, qty] of groupedWarehouseDeductions.entries()) {
        const [productId, warehouseId] = key.split(':');
        const inventoryUpdate = await Inventory.updateOne(
          { product: productId, warehouse: warehouseId, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          txnSession ? { session: txnSession } : {}
        );
        if (!inventoryUpdate.modifiedCount) throw new Error('Insufficient stock while processing sale');
      }

      for (const [productId, qty] of groupedProductDeductions.entries()) {
        const productUpdate = await Product.updateOne(
          { _id: productId, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          txnSession ? { session: txnSession } : {}
        );
        if (!productUpdate.modifiedCount) throw new Error('Insufficient total product stock while processing sale');
      }

      for (const item of items_list) {
        const qty = Number(item.quantity);
        await StockTransaction.create(
          [{
            type: 'sale_out',
            quantity: qty,
            product: item.product,
            warehouse: item.warehouse,
            sale: sale[0]._id,
            note: `Sale for customer ${customer}`,
            createdBy,
          }],
          createOptions
        );
      }

      await FinancialTransaction.create(
        [{
          type: 'in',
          sourceType: 'sale',
          sourceId: sale[0]._id,
          amount: Number(totalAmount.toFixed(2)),
          bankAccount: bankAccount?._id || null,
          description: `Sale payment from customer ${customer}`,
          createdBy,
        }],
        createOptions
      );

      if (bankAccount) {
        if (txnSession) {
          await BankAccount.findByIdAndUpdate(
            bankAccount._id,
            { $inc: { balance: Number(totalAmount.toFixed(2)) } },
            { session: txnSession }
          );
        } else {
          await BankAccount.findByIdAndUpdate(bankAccount._id, {
            $inc: { balance: Number(totalAmount.toFixed(2)) },
          });
        }
      }
    };

    try {
      await session.withTransaction(async () => {
        await executeSaleFlow(session);
      });
    } catch (transactionError) {
      if (!isTransactionUnsupportedError(transactionError)) throw transactionError;
      await executeSaleFlow(null);
    }

    const createdSale = sale?.[0];
    return Sale.findById(createdSale._id)
      .populate('items_list.product', 'name')
      .populate('items_list.warehouse', 'name')
      .populate('createdBy', 'firstName lastName email');
  } finally {
    session.endSession();
  }
}

async function createTransferFromPayload(payload, createdBy) {
  const { productId, sourceWarehouseId, destinationWarehouseId, quantity, note } = payload;
  const qty = Number(quantity);

  if (!productId || !sourceWarehouseId || !destinationWarehouseId || !qty || qty <= 0) {
    throw new Error('productId, sourceWarehouseId, destinationWarehouseId and positive quantity are required');
  }

  if (sourceWarehouseId === destinationWarehouseId) {
    throw new Error('Source and destination warehouses must differ');
  }

  const [product, sourceWh, destinationWh] = await Promise.all([
    Product.findById(productId),
    Warehouse.findById(sourceWarehouseId),
    Warehouse.findById(destinationWarehouseId),
  ]);

  if (!product) throw new Error('Product not found');
  if (!sourceWh || !destinationWh) throw new Error('Warehouse not found');
  if (product.status === 'inactive') throw new Error('Product is inactive');
  if (sourceWh.status === 'inactive' || destinationWh.status === 'inactive') {
    throw new Error('Source or destination warehouse is inactive');
  }

  const sourceInventory = await Inventory.findOne({ product: productId, warehouse: sourceWarehouseId });
  if (!sourceInventory || Number(sourceInventory.quantity || 0) < qty) {
    throw new Error('Selected source warehouse does not have enough stock for this product');
  }

  const transfer = await require('../models/Transfer').create({
    product: productId,
    sourceWarehouse: sourceWarehouseId,
    destinationWarehouse: destinationWarehouseId,
    quantity: qty,
    status: 'pending',
    note: note || '',
    createdBy,
  });

  return require('../models/Transfer').findById(transfer._id)
    .populate('product', 'name')
    .populate('sourceWarehouse', 'name')
    .populate('destinationWarehouse', 'name')
    .populate('createdBy', 'firstName lastName email');
}

async function createStockInFromPayload(payload, createdBy) {
  const { productId, warehouseId, quantity, note } = payload;
  const qty = Number(quantity);

  if (!productId || !warehouseId || !qty || qty <= 0) {
    throw new Error('productId, warehouseId and positive quantity are required');
  }

  const [product, warehouse] = await Promise.all([
    Product.findById(productId),
    Warehouse.findById(warehouseId),
  ]);

  if (!product) throw new Error('Product not found');
  if (!warehouse) throw new Error('Warehouse not found');
  if (product.status === 'inactive') throw new Error('Product is inactive. Activate it before stock operations.');
  if (warehouse.status === 'inactive') throw new Error('Warehouse is inactive. Activate it before stock operations.');

  const inventory = await Inventory.findOneAndUpdate(
    { product: productId, warehouse: warehouseId },
    { $inc: { quantity: qty } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Product.findByIdAndUpdate(productId, { $inc: { quantity: qty } });

  await StockTransaction.create({
    type: 'in',
    quantity: qty,
    product: productId,
    warehouse: warehouseId,
    note: note || '',
    createdBy,
  });

  return Inventory.findById(inventory._id)
    .populate('product', 'name')
    .populate('warehouse', 'name address');
}

async function createStockOutFromPayload(payload, createdBy) {
  const { productId, warehouseId, quantity, note } = payload;
  const qty = Number(quantity);

  if (!productId || !warehouseId || !qty || qty <= 0) {
    throw new Error('productId, warehouseId and positive quantity are required');
  }

  const [product, warehouse] = await Promise.all([
    Product.findById(productId),
    Warehouse.findById(warehouseId),
  ]);

  if (!product) throw new Error('Product not found');
  if (!warehouse) throw new Error('Warehouse not found');
  if (product.status === 'inactive') throw new Error('Product is inactive. Activate it before stock operations.');
  if (warehouse.status === 'inactive') throw new Error('Warehouse is inactive. Activate it before stock operations.');

  const inventory = await Inventory.findOne({ product: productId, warehouse: warehouseId });
  if (!inventory || inventory.quantity < qty) {
    throw new Error('Insufficient stock for stock-out operation');
  }

  const latestProduct = await Product.findById(productId);
  if (!latestProduct || latestProduct.quantity < qty) {
    throw new Error('Insufficient product stock for stock-out operation');
  }

  inventory.quantity -= qty;
  await inventory.save();

  await Product.findByIdAndUpdate(productId, { $inc: { quantity: -qty } });

  await StockTransaction.create({
    type: 'out',
    quantity: qty,
    product: productId,
    warehouse: warehouseId,
    note: note || '',
    createdBy,
  });

  return Inventory.findById(inventory._id)
    .populate('product', 'name')
    .populate('warehouse', 'name address');
}

module.exports = {
  createProductFromPayload,
  createPurchaseFromPayload,
  createSaleFromPayload,
  createTransferFromPayload,
  createStockInFromPayload,
  createStockOutFromPayload,
};
