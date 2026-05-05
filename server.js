const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration — 15 minute timeout
const SESSION_MAX_AGE = 15 * 60 * 1000; // 15 minutes in ms
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: SESSION_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax'
    },
    rolling: true // Reset expiry on every request (activity-based timeout)
}));

// Serve static files with no cache so JS changes take effect immediately
const staticOptions = {
    setHeaders: function (res, path, stat) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
};
app.use('/src', express.static(path.join(__dirname, 'public/src'), staticOptions));
app.use('/assets', express.static(path.join(__dirname, 'public/assets'), staticOptions));

// ======================= ROLE PERMISSIONS =======================
const ROLE_PERMISSIONS = {
    'Branch Manager':      { pages: ['dashboard', 'inventory', 'forecast', 'reports'], canEdit: true },
    'Department Manager':  { pages: ['dashboard', 'inventory', 'forecast', 'reports'], canEdit: true },
    'Inventory Clerk':     { pages: ['dashboard', 'inventory', 'forecast'],            canEdit: true },
    'Warehouse Staff':     { pages: ['dashboard', 'inventory'],                        canEdit: false },
};

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    // For API calls, return 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect('/login');
}

function requirePage(pageName) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
            return res.redirect('/login');
        }
        const role = req.session.user.role;
        const perms = ROLE_PERMISSIONS[role];
        if (!perms || !perms.pages.includes(pageName)) {
            if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Forbidden' });
            return res.status(403).render('forbidden', { title: 'Access Denied', user: req.session.user });
        }
        next();
    };
}

// Make user data available to all EJS templates
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    res.locals.rolePermissions = ROLE_PERMISSIONS;
    next();
});

// ======================= AUTH ROUTES =======================

// Login page (no auth required)
app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { title: 'Login', error: null });
});

// Login API
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (!users || users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const user = users[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        // Create session
        req.session.user = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role
        };
        req.session.loginTime = Date.now();
        res.json({
            success: true,
            user: req.session.user,
            sessionMaxAge: SESSION_MAX_AGE
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Logout API
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Failed to logout' });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// Session status API (for client-side timeout tracking)
app.get('/api/auth/session', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ authenticated: false });
    }
    res.json({
        authenticated: true,
        user: req.session.user,
        sessionMaxAge: SESSION_MAX_AGE
    });
});

// ======================= PAGE ROUTES (Protected) =======================

// Home route (Dashboard)
app.get('/', requireAuth, (req, res) => {
    res.render('index', { title: 'Dashboard' });
});

// Inventory route
app.get('/inventory', requirePage('inventory'), (req, res) => {
    res.render('inventory', { title: 'Inventory' });
});

// Forecast route
app.get('/forecast', requirePage('forecast'), (req, res) => {
    res.render('forecast', { title: 'Forecasting' });
});

// Reports route
app.get('/reports', requirePage('reports'), (req, res) => {
    res.render('reports', { title: 'Reports' });
});

// ======================= API ROUTES (Protected) =======================
app.get('/api/items', requireAuth, async (req, res) => {
    try {
        const rows = await db.query(`
            SELECT * FROM items
            ORDER BY CAST(REGEXP_SUBSTR(COALESCE(itemCode, '0'), '[0-9]+') AS UNSIGNED) ASC, id ASC
        `);
        res.json(rows);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

app.post('/api/items', requireAuth, async (req, res) => {
    // Check if user has edit permission
    if (!req.session.user || !ROLE_PERMISSIONS[req.session.user.role]?.canEdit) {
        return res.status(403).json({ error: 'You do not have permission to modify items' });
    }
    const { id, itemCode, title, size, category, quantity, price, monthlyDemand } = req.body;
    try {
        const normalizedId = Number(id) || 0;

        if (normalizedId > 0) {
            const currentRows = await db.query('SELECT itemCode FROM items WHERE id = ?', [normalizedId]);
            const currentItemCode = currentRows[0]?.itemCode || null;
            await db.query(
                `UPDATE items
                 SET itemCode=?, title=?, size=?, category=?, quantity=?, price=?, monthlyDemand=?, updated=?
                 WHERE id=?`,
                [itemCode || currentItemCode, title, size, category, quantity, price, monthlyDemand, new Date(), normalizedId]
            );
            return res.json({ success: true, id: normalizedId, itemCode: itemCode || currentItemCode });
        }

        const itemCodes = await db.query('SELECT itemCode FROM items');
        let maxItemCode = 0;
        itemCodes.forEach((row) => {
            const rawCode = String(row.itemCode || '').trim();
            const match = rawCode.match(/(\d+)/);
            if (!match) return;
            const codeNum = Number(match[1]);
            if (!Number.isNaN(codeNum) && codeNum > maxItemCode) {
                maxItemCode = codeNum;
            }
        });
        const nextItemCode = String(maxItemCode + 1);

        const result = await db.query(
            `INSERT INTO items (itemCode, title, size, category, quantity, price, monthlyDemand, updated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [nextItemCode, title, size, category, quantity, price, monthlyDemand, new Date()]
        );
        res.json({ success: true, id: result.insertId, itemCode: nextItemCode });
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

app.delete('/api/items/:id', requireAuth, async (req, res) => {
    if (!req.session.user || !ROLE_PERMISSIONS[req.session.user.role]?.canEdit) {
        return res.status(403).json({ error: 'You do not have permission to delete items' });
    }
    try {
        await db.query('DELETE FROM items WHERE id = ?', [req.params.id]);
        res.json({success: true});
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/categories', requireAuth, async (req, res) => {
    try {
        const rows = await db.query('SELECT * FROM categories ORDER BY updated DESC');
        res.json(rows);
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

app.post('/api/categories', requireAuth, async (req, res) => {
    const { id, title, description } = req.body;
    try {
        await db.query(`INSERT INTO categories (id, title, description, updated) VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE title=?, description=?, updated=?`,
            [id, title, description, new Date(), title, description, new Date()]);
        res.json({success: true});
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
    try {
        await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({success: true});
    } catch (e) {
        res.status(500).json({error: e.message});
    }
});

// ======================= REPORTS API =======================

app.get('/api/reports/summary', requireAuth, async (req, res) => {
    try {
        const items = await db.query(`
            SELECT * FROM items
            ORDER BY CAST(REGEXP_SUBSTR(COALESCE(itemCode, '0'), '[0-9]+') AS UNSIGNED) ASC, id ASC
        `);

        const totalItems = items.length;
        const totalQuantity = items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);
        const totalValue = items.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
        const totalDemand = items.reduce((acc, item) => acc + (Number(item.monthlyDemand) || 0), 0);

        let cumulativeDemand = 0;
        let lowStockItems = [];

        items.forEach((item) => {
            const amc = Number(item.monthlyDemand) || 0;
            const stock = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;

            cumulativeDemand += amc;
            const cumulativePercent = totalDemand === 0 ? 0 : cumulativeDemand / totalDemand;
            const fsn = cumulativePercent <= 0.2 ? 'N' : (cumulativePercent < 0.7 ? 'S' : 'F');

            const leadTimeDemand = amc * 3.495065789473684;
            const ltd = roundHalfDown(leadTimeDemand);
            const safetyStock = (amc + leadTimeDemand) * 0.1;
            const ss = roundHalfDown(safetyStock);
            const rop = ltd + ss;
            const msl = fsn === 'N' && stock < 3 ? 3 : (amc + leadTimeDemand + safetyStock);

            const triggerPoint =
                ((rop > stock && (fsn === 'F' || fsn === 'S')) || (fsn === 'N' && stock < 3))
                    ? 'RS Needed' : 'Sufficient';

            if (triggerPoint === 'RS Needed') {
                const roundedMsl = Math.round(msl);
                const deficit = roundedMsl - stock;
                const urgency = stock === 0 ? 'critical' : (stock <= Math.ceil(roundedMsl * 0.25) ? 'high' : 'medium');
                lowStockItems.push({
                    id: item.id,
                    itemCode: item.itemCode,
                    title: item.title,
                    size: item.size,
                    currentStock: stock,
                    reorderPoint: rop,
                    minimumStockLevel: roundedMsl,
                    deficit,
                    unitCost: price,
                    restockCost: deficit * price,
                    fsn,
                    urgency,
                    triggerPoint
                });
            }
        });

        res.json({
            totalItems,
            totalQuantity,
            totalValue: Number(totalValue.toFixed(2)),
            lowStockCount: lowStockItems.length,
            lowStockItems
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function roundHalfDown(value) {
    const sign = value < 0 ? -1 : 1;
    const absVal = Math.abs(value);
    const floor = Math.floor(absVal);
    const fraction = absVal - floor;
    if (fraction > 0.5) return sign * (floor + 1);
    return sign * floor;
}

// ======================= EXPORT ROUTES =======================

app.post('/api/export/inventory/excel', requireAuth, (req, res) => {
    try {
        const { headers = [], rows = [] } = req.body || {};
        const aoa = [headers, ...rows];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory.xlsx"');
        res.send(buffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/export/inventory/pdf', requireAuth, (req, res) => {
    try {
        const { headers = [], rows = [] } = req.body || {};
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

        const fontCandidates = [
            'C:/Windows/Fonts/segoeui.ttf',
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/calibri.ttf',
        ];
        const unicodeFont = fontCandidates.find((fontPath) => fs.existsSync(fontPath));
        if (unicodeFont) {
            doc.font(unicodeFont);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory.pdf"');
        doc.pipe(res);

        doc.fontSize(14).text('Inventory Export', { align: 'left' });
        doc.moveDown(0.5);

        const tableRows = [headers, ...rows];
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const colCount = Math.max(headers.length, 1);
        const colWidth = pageWidth / colCount;
        let y = doc.y;
        const cellPadding = 4;
        const maxRowHeight = 120;

        tableRows.forEach((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const fontSize = isHeader ? 8 : 7;
            doc.fontSize(fontSize);

            // Calculate dynamic row height from wrapped text.
            let rowHeight = 0;
            row.forEach((cell) => {
                const cellText = String(cell ?? '');
                const measured = doc.heightOfString(cellText, {
                    width: colWidth - cellPadding * 2,
                    align: 'left',
                });
                rowHeight = Math.max(rowHeight, measured + cellPadding * 2);
            });
            rowHeight = Math.max(20, Math.min(maxRowHeight, rowHeight));

            if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
                y = doc.y;
            }

            row.forEach((cell, colIndex) => {
                const x = doc.page.margins.left + colIndex * colWidth;
                doc
                    .rect(x, y, colWidth, rowHeight)
                    .fillAndStroke(isHeader ? '#EEF2F6' : '#FFFFFF', '#D0D5DD');
                doc
                    .fillColor('#101828')
                    .fontSize(fontSize)
                    .text(String(cell ?? ''), x + cellPadding, y + cellPadding, {
                        width: colWidth - cellPadding * 2,
                        height: rowHeight - cellPadding * 2,
                        lineBreak: true,
                    });
            });
            y += rowHeight;
        });

        doc.end();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/export/report/pdf', requireAuth, async (req, res) => {
    try {
        const { summary, lowStockItems } = req.body || {};
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        const fontCandidates = [
            'C:/Windows/Fonts/segoeui.ttf',
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/calibri.ttf',
        ];
        const unicodeFont = fontCandidates.find((fp) => fs.existsSync(fp));
        if (unicodeFont) doc.font(unicodeFont);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.pdf"');
        doc.pipe(res);

        // Title
        doc.fontSize(18).fillColor('#101828').text('Inventory Summary Report', { align: 'center' });
        doc.moveDown(0.25);
        doc.fontSize(10).fillColor('#667085').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1);

        // Summary section
        if (summary) {
            doc.fontSize(12).fillColor('#101828').text('Summary', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#344054');
            doc.text(`Total Items: ${summary.totalItems}`);
            doc.text(`Total Quantity: ${summary.totalQuantity}`);
            doc.text(`Total Value: ₱${Number(summary.totalValue).toLocaleString()}`);
            doc.text(`Items Needing Restock: ${summary.lowStockCount}`);
            doc.moveDown(1);
        }

        // Low-stock items table
        if (lowStockItems && lowStockItems.length > 0) {
            doc.fontSize(12).fillColor('#101828').text('Low-Stock Alerts', { underline: true });
            doc.moveDown(0.5);

            const headers = ['Item', 'Stock', 'ROP', 'MSL', 'Deficit', 'Urgency'];
            const colWidths = [200, 60, 60, 60, 60, 80];
            const cellPadding = 4;
            let y = doc.y;

            // Header row
            doc.fontSize(8).fillColor('#667085');
            headers.forEach((h, i) => {
                const x = doc.page.margins.left + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
                doc.rect(x, y, colWidths[i], 20).fillAndStroke('#EEF2F6', '#D0D5DD');
                doc.fillColor('#667085').text(h, x + cellPadding, y + 5, { width: colWidths[i] - cellPadding * 2 });
            });
            y += 20;

            // Data rows
            lowStockItems.forEach((item) => {
                if (y + 20 > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage({ size: 'A4', margin: 40 });
                    y = doc.y;
                }
                const rowData = [
                    item.title || '',
                    String(item.currentStock),
                    String(item.reorderPoint),
                    String(item.minimumStockLevel),
                    String(item.deficit),
                    (item.urgency || '').toUpperCase()
                ];
                doc.fontSize(7).fillColor('#344054');
                rowData.forEach((cell, i) => {
                    const x = doc.page.margins.left + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
                    doc.rect(x, y, colWidths[i], 20).fillAndStroke('#FFFFFF', '#D0D5DD');
                    doc.fillColor('#344054').text(cell, x + cellPadding, y + 5, { width: colWidths[i] - cellPadding * 2 });
                });
                y += 20;
            });
        }

        doc.end();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/export/report/excel', requireAuth, async (req, res) => {
    try {
        const { summary, lowStockItems } = req.body || {};

        const summarySheet = XLSX.utils.aoa_to_sheet([
            ['Inventory Summary Report'],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ['Metric', 'Value'],
            ['Total Items', summary?.totalItems || 0],
            ['Total Quantity', summary?.totalQuantity || 0],
            ['Total Value', summary?.totalValue || 0],
            ['Items Needing Restock', summary?.lowStockCount || 0],
        ]);

        const alertHeaders = ['Item Code', 'Item Name', 'Size', 'Current Stock', 'Reorder Point', 'Min Stock Level', 'Deficit', 'Unit Cost', 'Restock Cost', 'FSN', 'Urgency'];
        const alertRows = (lowStockItems || []).map(item => [
            item.itemCode, item.title, item.size || '',
            item.currentStock, item.reorderPoint, item.minimumStockLevel,
            item.deficit, item.unitCost, item.restockCost,
            item.fsn, item.urgency
        ]);
        const alertSheet = XLSX.utils.aoa_to_sheet([alertHeaders, ...alertRows]);

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
        XLSX.utils.book_append_sheet(workbook, alertSheet, 'Low-Stock Alerts');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.xlsx"');
        res.send(buffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ======================= FORECAST EXPORT ROUTES =======================

app.post('/api/export/forecast/excel', requireAuth, (req, res) => {
    try {
        const { headers = [], rows = [] } = req.body || {};
        const aoa = [headers, ...rows];
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Forecast');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="forecast.xlsx"');
        res.send(buffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/export/forecast/pdf', requireAuth, (req, res) => {
    try {
        const { headers = [], rows = [] } = req.body || {};
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

        const fontCandidates = [
            'C:/Windows/Fonts/segoeui.ttf',
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/calibri.ttf',
        ];
        const unicodeFont = fontCandidates.find((fontPath) => fs.existsSync(fontPath));
        if (unicodeFont) {
            doc.font(unicodeFont);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="forecast.pdf"');
        doc.pipe(res);

        doc.fontSize(14).text('Inventory Forecast', { align: 'left' });
        doc.moveDown(0.25);
        doc.fontSize(9).fillColor('#667085').text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' });
        doc.moveDown(0.5);

        const tableRows = [headers, ...rows];
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const colCount = Math.max(headers.length, 1);
        const colWidth = pageWidth / colCount;
        let y = doc.y;
        const cellPadding = 4;
        const maxRowHeight = 120;

        tableRows.forEach((row, rowIndex) => {
            const isHeader = rowIndex === 0;
            const fontSize = isHeader ? 8 : 7;
            doc.fontSize(fontSize);

            let rowHeight = 0;
            row.forEach((cell) => {
                const cellText = String(cell ?? '');
                const measured = doc.heightOfString(cellText, {
                    width: colWidth - cellPadding * 2,
                    align: 'left',
                });
                rowHeight = Math.max(rowHeight, measured + cellPadding * 2);
            });
            rowHeight = Math.max(20, Math.min(maxRowHeight, rowHeight));

            if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
                y = doc.y;
            }

            row.forEach((cell, colIndex) => {
                const x = doc.page.margins.left + colIndex * colWidth;
                doc
                    .rect(x, y, colWidth, rowHeight)
                    .fillAndStroke(isHeader ? '#EEF2F6' : '#FFFFFF', '#D0D5DD');
                doc
                    .fillColor('#101828')
                    .fontSize(fontSize)
                    .text(String(cell ?? ''), x + cellPadding, y + cellPadding, {
                        width: colWidth - cellPadding * 2,
                        height: rowHeight - cellPadding * 2,
                        lineBreak: true,
                    });
            });
            y += rowHeight;
        });

        doc.end();
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ======================= FORBIDDEN PAGE =======================
// Catch-all for forbidden access (rendered by requirePage middleware)

// ======================= START SERVER =======================
const PORT = process.env.PORT || 3000;
db.initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error("Database initialization failed", err);
});