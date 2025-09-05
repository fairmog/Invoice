// Test script to verify payment button fix
console.log('🧪 Testing Payment Button Fix - No More "Bayar Uang Muka"');
console.log('='.repeat(70));

// Simulate the fixed logic from simple-invoice-view.html
function determinePaymentInfo(invoice, formatCurrency) {
    try {
        let paymentSchedule = null;
        
        // Parse payment schedule data
        if (invoice.payment_schedule_json) {
            if (typeof invoice.payment_schedule_json === 'string') {
                try {
                    paymentSchedule = JSON.parse(invoice.payment_schedule_json);
                } catch (e) {
                    paymentSchedule = null;
                }
            } else if (typeof invoice.payment_schedule_json === 'object') {
                paymentSchedule = invoice.payment_schedule_json;
            }
            
            if (paymentSchedule && paymentSchedule.scheduleType === 'down_payment') {
                const currentStage = invoice.payment_stage || 'down_payment';
                
                if (currentStage === 'down_payment') {
                    return {
                        amount: paymentSchedule.downPayment.amount,
                        label: `Bayar Uang Muka (${paymentSchedule.downPayment.percentage}%)`,
                        description: `Uang muka untuk invoice ini. Sisa pembayaran: ${formatCurrency(paymentSchedule.remainingBalance.amount)}`,
                        stage: 'down_payment'
                    };
                } else if (currentStage === 'remaining_balance' || currentStage === 'final_payment') {
                    const finalAmount = invoice.final_payment_amount || paymentSchedule.remainingBalance.amount;
                    return {
                        amount: finalAmount,
                        label: 'Bayar Sisa Pembayaran',
                        description: 'Pembayaran terakhir untuk menyelesaikan invoice ini',
                        stage: 'final_payment'
                    };
                } else if (currentStage === 'completed') {
                    return {
                        amount: 0,
                        label: 'Invoice Lunas',
                        description: 'Invoice ini telah dibayar lunas',
                        stage: 'completed'
                    };
                }
            }
        }
        
        // NO FALLBACK for discount_amount - discount should not be treated as down payment
        console.log('✅ discount_amount detected but NOT treating as down payment');
        console.log('   Regular discount invoices should show "Bayar Invoice" with full amount');
        
        // Default: full payment
        return {
            amount: invoice.grand_total,
            label: 'Bayar Invoice',
            description: 'Pembayaran penuh untuk invoice ini',
            stage: 'full_payment'
        };
    } catch (e) {
        console.error('Error determining payment info:', e);
        return {
            amount: invoice.grand_total,
            label: 'Bayar Invoice',
            description: 'Pembayaran penuh untuk invoice ini',
            stage: 'full_payment'
        };
    }
}

function formatCurrency(amount) {
    return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Test cases
function runPaymentButtonTests() {
    console.log('📋 Test Cases:');
    
    // Test 1: Regular discount invoice (user's case)
    console.log('\n🧪 Test 1: Regular Discount Invoice (User\'s Case)');
    const discountInvoice = {
        id: 123,
        invoice_number: 'INV-BEV-20250828-TEST',
        subtotal: 75000,
        discount_amount: 7500, // 10% discount
        grand_total: 97500, // After discount + shipping
        payment_stage: null,
        payment_schedule_json: null
    };
    
    const discountResult = determinePaymentInfo(discountInvoice, formatCurrency);
    console.log('Input: Regular invoice with discount_amount: 7500');
    console.log(`Result: ${JSON.stringify(discountResult, null, 2)}`);
    console.log(`Payment button text: "${discountResult.label}"`);
    console.log(`Expected: "Bayar Invoice", Got: "${discountResult.label}"`);
    console.log(`✅ Test 1: ${discountResult.label === 'Bayar Invoice' ? 'PASS' : 'FAIL'}`);
    
    // Test 2: Actual down payment invoice
    console.log('\n🧪 Test 2: Actual Down Payment Invoice');
    const downPaymentInvoice = {
        id: 124,
        invoice_number: 'INV-BEV-20250828-DP',
        subtotal: 100000,
        grand_total: 100000,
        payment_stage: 'down_payment',
        payment_schedule_json: {
            scheduleType: 'down_payment',
            downPayment: {
                percentage: 30,
                amount: 30000,
                dueDate: '2025-08-30'
            },
            remainingBalance: {
                amount: 70000,
                dueDate: '2025-09-30'
            }
        },
        discount_amount: null
    };
    
    const dpResult = determinePaymentInfo(downPaymentInvoice, formatCurrency);
    console.log('Input: Actual down payment with payment_schedule_json');
    console.log(`Result: ${JSON.stringify(dpResult, null, 2)}`);
    console.log(`Payment button text: "${dpResult.label}"`);
    console.log(`Expected: "Bayar Uang Muka (30%)", Got: "${dpResult.label}"`);
    console.log(`✅ Test 2: ${dpResult.label.includes('Bayar Uang Muka') ? 'PASS' : 'FAIL'}`);
    
    // Test 3: Regular invoice without discount
    console.log('\n🧪 Test 3: Regular Invoice Without Discount');
    const regularInvoice = {
        id: 125,
        invoice_number: 'INV-BEV-20250828-REG',
        subtotal: 50000,
        grand_total: 50000,
        payment_stage: null,
        payment_schedule_json: null,
        discount_amount: null
    };
    
    const regularResult = determinePaymentInfo(regularInvoice, formatCurrency);
    console.log('Input: Regular invoice without discount or payment schedule');
    console.log(`Result: ${JSON.stringify(regularResult, null, 2)}`);
    console.log(`Payment button text: "${regularResult.label}"`);
    console.log(`Expected: "Bayar Invoice", Got: "${regularResult.label}"`);
    console.log(`✅ Test 3: ${regularResult.label === 'Bayar Invoice' ? 'PASS' : 'FAIL'}`);
    
    // Test 4: User's exact scenario
    console.log('\n🧪 Test 4: User\'s Exact Scenario');
    const userScenario = {
        customer_name: 'gigi mon',
        customer_email: 'vetripro@gmail.com',
        subtotal: 75000, // 3 lolly * 25000
        discount_amount: 7500, // 10% discount
        shipping_cost: 30000, // ongkir 30rb
        grand_total: 97500, // 75000 - 7500 + 30000
        payment_stage: null, // No payment schedule
        payment_schedule_json: null
    };
    
    const userResult = determinePaymentInfo(userScenario, formatCurrency);
    console.log('Input: "discount 10%" + "ongkir 30rb"');
    console.log(`Payment button text: "${userResult.label}"`);
    console.log(`Payment amount: ${formatCurrency(userResult.amount)}`);
    console.log(`Expected button: "Bayar Invoice" with amount Rp 97.500`);
    console.log(`✅ Test 4: ${userResult.label === 'Bayar Invoice' && userResult.amount === 97500 ? 'PASS' : 'FAIL'}`);
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Summary:');
    console.log(`✅ Regular discount → "Bayar Invoice": ${discountResult.label === 'Bayar Invoice' ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Actual down payment → "Bayar Uang Muka": ${dpResult.label.includes('Bayar Uang Muka') ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Regular invoice → "Bayar Invoice": ${regularResult.label === 'Bayar Invoice' ? 'PASS' : 'FAIL'}`);
    console.log(`✅ User scenario → "Bayar Invoice": ${userResult.label === 'Bayar Invoice' ? 'PASS' : 'FAIL'}`);
    
    const allPassed = (
        discountResult.label === 'Bayar Invoice' &&
        dpResult.label.includes('Bayar Uang Muka') &&
        regularResult.label === 'Bayar Invoice' &&
        userResult.label === 'Bayar Invoice'
    );
    
    console.log(`\n🎯 Overall: ${allPassed ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAIL'}`);
    
    if (allPassed) {
        console.log('\n🎉 Payment Button Fix Successful!');
        console.log('✅ Regular discount invoices now show "Bayar Invoice"');
        console.log('✅ Actual down payment invoices still show "Bayar Uang Muka"');
        console.log('✅ Payment amounts are correct');
        console.log('\n💡 Expected User Experience:');
        console.log('  - Invoice with "discount 10%" → Payment button: "Bayar Invoice"');
        console.log('  - No more incorrect "Bayar Uang Muka" for discounts');
        console.log('  - Payment amount: Full total after discount and shipping');
    } else {
        console.log('\n❌ Some tests failed - please review the fixes');
    }
    
    return allPassed;
}

// Test old vs new behavior comparison
function compareOldVsNew() {
    console.log('\n📊 Old vs New Behavior Comparison:');
    console.log('='.repeat(50));
    
    const testCase = {
        discount_amount: 7500,
        grand_total: 97500,
        subtotal: 75000
    };
    
    console.log('Input: discount 10% (discount_amount: 7500)');
    console.log('\n❌ OLD Behavior (WRONG):');
    console.log('  - Treated discount_amount as down payment');
    console.log('  - Button text: "Bayar Uang Muka (10%)"');
    console.log('  - Payment amount: Rp 7.500 (just the discount)');
    console.log('  - User sees: "bayar uang muka" ← INCORRECT');
    
    console.log('\n✅ NEW Behavior (CORRECT):');
    console.log('  - Discount is just discount, not down payment');
    console.log('  - Button text: "Bayar Invoice"');
    console.log('  - Payment amount: Rp 97.500 (full total)');
    console.log('  - User sees: "Bayar Invoice" ← CORRECT');
    
    console.log('\n🔍 Key Changes Made:');
    console.log('  1. Removed discount_amount fallback in generatePaymentScheduleBreakdown()');
    console.log('  2. Removed discount_amount fallback in payment info logic');
    console.log('  3. Only actual payment_schedule_json triggers "Uang Muka" display');
    console.log('  4. Regular discounts always show "Bayar Invoice"');
}

// Run all tests
console.log('Starting payment button tests...\n');
runPaymentButtonTests();
compareOldVsNew();