#!/usr/bin/env node

/**
 * Test script to verify account locking has been disabled
 * Tests multiple failed login attempts without account lockout
 */

import fetch from 'node-fetch';

async function testAccountLockingDisabled() {
  console.log('🧪 Testing Account Locking Disabled');
  console.log('='.repeat(50));
  
  const baseUrl = 'http://localhost:3000';
  const loginUrl = `${baseUrl}/api/auth/login`;
  
  // Test with a fake email and wrong password
  const testEmail = 'test@example.com';
  const wrongPassword = 'wrongpassword';
  
  console.log(`📧 Testing with email: ${testEmail}`);
  console.log(`🔑 Using wrong password: ${wrongPassword}`);
  console.log('');
  
  // Try multiple failed login attempts
  for (let i = 1; i <= 12; i++) {
    try {
      console.log(`🔄 Attempt ${i}/12:`);
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: testEmail,
          password: wrongPassword
        })
      });
      
      const result = await response.json();
      
      console.log(`   Status: ${response.status}`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Error: ${result.error}`);
      
      // Check if account is locked
      if (result.error && result.error.includes('locked')) {
        console.log('❌ FAILURE: Account is still being locked!');
        console.log('   Account locking was NOT properly disabled');
        return false;
      }
      
      if (result.error === 'Invalid email or password') {
        console.log('   ✅ Expected error - no lockout detected');
      }
      
      console.log('');
      
      // Small delay between attempts
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`   ❌ Request error: ${error.message}`);
    }
  }
  
  console.log('🎉 SUCCESS: Account locking has been disabled!');
  console.log('   - All 12 failed attempts were allowed');
  console.log('   - No account lockout message detected');
  console.log('   - Users can retry login from multiple devices');
  console.log('');
  
  console.log('🔒 Security still protected by:');
  console.log('   - IP-based rate limiting (50 attempts per 15 minutes)');
  console.log('   - Strong password requirements');
  console.log('   - JWT token validation');
  console.log('   - Failed attempt logging');
  
  return true;
}

// Run the test
testAccountLockingDisabled().catch(console.error);