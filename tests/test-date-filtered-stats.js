import SimpleDatabase from './simple-database.js';

async function testDateFilteredStats() {
  console.log('🧪 Testing Date-Filtered Order Statistics');
  console.log('=' .repeat(60));
  
  const database = new SimpleDatabase();
  
  // Create test orders with different dates
  const testOrders = [
    {
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '+1234567890',
      total_amount: 100000,
      status: 'pending',
      order_date: '2025-08-27',
      notes: 'Test order 1'
    },
    {
      customer_name: 'Jane Smith',
      customer_email: 'jane@example.com', 
      customer_phone: '+1234567891',
      total_amount: 200000,
      status: 'shipped',
      order_date: '2025-08-28',
      notes: 'Test order 2'
    },
    {
      customer_name: 'Bob Johnson',
      customer_email: 'bob@example.com',
      customer_phone: '+1234567892', 
      total_amount: 150000,
      status: 'delivered',
      order_date: '2025-08-29',
      notes: 'Test order 3'
    },
    {
      customer_name: 'Alice Brown',
      customer_email: 'alice@example.com',
      customer_phone: '+1234567893',
      total_amount: 300000,
      status: 'pending',
      order_date: '2025-08-30',
      notes: 'Test order 4'
    },
    {
      customer_name: 'Charlie Wilson',
      customer_email: 'charlie@example.com',
      customer_phone: '+1234567894',
      total_amount: 250000,
      status: 'shipped',
      order_date: '2025-08-31',
      notes: 'Test order 5'
    }
  ];
  
  console.log('📋 Step 1: Creating test orders...');
  
  // Clear existing orders for clean test
  database.data.orders = [];
  database.data.lastId.orders = 0;
  
  for (const orderData of testOrders) {
    await database.createOrder(orderData);
  }
  
  console.log(`✅ Created ${testOrders.length} test orders`);
  
  // Test 1: All-time stats (no date filters)
  console.log('\n📋 Test 1: All-time statistics (no date filter)');
  const allTimeStats = await database.getOrderStats();
  console.log(`✅ Total Orders: ${allTimeStats.total_orders}`);
  console.log(`✅ Total Value: Rp ${allTimeStats.total_order_value.toLocaleString('id-ID')}`);
  console.log(`✅ Pending: ${allTimeStats.pending_orders}, Shipped: ${allTimeStats.shipped_orders}, Delivered: ${allTimeStats.delivered_orders}`);
  
  // Test 2: Single day filter (2025-08-28)
  console.log('\n📋 Test 2: Single day filter (2025-08-28)');
  const singleDayStats = await database.getOrderStats('2025-08-28', '2025-08-28');
  console.log(`✅ Orders on 2025-08-28: ${singleDayStats.total_orders}`);
  console.log(`✅ Value on 2025-08-28: Rp ${singleDayStats.total_order_value.toLocaleString('id-ID')}`);
  
  // Test 3: Date range filter (2025-08-28 to 2025-08-30)
  console.log('\n📋 Test 3: Date range filter (2025-08-28 to 2025-08-30)');
  const rangeStats = await database.getOrderStats('2025-08-28', '2025-08-30');
  console.log(`✅ Orders in range: ${rangeStats.total_orders}`);
  console.log(`✅ Total Value: Rp ${rangeStats.total_order_value.toLocaleString('id-ID')}`);
  console.log(`✅ Pending: ${rangeStats.pending_orders}, Shipped: ${rangeStats.shipped_orders}, Delivered: ${rangeStats.delivered_orders}`);
  
  // Test 4: Start date only
  console.log('\n📋 Test 4: From date filter (from 2025-08-29)');
  const fromDateStats = await database.getOrderStats('2025-08-29');
  console.log(`✅ Orders from 2025-08-29: ${fromDateStats.total_orders}`);
  console.log(`✅ Total Value: Rp ${fromDateStats.total_order_value.toLocaleString('id-ID')}`);
  
  // Test 5: End date only
  console.log('\n📋 Test 5: To date filter (until 2025-08-29)');
  const toDateStats = await database.getOrderStats(null, '2025-08-29');
  console.log(`✅ Orders until 2025-08-29: ${toDateStats.total_orders}`);
  console.log(`✅ Total Value: Rp ${toDateStats.total_order_value.toLocaleString('id-ID')}`);
  
  // Test 6: No orders in range
  console.log('\n📋 Test 6: No orders in range (2025-09-01 to 2025-09-05)');
  const emptyRangeStats = await database.getOrderStats('2025-09-01', '2025-09-05');
  console.log(`✅ Orders in empty range: ${emptyRangeStats.total_orders}`);
  console.log(`✅ Value in empty range: Rp ${emptyRangeStats.total_order_value.toLocaleString('id-ID')}`);
  
  // Verification
  console.log('\n📋 Verification Summary:');
  console.log(`• All-time orders: ${allTimeStats.total_orders} (should be 5)`);
  console.log(`• Single day (2025-08-28): ${singleDayStats.total_orders} (should be 1)`);
  console.log(`• Range (2025-08-28 to 2025-08-30): ${rangeStats.total_orders} (should be 3)`);
  console.log(`• From 2025-08-29: ${fromDateStats.total_orders} (should be 3)`);
  console.log(`• Until 2025-08-29: ${toDateStats.total_orders} (should be 3)`);
  console.log(`• Empty range: ${emptyRangeStats.total_orders} (should be 0)`);
  
  console.log('\n🎉 Date-filtered statistics test completed!');
  
  // Manual verification data
  console.log('\n📊 Test Data for Manual Verification:');
  testOrders.forEach((order, index) => {
    console.log(`   ${index + 1}. ${order.order_date}: ${order.customer_name} - Rp ${order.total_amount.toLocaleString('id-ID')} (${order.status})`);
  });
}

// Run the test
testDateFilteredStats().catch(console.error);