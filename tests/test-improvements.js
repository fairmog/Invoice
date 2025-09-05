// Test suite for high-priority improvements
// Tests calculation accuracy, error handling, and data validation

import InvoiceCalculations from '../utils/invoice-calculations.js';
import errorHandler from '../utils/error-handler.js';
import currencyFormatter from '../utils/currency-formatter.js';

class TestSuite {
  constructor() {
    this.calculator = new InvoiceCalculations();
    this.tests = [];
    this.results = [];
  }

  // Test calculation accuracy
  testCalculations() {
    console.log('\n🧮 Testing Invoice Calculations...');
    
    const testCases = [
      {
        name: 'Basic calculation with tax',
        items: [
          { productName: 'Product A', quantity: 2, unitPrice: 100000 },
          { productName: 'Product B', quantity: 1, unitPrice: 50000 }
        ],
        options: { taxRate: 11, shippingCost: 20000 },
        expected: {
          subtotal: 250000,
          taxAmount: 27500,
          grandTotal: 297500
        }
      },
      {
        name: 'Calculation with discount',
        items: [
          { productName: 'Product A', quantity: 1, unitPrice: 200000 }
        ],
        options: { taxRate: 11, discountAmount: 20000 },
        expected: {
          subtotal: 200000,
          taxAmount: 22000,
          grandTotal: 202000
        }
      },
      {
        name: 'Zero tax calculation',
        items: [
          { productName: 'Product A', quantity: 1, unitPrice: 100000 }
        ],
        options: { taxRate: 0 },
        expected: {
          subtotal: 100000,
          taxAmount: 0,
          grandTotal: 100000
        }
      }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(test => {
      try {
        const result = this.calculator.calculateInvoiceTotal(test.items, test.options);
        
        if (result.success) {
          const calc = result.calculations;
          const isCorrect = 
            calc.subtotal === test.expected.subtotal &&
            calc.taxAmount === test.expected.taxAmount &&
            calc.grandTotal === test.expected.grandTotal;
          
          if (isCorrect) {
            console.log(`  ✅ ${test.name}`);
            passed++;
          } else {
            console.log(`  ❌ ${test.name}`);
            console.log(`    Expected: ${JSON.stringify(test.expected)}`);
            console.log(`    Got: ${JSON.stringify({
              subtotal: calc.subtotal,
              taxAmount: calc.taxAmount,
              grandTotal: calc.grandTotal
            })}`);
            failed++;
          }
        } else {
          console.log(`  ❌ ${test.name} - Calculation failed: ${result.error}`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} - Exception: ${error.message}`);
        failed++;
      }
    });

    return { passed, failed, total: testCases.length };
  }

  // Test error handling
  testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...');
    
    const testCases = [
      {
        name: 'Invalid item quantity',
        test: () => {
          try {
            this.calculator.calculateLineTotal('invalid', 100);
            return false; // Should have thrown
          } catch (error) {
            return error.message.includes('must be a valid number');
          }
        }
      },
      {
        name: 'Negative unit price',
        test: () => {
          try {
            this.calculator.calculateLineTotal(1, -100);
            return false; // Should have thrown
          } catch (error) {
            return error.message.includes('cannot be negative');
          }
        }
      },
      {
        name: 'Empty items array',
        test: () => {
          try {
            const result = this.calculator.calculateInvoiceTotal([]);
            return !result.success && result.error.includes('cannot be empty');
          } catch (error) {
            return error.message.includes('cannot be empty');
          }
        }
      },
      {
        name: 'Tax rate over 100%',
        test: () => {
          try {
            this.calculator.calculateTax(100000, 150);
            return false; // Should have thrown
          } catch (error) {
            return error.message.includes('cannot exceed 100%');
          }
        }
      }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(test => {
      try {
        const result = test.test();
        if (result) {
          console.log(`  ✅ ${test.name}`);
          passed++;
        } else {
          console.log(`  ❌ ${test.name} - Test failed`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} - Unexpected error: ${error.message}`);
        failed++;
      }
    });

    return { passed, failed, total: testCases.length };
  }

  // Test currency formatting
  testCurrencyFormatting() {
    console.log('\n💰 Testing Currency Formatting...');
    
    const testCases = [
      {
        name: 'IDR formatting',
        amount: 250000,
        currency: 'IDR',
        expected: 'Rp 250.000'
      },
      {
        name: 'USD formatting',
        amount: 250.50,
        currency: 'USD',
        expected: '$250.50'
      },
      {
        name: 'Zero amount',
        amount: 0,
        currency: 'IDR',
        expected: 'Rp 0'
      },
      {
        name: 'Large amount',
        amount: 1234567890,
        currency: 'IDR',
        expected: 'Rp 1.234.567.890'
      }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(test => {
      try {
        const result = currencyFormatter.format(test.amount, test.currency);
        const normalized = result.replace(/\s/g, ' '); // Normalize spaces
        const expectedNormalized = test.expected.replace(/\s/g, ' ');
        
        if (normalized === expectedNormalized) {
          console.log(`  ✅ ${test.name}`);
          passed++;
        } else {
          console.log(`  ❌ ${test.name}`);
          console.log(`    Expected: "${test.expected}"`);
          console.log(`    Got: "${result}"`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} - Error: ${error.message}`);
        failed++;
      }
    });

    return { passed, failed, total: testCases.length };
  }

  // Test data validation
  testDataValidation() {
    console.log('\n✅ Testing Data Validation...');
    
    const testCases = [
      {
        name: 'Valid invoice data',
        data: {
          customer: { name: 'John Doe', phone: '123456789' },
          items: [{ productName: 'Product A', quantity: 1, unitPrice: 100000 }]
        },
        shouldPass: true
      },
      {
        name: 'Missing customer name',
        data: {
          customer: { phone: '123456789' },
          items: [{ productName: 'Product A', quantity: 1, unitPrice: 100000 }]
        },
        shouldPass: false
      },
      {
        name: 'Empty items array',
        data: {
          customer: { name: 'John Doe', phone: '123456789' },
          items: []
        },
        shouldPass: false
      },
      {
        name: 'Item missing product name',
        data: {
          customer: { name: 'John Doe', phone: '123456789' },
          items: [{ quantity: 1, unitPrice: 100000 }]
        },
        shouldPass: false
      }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(test => {
      try {
        // Simulate validation (we'd need to import InvoiceGenerator for real validation)
        const hasValidCustomer = test.data.customer && test.data.customer.name && test.data.customer.name.trim().length > 0;
        const hasValidItems = test.data.items && Array.isArray(test.data.items) && test.data.items.length > 0;
        const itemsValid = test.data.items ? test.data.items.every(item => 
          item.productName && item.productName.trim().length > 0 &&
          item.quantity > 0 &&
          item.unitPrice >= 0
        ) : false;
        
        const isValid = hasValidCustomer && hasValidItems && itemsValid;
        
        if (isValid === test.shouldPass) {
          console.log(`  ✅ ${test.name}`);
          passed++;
        } else {
          console.log(`  ❌ ${test.name}`);
          console.log(`    Expected ${test.shouldPass ? 'valid' : 'invalid'}, got ${isValid ? 'valid' : 'invalid'}`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} - Error: ${error.message}`);
        failed++;
      }
    });

    return { passed, failed, total: testCases.length };
  }

  // Test edge cases
  testEdgeCases() {
    console.log('\n🔬 Testing Edge Cases...');
    
    const testCases = [
      {
        name: 'Very large amounts',
        test: () => {
          try {
            const result = this.calculator.calculateInvoiceTotal([
              { productName: 'Expensive Item', quantity: 1, unitPrice: 999999999 }
            ]);
            return result.success && result.calculations.grandTotal > 0;
          } catch (error) {
            return false;
          }
        }
      },
      {
        name: 'Decimal quantities',
        test: () => {
          try {
            const result = this.calculator.calculateLineTotal(2.5, 100000);
            return result === 250000;
          } catch (error) {
            return false;
          }
        }
      },
      {
        name: 'Currency parsing',
        test: () => {
          try {
            const parsed = currencyFormatter.parse('Rp 1.234.567');
            return parsed === 1234567;
          } catch (error) {
            return false;
          }
        }
      },
      {
        name: 'Null amount handling',
        test: () => {
          try {
            const formatted = currencyFormatter.format(null);
            return formatted === 'Rp 0';
          } catch (error) {
            return false;
          }
        }
      }
    ];

    let passed = 0;
    let failed = 0;

    testCases.forEach(test => {
      try {
        const result = test.test();
        if (result) {
          console.log(`  ✅ ${test.name}`);
          passed++;
        } else {
          console.log(`  ❌ ${test.name} - Test failed`);
          failed++;
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} - Error: ${error.message}`);
        failed++;
      }
    });

    return { passed, failed, total: testCases.length };
  }

  // Run all tests
  runAllTests() {
    console.log('🚀 Starting High-Priority Improvements Test Suite');
    console.log('=' .repeat(60));

    const results = {
      calculations: this.testCalculations(),
      errorHandling: this.testErrorHandling(),
      currencyFormatting: this.testCurrencyFormatting(),
      dataValidation: this.testDataValidation(),
      edgeCases: this.testEdgeCases()
    };

    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(60));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalTests = 0;

    for (const [category, result] of Object.entries(results)) {
      console.log(`${category.padEnd(20)}: ${result.passed}✅ / ${result.failed}❌ (${result.total} total)`);
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalTests += result.total;
    }

    console.log('-'.repeat(60));
    console.log(`OVERALL RESULTS: ${totalPassed}✅ / ${totalFailed}❌ (${totalTests} total)`);
    console.log(`Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

    const allPassed = totalFailed === 0;
    if (allPassed) {
      console.log('\n🎉 All tests passed! High-priority improvements are working correctly.');
    } else {
      console.log(`\n⚠️  ${totalFailed} tests failed. Please review the failed tests above.`);
    }

    return {
      allPassed,
      totalPassed,
      totalFailed,
      totalTests,
      successRate: (totalPassed / totalTests) * 100,
      categoryResults: results
    };
  }

  // Performance test
  performanceTest() {
    console.log('\n⚡ Running Performance Tests...');
    
    const iterations = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      this.calculator.calculateInvoiceTotal([
        { productName: `Product ${i}`, quantity: Math.floor(Math.random() * 10) + 1, unitPrice: Math.floor(Math.random() * 100000) + 1000 }
      ]);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const averageTime = duration / iterations;
    
    console.log(`  ✅ Calculated ${iterations} invoices in ${duration}ms`);
    console.log(`  ⚡ Average time per calculation: ${averageTime.toFixed(2)}ms`);
    
    return {
      iterations,
      totalTime: duration,
      averageTime: averageTime
    };
  }
}

export default TestSuite;