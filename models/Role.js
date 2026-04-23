    const mongoose = require('mongoose');

    const roleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, default: '', trim: true },
    permissions: [{ type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    }, { timestamps: true });

    module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);