    const mongoose = require('mongoose');

    const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true }, // unique identifier
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
    }, { timestamps: true });

    module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);
