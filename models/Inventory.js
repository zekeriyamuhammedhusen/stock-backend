const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

inventorySchema.index({ product: 1, warehouse: 1 }, { unique: true });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
