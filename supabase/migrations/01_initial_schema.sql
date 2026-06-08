-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_unit TEXT NOT NULL, -- e.g., 'kg', 'pcs', 'batang'
    purchase_price_base NUMERIC NOT NULL DEFAULT 0, -- HPP for the base unit
    selling_price_base NUMERIC NOT NULL DEFAULT 0, -- Selling price for the base unit
    stock_base NUMERIC NOT NULL DEFAULT 0, -- Current stock level in terms of base unit
    min_stock_base NUMERIC NOT NULL DEFAULT 0, -- Minimum stock level for alert
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create units_conversion table
CREATE TABLE IF NOT EXISTS units_conversion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    unit_name TEXT NOT NULL, -- e.g., 'sak', 'ret', 'kaleng', 'pcs', 'batang'
    multiplier NUMERIC NOT NULL, -- e.g., 40.0 (1 Sak = 40 Kg)
    selling_price NUMERIC, -- Custom price for this unit, if NULL use multiplier * selling_price_base
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, unit_name)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_no TEXT UNIQUE NOT NULL,
    admin_id TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Pelanggan Umum (Walk-in)',
    total_price NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0, -- 11%
    discount NUMERIC NOT NULL DEFAULT 0,
    final_price NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL, -- 'Cash', 'QRIS', 'Debit/Transfer'
    amount_paid NUMERIC NOT NULL DEFAULT 0,
    change_given NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'voided'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create transaction_items table
CREATE TABLE IF NOT EXISTS transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    unit_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    multiplier NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create void_requests table (for remote authorization)
CREATE TABLE IF NOT EXISTS void_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    item_details JSONB NOT NULL, -- contains specific items, details, and amount
    requested_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert dummy suppliers
INSERT INTO suppliers (name, contact_person, phone) VALUES
('Semen Tiga Roda Utama', 'Budi Santoso', '081234567890'),
('Dulux Paint Specialist', 'Siti Aminah', '081398765432'),
('Tekiro Tools Indonesia', 'Rian Hidayat', '081955551234')
ON CONFLICT DO NOTHING;

-- Insert dummy products (making sure we don't duplicate on re-run)
INSERT INTO products (sku, name, category, base_unit, purchase_price_base, selling_price_base, stock_base, min_stock_base, supplier_id) VALUES
('SMN-TRD-50KG', 'Semen Portland Tiga Roda 50kg', 'Semen', 'kg', 1100, 1300, 7100, 1500, (SELECT id FROM suppliers WHERE name = 'Semen Tiga Roda Utama' LIMIT 1)),
('CAT-DLX-25L', 'Cat Tembok Dulux Pentalite Putih 2.5L', 'Cat', 'pcs', 150000, 185000, 24, 5, (SELECT id FROM suppliers WHERE name = 'Dulux Paint Specialist' LIMIT 1)),
('AL-PAL-16OZ', 'Palu Kambing Tekiro 16oz Gagang Karet', 'Alat Pertukangan', 'pcs', 65000, 85000, 3, 5, (SELECT id FROM suppliers WHERE name = 'Tekiro Tools Indonesia' LIMIT 1)),
('PP-PVC-AW-1/2', 'Pipa Rucika AW 1/2 Inch (Per Batang 4m)', 'Pipa', 'pcs', 25000, 32500, 56, 10, (SELECT id FROM suppliers WHERE name = 'Tekiro Tools Indonesia' LIMIT 1)),
('BJ-C75-0.75', 'Baja Ringan Kanal C75 Tebal 0.75mm Taso', 'Baja Ringan', 'pcs', 80000, 98000, 210, 20, (SELECT id FROM suppliers WHERE name = 'Tekiro Tools Indonesia' LIMIT 1))
ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    base_unit = EXCLUDED.base_unit,
    purchase_price_base = EXCLUDED.purchase_price_base,
    selling_price_base = EXCLUDED.selling_price_base,
    stock_base = EXCLUDED.stock_base,
    min_stock_base = EXCLUDED.min_stock_base;

-- Insert unit conversions
-- For Semen: base is kg, but it is sold in Sak (50kg) and kg
INSERT INTO units_conversion (product_id, unit_name, multiplier, selling_price) VALUES
((SELECT id FROM products WHERE sku = 'SMN-TRD-50KG'), 'Kg', 1, 1300),
((SELECT id FROM products WHERE sku = 'SMN-TRD-50KG'), 'Sak', 50, 65000)
ON CONFLICT (product_id, unit_name) DO UPDATE SET
    multiplier = EXCLUDED.multiplier,
    selling_price = EXCLUDED.selling_price;
