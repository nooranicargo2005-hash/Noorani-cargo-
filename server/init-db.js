const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'noorani-cargo.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Initializing SQLite Database schema...');

    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        displayName TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        branchCode TEXT,
        status TEXT DEFAULT 'enabled',
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Customers Table
    db.run(`CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        fullName TEXT NOT NULL,
        companyName TEXT,
        mobileNumber TEXT,
        whatsAppNumber TEXT,
        email TEXT,
        nationalId TEXT,
        address TEXT,
        city TEXT,
        country TEXT,
        postalCode TEXT,
        customerType TEXT DEFAULT 'Individual',
        notes TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Employees Table
    db.run(`CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        fullName TEXT NOT NULL,
        fatherName TEXT,
        dob TEXT,
        gender TEXT,
        email TEXT,
        mobileNumber TEXT,
        whatsAppNumber TEXT,
        nationalId TEXT,
        address TEXT,
        designation TEXT,
        department TEXT,
        assignedBranch TEXT,
        employmentType TEXT DEFAULT 'Full-Time',
        employmentStatus TEXT DEFAULT 'Active',
        dateOfJoining TEXT,
        basicSalary REAL,
        emergencyContactName TEXT,
        emergencyContactPhone TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Drivers Table
    db.run(`CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY,
        fullName TEXT NOT NULL,
        email TEXT,
        mobileNumber TEXT,
        whatsAppNumber TEXT,
        nationalId TEXT,
        licenseNumber TEXT,
        licenseExpiry TEXT,
        branchCode TEXT,
        assignedVehicle TEXT,
        address TEXT,
        emergencyContact TEXT,
        notes TEXT,
        status TEXT DEFAULT 'active',
        dateOfJoining TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Vehicles Table
    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        plateNumber TEXT UNIQUE NOT NULL,
        brand TEXT,
        model TEXT,
        year TEXT,
        vehicleType TEXT,
        registrationNumber TEXT,
        registrationExpiry TEXT,
        insuranceExpiry TEXT,
        chassisNumber TEXT,
        engineNumber TEXT,
        capacity TEXT,
        fuelType TEXT,
        assignedDriver TEXT,
        assignedBranch TEXT,
        currentMileage REAL DEFAULT 0,
        status TEXT DEFAULT 'Available',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Branches Table
    db.run(`CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        branchName TEXT NOT NULL,
        branchCode TEXT UNIQUE NOT NULL,
        managerName TEXT,
        phoneNumber TEXT,
        whatsAppNumber TEXT,
        email TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        postalCode TEXT,
        googleMaps TEXT,
        timeZone TEXT,
        workingHours TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Shipments Table
    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        trackingId TEXT PRIMARY KEY,
        ref TEXT,
        shippingNumber TEXT,
        date TEXT,
        sender TEXT,
        senderPhone TEXT,
        senderAddress TEXT,
        originCountry TEXT,
        origin TEXT,
        receiver TEXT,
        receiverPhone TEXT,
        receiverAddress TEXT,
        destination TEXT,
        destinationCountry TEXT,
        shipmentType TEXT,
        weight REAL,
        quantity INTEGER,
        shippingCost REAL,
        paymentStatus TEXT DEFAULT 'Unpaid',
        status TEXT DEFAULT 'Pending',
        author TEXT,
        driver TEXT,
        vehicle TEXT,
        branchCode TEXT,
        notes TEXT,
        public INTEGER DEFAULT 1,
        source TEXT DEFAULT 'manual',
        swbSerial TEXT,
        customerInvoice TEXT,
        originalWeight REAL,
        originalQuantity INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Invoices Table
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoiceNumber TEXT UNIQUE NOT NULL,
        trackingId TEXT,
        amount REAL,
        currency TEXT DEFAULT 'SAR',
        status TEXT DEFAULT 'issued',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trackingId) REFERENCES shipments (trackingId)
    )`);

    // Transactions Table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('income', 'expense')),
        category TEXT,
        description TEXT,
        amount REAL,
        date TEXT,
        paymentMethod TEXT,
        status TEXT DEFAULT 'Paid',
        shipmentRef TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Timeline Table
    db.run(`CREATE TABLE IF NOT EXISTS shipment_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trackingNumber TEXT NOT NULL,
        eventType TEXT,
        title TEXT,
        description TEXT,
        actor TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trackingNumber) REFERENCES shipments (trackingId)
    )`);

    // Notes Table
    db.run(`CREATE TABLE IF NOT EXISTS shipment_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trackingNumber TEXT NOT NULL,
        content TEXT,
        author TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trackingNumber) REFERENCES shipments (trackingId)
    )`);

    // Settings Table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        category TEXT NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (category, setting_key)
    )`);

    // Files Table
    db.run(`CREATE TABLE IF NOT EXISTS uploaded_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trackingId TEXT,
        fileName TEXT NOT NULL,
        filePath TEXT NOT NULL,
        fileType TEXT,
        fileSize INTEGER,
        assetType TEXT,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trackingId) REFERENCES shipments (trackingId)
    )`);

    // Audit Logs
    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        details TEXT,
        module TEXT,
        actorEmail TEXT,
        actorName TEXT,
        actorRole TEXT,
        deviceInfo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Notifications
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        message TEXT,
        type TEXT,
        link TEXT,
        recipientUid TEXT,
        read INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_tracking ON shipment_timeline (trackingNumber)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notes_tracking ON shipment_notes (trackingNumber)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_files_tracking ON uploaded_files (trackingId)`);

    console.log('Database schema completed successfully.');
});

db.close();
