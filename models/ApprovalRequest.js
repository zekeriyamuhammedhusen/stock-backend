const mongoose = require('mongoose');

const approvalRequestSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: [
        'create_product',
        'create_purchase',
        'create_sale',
        'create_transfer',
        'create_stock_in',
        'create_stock_out',
      ],
      required: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },
    executedEntityType: { type: String, default: null },
    executedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ApprovalRequest || mongoose.model('ApprovalRequest', approvalRequestSchema);
