const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
};

let pool;

const DEFAULT_USERS = [
    { username: 'branch_manager', fullName: 'Branch Manager', role: 'Branch Manager', password: 'password123' },
    { username: 'dept_manager', fullName: 'Department Manager', role: 'Department Manager', password: 'password123' },
    { username: 'inventory_clerk', fullName: 'Inventory Clerk', role: 'Inventory Clerk', password: 'password123' },
    { username: 'warehouse_staff', fullName: 'Warehouse Staff', role: 'Warehouse Staff', password: 'password123' },
];

async function initDB() {
    // Connect without database to create it if it doesn't exist
    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'inventory_db';
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.query(`USE \`${dbName}\`;`);
    
    // Create Categories Table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id BIGINT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            updated DATETIME
        );
    `);

    // Drop old products table if it exists
    await connection.query(`DROP TABLE IF EXISTS products;`);

    // Create Items Table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS items (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            itemCode VARCHAR(255),
            title VARCHAR(255) NOT NULL,
            size VARCHAR(255),
            category VARCHAR(255),
            quantity INT DEFAULT 0,
            price DECIMAL(10, 2) DEFAULT 0.00,
            monthlyDemand INT DEFAULT 0,
            updated DATETIME
        );
    `);

    // Ensure existing items table uses auto-increment IDs.
    await connection.query(`
        ALTER TABLE items
        MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT;
    `);

    // Create Transactions Table (stock movement log)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS transactions (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            itemId BIGINT NOT NULL,
            action ENUM('add', 'use') NOT NULL,
            quantity INT NOT NULL DEFAULT 0,
            transactionDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_transaction_date (transactionDate),
            INDEX idx_item (itemId)
        );
    `);

    // Create Users Table
    await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            fullName VARCHAR(255) NOT NULL,
            role VARCHAR(100) NOT NULL,
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
    `);

    // Seed default users if table is empty
    const [userRows] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (userRows[0].count === 0) {
        for (const user of DEFAULT_USERS) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await connection.query(
                'INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)',
                [user.username, hashedPassword, user.fullName, user.role]
            );
        }
        console.log('Default users seeded successfully.');
    }
    
    await connection.end();

    // Now create a pool that connects properly to the DB
    pool = mysql.createPool({
        ...dbConfig,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    
    console.log(`Connected to MySQL Database: ${dbName}`);
}

module.exports = {
    initDB,
    query: async (sql, params) => {
        if (!pool) throw new Error("Database not initialized");
        const [results] = await pool.execute(sql, params);
        return results;
    }
};
