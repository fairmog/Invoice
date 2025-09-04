#!/usr/bin/env node

import dotenv from 'dotenv';
import CloudinaryService from '../src/cloudinary-service.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testCloudinary() {
  console.log('🚀 Testing Cloudinary service...');
  
  const cloudinaryService = new CloudinaryService();
  
  // Test connection
  const connectionTest = await cloudinaryService.testConnection();
  
  if (connectionTest.success) {
    console.log('✅ Cloudinary service is ready!');
    console.log('📝 Configuration:');
    console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY}`);
    console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET?.substring(0, 10)}...`);
    
    return true;
  } else {
    console.error('❌ Cloudinary connection failed:', connectionTest.error);
    return false;
  }
}

// Run test
testCloudinary().catch(console.error);
