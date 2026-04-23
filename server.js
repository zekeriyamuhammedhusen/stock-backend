    require('dotenv').config();

    const express = require('express');
    const mongoose = require('mongoose');
    const cors = require('cors');
    const authRoutes = require('./routes/authRoutes');
    const userRoutes = require('./routes/userRoutes');
    const roleRoutes = require('./routes/roleRoutes');
    const permissionRoutes = require('./routes/permissions');
    const warehouseRoutes = require('./routes/warehouseRoutes');
    const categoryRoutes = require('./routes/categoryRoutes');
    const unitRoutes = require('./routes/unitRoutes');
    const productRoutes = require('./routes/productRoutes');
    const stockRoutes = require('./routes/stockRoutes');
    const transferRoutes = require('./routes/transferRoutes');
    const saleRoutes = require('./routes/saleRoutes');
    const purchaseRoutes = require('./routes/purchaseRoutes');
    const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
    const reportRoutes = require('./routes/reportRoutes');
    const approvalRoutes = require('./routes/approvalRoutes');
    const bankAccountRoutes = require('./routes/bankAccountRoutes');
    const creditRoutes = require('./routes/creditRoutes');

    const app = express();

    const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:5173',
    ].filter(Boolean);

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
        },
    }));
    app.use(express.json());

    mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/your_db')
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/roles', roleRoutes);
    app.use('/api/permissions', permissionRoutes);
    app.use('/api/warehouses', warehouseRoutes);
    app.use('/api/categories', categoryRoutes);
    app.use('/api/units', unitRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/stock', stockRoutes);
    app.use('/api/transfers', transferRoutes);
    app.use('/api/sales', saleRoutes);
    app.use('/api/purchases', purchaseRoutes);
    app.use('/api/purchase-orders', purchaseOrderRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/approvals', approvalRoutes);
    app.use('/api/bank-accounts', bankAccountRoutes);
    app.use('/api/credits', creditRoutes);


    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));