-- Manual import of order #5208 (NOEBEL VENTURES) before go-live.
-- Run once:  wrangler d1 execute apaulogyecomm --remote --file=./db/import-order-5208.sql
--
-- Note: the order total in the source screenshot was cut off, so shipping is
-- recorded as 0 and total = subtotal (₹4,200). If a delivery fee applied, edit
-- the `shipping` and `total` values below (both in paise) before running.

INSERT OR IGNORE INTO customers (email,name,phone) VALUES
('lakshmi@artifold.com','NOEBEL VENTURES','7795346011');

INSERT OR IGNORE INTO orders
  (order_number,email,phone,status,currency,subtotal,shipping,discount,total,billing_json,shipping_json,notes,source,created_at) VALUES
('APG-5208','lakshmi@artifold.com','7795346011','processing','INR',420000,0,0,420000,
 '{"name":"NOEBEL VENTURES","company":"NOEBEL VENTURES Ventures","address":"No.136, Cears Plaza, Unit No.G006, Ground Floor, Residency Road","city":"Bengaluru","state":"KA","postcode":"560025","country":"India","email":"lakshmi@artifold.com","phone":"7795346011"}',
 '{"name":"NOEBEL VENTURES","company":"NOEBEL VENTURES Ventures","address":"No.136, Cears Plaza, Unit No.G006, Ground Floor, Residency Road","city":"Bengaluru","state":"KA","postcode":"560025","country":"India","method":"Domestic (Bangalore) - Dunzo/DTDC"}',
 'phonepe (520820260910062801)','import','2026-09-10 06:28:01');

INSERT OR IGNORE INTO order_items (order_number,slug,name,variant,price,quantity) VALUES
('APG-5208','','Dog Show - Large Mounted Print (13" x 19")','Large Mounted Print (13" x 19")',210000,1),
('APG-5208','','South Parade - Large Mounted Print (13" x 19")','Large Mounted Print (13" x 19")',210000,1);
