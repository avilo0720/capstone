const xlsx = require('xlsx');
const path = require('path');
const db = require('./db');

// Sleep utility to help with timestamp uniqueness spacing
const sleep = ms => new Promise(res => setTimeout(res, ms));

async function seed() {
    await db.initDB();
    console.log("Reading A.xlsx...");
    
    const wb = xlsx.readFile(path.join(__dirname, 'A.xlsx'));
    const sheetName = Object.keys(wb.Sheets)[0];
    const sheetData = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

    // Find the header row
    let headerRowIndex = -1;
    for (let i = 0; i < 10; i++) {
        if (sheetData[i] && sheetData[i].includes('Item Description')) {
            headerRowIndex = i;
            break;
        }
    }
    
    if (headerRowIndex === -1) {
        console.error("Could not find 'Item Description' header in A.xlsx.");
        process.exit(1);
    }
    
    const headers = sheetData[headerRowIndex];
    const rows = sheetData.slice(headerRowIndex + 1);

    const noIdx = headers.indexOf('No');
    const descIdx = headers.indexOf('Item Description');
    const sizeIdx = headers.indexOf('Size');
    const stockIdx = headers.indexOf('Current Stock');
    const amcIdx = headers.indexOf('Average Monthly Consumption (AMC)');
    const priceIdx = headers.indexOf('Material / Unit Cost');
    const fsnIdx = headers.indexOf('FSN Classification');

    const categoriesSet = new Set();
    const categoriesMap = {};

    console.log(`Found ${rows.length} rows to process from Excel.`);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[descIdx]) continue; // skip empty rows

        const itemCode = row[noIdx] ? `ITEM-${row[noIdx]}` : '';
        const title = row[descIdx] ? row[descIdx].trim() : '';
        const size = row[sizeIdx] ? row[sizeIdx].toString().trim() : '';

        const quantity = parseFloat(row[stockIdx]) || 0;
        const demand = parseFloat(row[amcIdx]) || 0;
        const price = parseFloat(row[priceIdx]) || 0;
        let fsn = row[fsnIdx] || 'General';

        let fsnTitle = 'General';
        if (fsn === 'F') fsnTitle = 'Fast Moving';
        else if (fsn === 'S') fsnTitle = 'Slow Moving';
        else if (fsn === 'N') fsnTitle = 'Non-moving';
        else fsnTitle = fsn;

        // Add category if not exists
        if (!categoriesSet.has(fsnTitle)) {
            const catId = Date.now() + i;
            categoriesSet.add(fsnTitle);
            categoriesMap[fsnTitle] = catId;
            
            await db.query(`INSERT IGNORE INTO categories (id, title, description, updated) VALUES (?, ?, ?, ?)`, 
                [catId, fsnTitle, `Category generated for ${fsn}`, new Date()]
            );
            console.log(`Added category: ${fsnTitle}`);
            await sleep(2); // slight pause to ensure unique IDs
        }

        const categoryId = categoriesMap[fsnTitle];
        const productId = Date.now() + i; // unique simulated ID

        await db.query(`INSERT IGNORE INTO items (id, itemCode, title, size, category, quantity, price, monthlyDemand, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [productId, itemCode, title, size, categoryId, quantity, price, demand, new Date()]
        );
        await sleep(2);
    }
    
    console.log("Database seeded successfully!");
    process.exit(0);
}

seed().catch(err => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
