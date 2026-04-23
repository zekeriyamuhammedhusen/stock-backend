    const mongoose = require('mongoose');

    const unitSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },   // e.g., Kilogram
    abbreviation: { type: String, required: true, unique: true }, // e.g., kg
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
    }, { timestamps: true });

    module.exports = mongoose.models.Unit || mongoose.model('Unit', unitSchema);
