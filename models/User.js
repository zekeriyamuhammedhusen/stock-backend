    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');

    const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    middleName: { type: String },
    lastName: { type: String, required: true },
    phoneNumber: { type: String, required: true, unique: true },
    address: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    }, { timestamps: true });

    userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
    };

    module.exports = mongoose.models.User || mongoose.model('User', userSchema);