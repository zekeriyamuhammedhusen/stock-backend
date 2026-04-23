const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, unique: true, trim: true },
    currency: { type: String, default: 'ETB', trim: true },
    balance: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.BankAccount || mongoose.model('BankAccount', bankAccountSchema);
