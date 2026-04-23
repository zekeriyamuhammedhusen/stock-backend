const mongoose = require('mongoose');

// Check if model is already compiled to prevent OverwriteModelError
const Permission = mongoose.models.Permission || mongoose.model('Permission', new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
}, { timestamps: true }));

module.exports = Permission;