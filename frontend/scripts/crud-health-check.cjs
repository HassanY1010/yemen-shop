// =========================================================
// CRUD Health Check Test Suite for Yemen Shop SaaS
// Tests All DB Write Operations (CREATE, READ, UPDATE, DELETE)
// =========================================================

const pg = require('pg');
const crypto = require('crypto');
const { Pool } = pg;

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres.abybrwyyhuacyrexoibi:Hhaall112233HH@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';

async function runCrudTestSuite() {
  console.log('---------------------------------------------------------');
  console.log('🚀 Starting Comprehensive CRUD Health Check Test Suite...');
  console.log('---------------------------------------------------------');

  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  let totalPassed = 0;
  let totalFailed = 0;

  function reportSuccess(testName, detail = '') {
    totalPassed++;
    console.log(`✅ SUCCESS: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }

  function reportFailure(testName, error) {
    totalFailed++;
    console.error(`❌ FAILED: ${testName} - ${error?.message || error}`);
  }

  try {
    const testPrefix = 'test_' + Date.now().toString(36);

    // ─── 1. Authentication CRUD ─────────────────────────────────
    let testUserId = null;
    let testToken = crypto.randomUUID();
    try {
      // Create user
      const userRes = await pool.query(
        `INSERT INTO users (name, email, password, role, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
        [`User ${testPrefix}`, `${testPrefix}@test.com`, 'hashedpassword123', 'merchant', '770000000']
      );
      testUserId = userRes.rows[0].id;

      // Verify user login lookup
      const loginRes = await pool.query(`SELECT * FROM users WHERE email = $1 AND is_active = 1`, [`${testPrefix}@test.com`]);
      if (loginRes.rows.length === 0) throw new Error('User not found after insert');

      // Create session
      await pool.query(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '30 days')`,
        [crypto.randomUUID(), testUserId, testToken]
      );

      // Verify session
      const sessionRes = await pool.query(`SELECT * FROM sessions WHERE token = $1`, [testToken]);
      if (sessionRes.rows.length === 0) throw new Error('Session not found after insert');

      reportSuccess('1. Authentication (Create User, Login Lookup, Session Creation)', `User ID: ${testUserId}`);
    } catch (err) {
      reportFailure('1. Authentication', err);
    }

    // ─── 2. Store CRUD ──────────────────────────────────────────
    let testStoreId = null;
    try {
      // Create store
      const storeRes = await pool.query(
        `INSERT INTO stores (user_id, plan_id, name, slug, phone, currency, status, subscription_status, primary_color, secondary_color)
         VALUES ($1, 1, $2, $3, $4, 'YER', 'active', 'active', '#4F46E5', '#818CF8') RETURNING id`,
        [testUserId, `Store ${testPrefix}`, `store-${testPrefix}`, '771111111']
      );
      testStoreId = storeRes.rows[0].id;

      // Update store settings
      await pool.query(
        `UPDATE stores SET 
           name = $1, description = $2, phone = $3, whatsapp = $4,
           primary_color = $5, secondary_color = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 AND user_id = $8`,
        [`Updated Store ${testPrefix}`, 'Updated description', '772222222', '772222222', '#6366F1', '#A5B4FC', testStoreId, testUserId]
      );

      // Read updated store
      const updatedStore = await pool.query(`SELECT name FROM stores WHERE id = $1`, [testStoreId]);
      if (updatedStore.rows[0].name !== `Updated Store ${testPrefix}`) {
        throw new Error('Store settings update did not persist');
      }

      reportSuccess('2. Store (Create Store, Update Store Settings)', `Store ID: ${testStoreId}`);
    } catch (err) {
      reportFailure('2. Store', err);
    }

    // ─── 3. Categories CRUD ─────────────────────────────────────
    let testCategoryId = null;
    try {
      // Create category
      const catRes = await pool.query(
        `INSERT INTO categories (store_id, name, slug, description, sort_order, is_active)
         VALUES ($1, $2, $3, $4, 1, 1) RETURNING id`,
        [testStoreId, `Cat ${testPrefix}`, `cat-${testPrefix}`, 'Test Category']
      );
      testCategoryId = catRes.rows[0].id;

      // Update category
      await pool.query(
        `UPDATE categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND store_id = $4`,
        [`Updated Cat ${testPrefix}`, 'Updated Category Desc', testCategoryId, testStoreId]
      );

      // Read updated category
      const updatedCat = await pool.query(`SELECT name FROM categories WHERE id = $1`, [testCategoryId]);
      if (updatedCat.rows[0].name !== `Updated Cat ${testPrefix}`) throw new Error('Category update failed');

      reportSuccess('3. Categories (Create, Update, Read Category)', `Category ID: ${testCategoryId}`);
    } catch (err) {
      reportFailure('3. Categories', err);
    }

    // ─── 4. Products CRUD ───────────────────────────────────────
    let testProductId = null;
    try {
      // Create product with dual column alignment (featured & is_featured)
      const prodRes = await pool.query(
        `INSERT INTO products (store_id, category_id, name, slug, description, price, sale_price, stock, status, featured, is_featured)
         VALUES ($1, $2, $3, $4, $5, 1000, 800, 50, 'active', 1, 1) RETURNING id`,
        [testStoreId, testCategoryId, `Product ${testPrefix}`, `prod-${testPrefix}`, 'Product description']
      );
      testProductId = prodRes.rows[0].id;

      // Update product
      await pool.query(
        `UPDATE products SET 
           name = $1, price = 1200, sale_price = 950, stock = 45, status = 'active',
           featured = 1, is_featured = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND store_id = $3`,
        [`Updated Prod ${testPrefix}`, testProductId, testStoreId]
      );

      // Soft delete product
      await pool.query(
        `UPDATE products SET status = 'deleted' WHERE id = $1 AND store_id = $2`,
        [testProductId, testStoreId]
      );

      const deletedProd = await pool.query(`SELECT status FROM products WHERE id = $1`, [testProductId]);
      if (deletedProd.rows[0].status !== 'deleted') throw new Error('Product delete failed');

      // Restore product for order tests
      await pool.query(`UPDATE products SET status = 'active' WHERE id = $1`, [testProductId]);

      reportSuccess('4. Products (Create, Update, Soft Delete Product)', `Product ID: ${testProductId}`);
    } catch (err) {
      reportFailure('4. Products', err);
    }

    // ─── 5. Coupons CRUD ────────────────────────────────────────
    let testCouponId = null;
    try {
      // Create coupon with dual column alignment (min_order & min_order_amount, uses_count & used_count)
      const couponRes = await pool.query(
        `INSERT INTO coupons (store_id, code, type, value, min_order, min_order_amount, max_uses, uses_count, used_count, is_active)
         VALUES ($1, $2, 'percentage', 15, 500, 500, 100, 0, 0, 1) RETURNING id`,
        [testStoreId, `SAVE15_${testPrefix}`.toUpperCase()]
      );
      testCouponId = couponRes.rows[0].id;

      // Update coupon
      await pool.query(
        `UPDATE coupons SET value = 20, min_order = 600, min_order_amount = 600, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND store_id = $2`,
        [testCouponId, testStoreId]
      );

      // Validate coupon lookup
      const validCoupon = await pool.query(
        `SELECT * FROM coupons WHERE store_id = $1 AND code = $2 AND is_active = 1`,
        [testStoreId, `SAVE15_${testPrefix}`.toUpperCase()]
      );
      if (validCoupon.rows.length === 0 || Number(validCoupon.rows[0].value) !== 20) {
        throw new Error('Coupon update or lookup failed');
      }

      // Delete coupon
      await pool.query(`DELETE FROM coupons WHERE id = $1 AND store_id = $2`, [testCouponId, testStoreId]);

      reportSuccess('5. Coupons (Create, Update, Validate, Delete Coupon)', `Coupon ID: ${testCouponId}`);
    } catch (err) {
      reportFailure('5. Coupons', err);
    }

    // ─── 6. Flash Sales CRUD ────────────────────────────────────
    let testFlashSaleId = null;
    try {
      // Create flash sale with dual column alignment
      const fsRes = await pool.query(
        `INSERT INTO flash_sales (store_id, product_id, title, discount_type, discount_value, discount_percentage, start_at, starts_at, end_at, ends_at, max_quantity, is_active)
         VALUES ($1, $2, $3, 'percentage', 25, 25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '7 days', 20, 1) RETURNING id`,
        [testStoreId, testProductId, `Flash Sale ${testPrefix}`]
      );
      testFlashSaleId = fsRes.rows[0].id;

      // Update flash sale
      await pool.query(
        `UPDATE flash_sales SET discount_value = 30, discount_percentage = 30, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND store_id = $2`,
        [testFlashSaleId, testStoreId]
      );

      // Delete flash sale
      await pool.query(`DELETE FROM flash_sales WHERE id = $1 AND store_id = $2`, [testFlashSaleId, testStoreId]);

      reportSuccess('6. Flash Sales (Create, Update, Delete Flash Sale)', `Flash Sale ID: ${testFlashSaleId}`);
    } catch (err) {
      reportFailure('6. Flash Sales', err);
    }

    // ─── 7. Orders CRUD ─────────────────────────────────────────
    let testOrderId = null;
    try {
      // Create customer
      const custRes = await pool.query(
        `INSERT INTO customers (store_id, name, email, phone, city, address)
         VALUES ($1, $2, $3, $4, 'Sanaa', 'Test Street') RETURNING id`,
        [testStoreId, `Customer ${testPrefix}`, `cust_${testPrefix}@test.com`, '773333333']
      );
      const testCustomerId = custRes.rows[0].id;

      // Create order with dual column alignment (shipping & shipping_cost, discount & discount_amount, customer_city & shipping_city)
      const orderRes = await pool.query(
        `INSERT INTO orders (store_id, customer_id, order_number, customer_name, customer_email, customer_phone, customer_city, shipping_city, customer_address, shipping_address, subtotal, shipping, shipping_cost, discount, discount_amount, total, status, payment_status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, 'Sanaa', 'Sanaa', 'Test Street', 'Test Street', 1000, 100, 100, 50, 50, 1050, 'pending', 'pending', 'cod') RETURNING id`,
        [testStoreId, testCustomerId, `ORD-${testPrefix}`, `Customer ${testPrefix}`, `cust_${testPrefix}@test.com`, '773333333']
      );
      testOrderId = orderRes.rows[0].id;

      // Create order items
      await pool.query(
        `INSERT INTO order_items (order_id, store_id, product_id, product_name, price, quantity, total)
         VALUES ($1, $2, $3, $4, 1000, 1, 1000)`,
        [testOrderId, testStoreId, testProductId, `Product ${testPrefix}`]
      );

      // Update order status
      await pool.query(
        `UPDATE orders SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND store_id = $2`,
        [testOrderId, testStoreId]
      );

      // Update payment status
      await pool.query(
        `UPDATE orders SET payment_status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND store_id = $2`,
        [testOrderId, testStoreId]
      );

      const updatedOrder = await pool.query(`SELECT status, payment_status FROM orders WHERE id = $1`, [testOrderId]);
      if (updatedOrder.rows[0].status !== 'processing' || updatedOrder.rows[0].payment_status !== 'paid') {
        throw new Error('Order status update failed');
      }

      reportSuccess('7. Orders (Create Order, Order Items, Update Status & Payment Status)', `Order ID: ${testOrderId}`);
    } catch (err) {
      reportFailure('7. Orders', err);
    }

    // ─── 8. Staff CRUD ──────────────────────────────────────────
    let testStaffId = null;
    try {
      // Add employee user
      const staffUserRes = await pool.query(
        `INSERT INTO users (store_id, name, email, password, role, phone, is_active)
         VALUES ($1, $2, $3, $4, 'staff', $5, 1) RETURNING id`,
        [testStoreId, `Staff ${testPrefix}`, `staff_${testPrefix}@test.com`, 'hashedpassword123', '774444444']
      );
      testStaffId = staffUserRes.rows[0].id;

      // Add store_staff entry
      await pool.query(
        `INSERT INTO store_staff (store_id, user_id, role, permissions, is_active)
         VALUES ($1, $2, 'staff', '["products","orders"]', 1)`,
        [testStoreId, testStaffId]
      );

      // Update permissions
      await pool.query(
        `UPDATE store_staff SET permissions = '["products","orders","coupons"]' WHERE user_id = $1 AND store_id = $2`,
        [testStaffId, testStoreId]
      );

      // Delete employee
      await pool.query(`DELETE FROM store_staff WHERE user_id = $1 AND store_id = $2`, [testStaffId, testStoreId]);
      await pool.query(`DELETE FROM users WHERE id = $1 AND store_id = $2 AND role = 'staff'`, [testStaffId, testStoreId]);

      reportSuccess('8. Staff (Add Employee, Update Permissions, Delete Employee)', `Staff User ID: ${testStaffId}`);
    } catch (err) {
      reportFailure('8. Staff', err);
    }

    // Clean up test records safely
    if (testStoreId) {
      await pool.query(`DELETE FROM orders WHERE store_id = $1`, [testStoreId]);
      await pool.query(`DELETE FROM products WHERE store_id = $1`, [testStoreId]);
      await pool.query(`DELETE FROM categories WHERE store_id = $1`, [testStoreId]);
      await pool.query(`DELETE FROM customers WHERE store_id = $1`, [testStoreId]);
      await pool.query(`DELETE FROM stores WHERE id = $1`, [testStoreId]);
    }
    if (testUserId) {
      await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [testUserId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    }

    await pool.end();

    console.log('---------------------------------------------------------');
    console.log(`📊 Test Summary: Total Passed: ${totalPassed} | Total Failed: ${totalFailed}`);
    console.log('---------------------------------------------------------');

    if (totalFailed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 All CRUD Write Operations Health Checks PASSED cleanly!');
      process.exit(0);
    }
  } catch (globalErr) {
    console.error('❌ Fatal error during CRUD Health Check:', globalErr);
    await pool.end();
    process.exit(1);
  }
}

runCrudTestSuite();
