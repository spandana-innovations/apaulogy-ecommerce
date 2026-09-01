INSERT OR IGNORE INTO customers (email,name,phone) VALUES
 ('meera@example.com','Meera Rao','9845012345'),
 ('john@example.in','John Mathew','9812345678'),
 ('anita@example.com','Anita Shenoy','9900011122');
INSERT OR IGNORE INTO orders (order_number,email,phone,status,subtotal,shipping,discount,total,billing_json,razorpay_payment_id,created_at) VALUES
 ('APG-100001','meera@example.com','9845012345','paid',270000,0,0,270000,'{"name":"Meera Rao","city":"Bengaluru"}','pay_demo1', datetime('now','-1 day')),
 ('APG-100002','john@example.in','9812345678','shipped',135000,15000,0,150000,'{"name":"John Mathew","city":"Mumbai"}','pay_demo2', datetime('now','-3 day')),
 ('APG-100003','anita@example.com','9900011122','pending',95000,15000,0,110000,'{"name":"Anita Shenoy","city":"Mangalore"}',NULL, datetime('now','-2 hour'));
INSERT OR IGNORE INTO order_items (order_number,slug,name,variant,price,quantity) VALUES
 ('APG-100001','bawa-nu-bliss','Bawa Nu Bliss','Mounted Print · 12.5″ × 12.5″',320000,1),
 ('APG-100002','pensioner','Pensioner','Small Mounted Print (8.5\" x 11.5\")',135000,1),
 ('APG-100003','bhaan-copper-water-boiler','Bhaan Copper Water Boiler','Mounted Print · 9″ × 9″',95000,1);
INSERT OR IGNORE INTO discounts (label,scope,target,kind,value,active) VALUES
 ('Festive 15% off Bangalore 70s','category','bangalore-in-the-70s','percent',15,1),
 ('Free shipping over the season','all','','free_shipping',0,1);
INSERT OR IGNORE INTO coupons (code,kind,value,min_order,active) VALUES
 ('WELCOME10','percent',10,0,1),
 ('FLAT200','fixed',200,100000,1);
