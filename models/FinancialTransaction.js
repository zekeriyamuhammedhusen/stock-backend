const mongoose = require('mongoose');

const financialTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['in', 'out'], required: true },
    sourceType: {
      type: String,
      enum: ['sale', 'purchase', 'manual', 'bank_adjustment'],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    amount: { type: Number, required: true, min: 0.0001 },
    bankAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', default: null },
    description: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.FinancialTransaction ||
  mongoose.model('FinancialTransaction', financialTransactionSchema);
