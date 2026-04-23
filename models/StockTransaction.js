const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['in', 'out', 'transfer_in', 'transfer_out', 'sale_out', 'purchase_in'],
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.0001 },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    transfer: { type: mongoose.Schema.Types.ObjectId, ref: 'Transfer' },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.StockTransaction ||
  mongoose.model('StockTransaction', stockTransactionSchema);
