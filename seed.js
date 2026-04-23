    require('dotenv').config();
    const mongoose = require('mongoose');
    const bcrypt = require('bcryptjs');
    const User = require('./models/User');
    const Role = require('./models/Role');
    const Permission = require('./models/Permission');

    const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI;
        const adminSeedPassword = process.env.SEED_ADMIN_PASSWORD;
        const adminSeedEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
        if (!mongoUri) {
        throw new Error('MONGO_URI is not defined in .env file');
        }
        if (!adminSeedPassword) {
        throw new Error('SEED_ADMIN_PASSWORD is required in .env file');
        }
        await mongoose.connect(mongoUri);
        console.log('MongoDB connected');

        // Clear existing data
        await User.deleteMany({});
        await Role.deleteMany({});
        await Permission.deleteMany({});
        console.log('Existing users, roles, and permissions cleared');

        // Create permissions
        const permissions = [
        { name: 'view_category', description: 'Allows viewing categories' },
        { name: 'create_category', description: 'Allows creating categories' },
        { name: 'update_category', description: 'Allows updating categories' },
        { name: 'delete_category', description: 'Allows deleting categories' },
        { name: 'activate_category', description: 'Allows activating categories' },
        { name: 'deactivate_category', description: 'Allows deactivating categories' },
        { name: 'view_unit', description: 'Allows viewing units' },
        { name: 'create_unit', description: 'Allows creating units' },
        { name: 'update_unit', description: 'Allows updating units' },
        { name: 'delete_unit', description: 'Allows deleting units' },
        { name: 'activate_unit', description: 'Allows activating units' },
        { name: 'deactivate_unit', description: 'Allows deactivating units' },
        { name: 'view_warehouse', description: 'Allows viewing warehouses' },
        { name: 'create_warehouse', description: 'Allows creating warehouses' },
        { name: 'update_warehouse', description: 'Allows updating warehouses' },
        { name: 'delete_warehouse', description: 'Allows deleting warehouses' },
        { name: 'activate_warehouse', description: 'Allows activating warehouses' },
        { name: 'deactivate_warehouse', description: 'Allows deactivating warehouses' },
        { name: 'view_product', description: 'Allows viewing products' },
        { name: 'create_product', description: 'Allows creating products' },
        { name: 'update_product', description: 'Allows updating products' },
        { name: 'delete_product', description: 'Allows deleting products' },
        { name: 'activate_product', description: 'Allows activating products' },
        { name: 'deactivate_product', description: 'Allows deactivating products' },
        { name: 'view_purchase', description: 'Allows viewing purchases' },
        { name: 'create_purchase', description: 'Allows creating purchases' },
        { name: 'view_sale', description: 'Allows viewing sales' },
        { name: 'create_sale', description: 'Allows creating sales' },
        { name: 'view_sale_summary', description: 'Allows viewing sale summaries' },
        { name: 'view_inventory', description: 'Allows viewing inventory' },
        { name: 'view_stock_transactions', description: 'Allows viewing stock transactions' },
        { name: 'create_stock_in', description: 'Allows recording stock in' },
        { name: 'create_stock_out', description: 'Allows recording stock out' },
        { name: 'view_transfer', description: 'Allows viewing transfers' },
        { name: 'create_transfer', description: 'Allows creating transfers' },
        { name: 'update_transfer_status', description: 'Allows updating transfer status' },
        { name: 'view_low_stock_report', description: 'Allows viewing low stock reports' },
        { name: 'view_profit_loss_report', description: 'Allows viewing profit and loss reports' },
        { name: 'view_dashboard_metrics', description: 'Allows viewing dashboard metrics' },
        { name: 'view_sales_report', description: 'Allows viewing detailed sales report' },
        { name: 'view_supplier_performance_report', description: 'Allows viewing supplier performance report' },
        { name: 'view_purchase_order', description: 'Allows viewing purchase orders' },
        { name: 'create_purchase_order', description: 'Allows creating purchase orders' },
        { name: 'update_purchase_order_status', description: 'Allows updating purchase order status' },
        { name: 'view_bank_account', description: 'Allows viewing bank accounts' },
        { name: 'create_bank_account', description: 'Allows creating bank accounts' },
        { name: 'update_bank_account', description: 'Allows updating bank accounts' },
        { name: 'delete_bank_account', description: 'Allows deleting bank accounts' },
        { name: 'activate_bank_account', description: 'Allows activating bank accounts' },
        { name: 'deactivate_bank_account', description: 'Allows deactivating bank accounts' },
        { name: 'view_credit', description: 'Allows viewing credit records' },
        { name: 'create_credit', description: 'Allows creating credit records' },
        { name: 'update_credit', description: 'Allows updating credit records' },
        { name: 'delete_credit', description: 'Allows deleting credit records' },
        ];
        const createdPermissions = await Permission.insertMany(permissions);
        console.log('Permissions created:', createdPermissions.map(p => p.name));

        const permissionByName = new Map(createdPermissions.map((permission) => [permission.name, permission._id]));
        const pickPermissions = (names) => names.map((name) => permissionByName.get(name)).filter(Boolean);

        // Create roles
        const adminRole = await Role.create({
        name: 'Admin',
        permissions: createdPermissions.map(p => p._id), // Assign all permissions
        });
        const staffRole = await Role.create({
        name: 'Staff',
        permissions: pickPermissions([
            'view_category',
            'view_unit',
            'view_warehouse',
            'view_product',
            'view_purchase',
            'view_sale',
            'create_sale',
            'view_inventory',
            'view_stock_transactions',
            'view_transfer',
            'view_bank_account',
            'view_credit',
            'view_dashboard_metrics',
        ]),
        });
        const managerRole = await Role.create({
        name: 'Manager',
        permissions: pickPermissions([
            'view_category',
            'create_category',
            'update_category',
            'view_unit',
            'create_unit',
            'update_unit',
            'view_warehouse',
            'create_warehouse',
            'update_warehouse',
            'view_product',
            'create_product',
            'update_product',
            'view_purchase',
            'create_purchase',
            'view_sale',
            'create_sale',
            'view_sale_summary',
            'view_inventory',
            'view_stock_transactions',
            'create_stock_in',
            'create_stock_out',
            'view_transfer',
            'create_transfer',
            'update_transfer_status',
            'view_low_stock_report',
            'view_profit_loss_report',
            'view_dashboard_metrics',
            'view_sales_report',
            'view_supplier_performance_report',
            'view_purchase_order',
            'create_purchase_order',
            'update_purchase_order_status',
            'view_bank_account',
            'create_bank_account',
            'update_bank_account',
            'view_credit',
            'create_credit',
            'update_credit',
        ]),
        });
        console.log('Roles created:', adminRole.name, staffRole.name, managerRole.name);

        // Create admin user
        const hashedPassword = await bcrypt.hash(adminSeedPassword, 10);
        const adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: adminSeedEmail,
        password: hashedPassword,
        address: '123 Admin Street, City',
        phoneNumber: '123-456-7890',
        roles: [adminRole._id],
        status: 'active',
        });
        console.log('Admin user created:', adminUser.email);

        console.log('Database seeded successfully');
    } catch (error) {
        console.error('Seeding error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
    };

    seedDatabase();