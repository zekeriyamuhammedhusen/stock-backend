const mongoose = require('mongoose');

const creditSchema = new mongoose.Schema(
  {
    partyType: { type: String, enum: ['customer', 'supplier'], required: true },
    partyName: { type: String, required: true, trim: true },
    direction: { type: String, enum: ['receivable', 'payable'], required: true },
    referenceType: { type: String, enum: ['sale', 'purchase', 'manual'], default: 'manual' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    amount: { type: Number, required: true, min: 0.0001 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, default: null },
    note: { type: String, default: '' },
    status: { type: String, enum: ['open', 'partial', 'settled', 'cancelled'], default: 'open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Credit || mongoose.model('Credit', creditSchema);
