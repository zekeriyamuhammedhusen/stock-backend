    const mongoose = require('mongoose');

    const warehouseSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
    }, { timestamps: true });

    module.exports = mongoose.models.Warehouse || mongoose.model('Warehouse', warehouseSchema);
