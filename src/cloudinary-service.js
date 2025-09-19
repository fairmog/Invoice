import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';

class CloudinaryService {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });

    console.log('🔧 Cloudinary configured for cloud:', process.env.CLOUDINARY_CLOUD_NAME);
  }

  // Configure multer to use memory storage for Cloudinary upload
  getMulterConfig() {
    const storage = multer.memoryStorage();
    
    return multer({
      storage: storage,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow images only
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPG, PNG, GIF, and WebP images are allowed.'));
        }
      }
    });
  }

  // Upload image to Cloudinary
  async uploadImage(fileBuffer, options = {}) {
    try {
      // Generate merchant-specific public ID for better isolation and cache management
      const timestamp = Date.now();
      const merchantId = options.merchantId || 'unknown';
      const publicId = options.filename || `merchant_${merchantId}_logo_${timestamp}`;
      
      const defaultOptions = {
        folder: `ai-invoice-generator/business-logos/merchant_${merchantId}`,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        format: 'webp', // Auto-convert to WebP for optimization
        quality: 'auto:good',
        fetch_format: 'auto',
        transformation: [
          { width: 800, height: 600, crop: 'limit' }, // Limit maximum size
          { quality: 'auto:good' }, // Automatic quality optimization
          { fetch_format: 'auto' } // Automatic format selection
        ]
      };

      const uploadOptions = { ...defaultOptions, ...options };

      console.log('📤 Uploading image to Cloudinary...');
      
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log('✅ Image uploaded successfully:', result.public_id);
              resolve(result);
            }
          }
        ).end(fileBuffer);
      });

      // Add timestamp for cache-busting
      const cacheBustUrl = `${result.secure_url}?v=${timestamp}`;
      
      return {
        success: true,
        url: cacheBustUrl,
        originalUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        timestamp: timestamp,
        cloudinaryResult: result
      };

    } catch (error) {
      console.error('❌ Failed to upload image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      console.log('🗑️  Deleting image from Cloudinary:', publicId);
      
      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        console.log('✅ Image deleted successfully:', publicId);
        return { success: true };
      } else {
        console.warn('⚠️  Image deletion result:', result.result);
        return { success: false, error: `Deletion result: ${result.result}` };
      }

    } catch (error) {
      console.error('❌ Failed to delete image:', error);
      return { success: false, error: error.message };
    }
  }

  // Generate optimized URL with transformations
  generateOptimizedUrl(publicId, options = {}) {
    const defaultTransformations = {
      quality: 'auto:good',
      fetch_format: 'auto'
    };

    const transformations = { ...defaultTransformations, ...options };
    
    return cloudinary.url(publicId, transformations);
  }

  // Generate multiple image sizes (for responsive images)
  generateResponsiveUrls(publicId) {
    const sizes = [
      { name: 'thumbnail', width: 150, height: 150 },
      { name: 'small', width: 300, height: 200 },
      { name: 'medium', width: 600, height: 400 },
      { name: 'large', width: 1200, height: 800 }
    ];

    const urls = {};
    
    sizes.forEach(size => {
      urls[size.name] = cloudinary.url(publicId, {
        width: size.width,
        height: size.height,
        crop: 'limit',
        quality: 'auto:good',
        fetch_format: 'auto'
      });
    });

    return urls;
  }

  // Upload business logo specifically
  async uploadBusinessLogo(fileBuffer, businessName = 'business', merchantId = null, oldPublicId = null) {
    try {
      // Delete old logo first if it exists
      if (oldPublicId) {
        console.log('🗑️  Deleting old logo before upload:', oldPublicId);
        const deleteResult = await this.deleteImage(oldPublicId);
        if (deleteResult.success) {
          console.log('✅ Old logo deleted successfully');
        } else {
          console.warn('⚠️  Failed to delete old logo:', deleteResult.error);
        }
      }

      // Create merchant-specific filename and upload
      const timestamp = Date.now();
      const filename = merchantId ? 
        `merchant_${merchantId}_logo_${timestamp}` : 
        `logo_${businessName.replace(/\s+/g, '_').toLowerCase()}_${timestamp}`;
      
      return await this.uploadImage(fileBuffer, {
        filename: filename,
        merchantId: merchantId,
        folder: merchantId ? `ai-invoice-generator/business-logos/merchant_${merchantId}` : 'ai-invoice-generator/business-logos',
        transformation: [
          { width: 400, height: 300, crop: 'limit' }, // Reasonable size for business logos
          { quality: 'auto:best' }, // Better quality for logos
          { background: 'white', extend: 'background' }, // Add white background if needed
          { fetch_format: 'auto' }
        ]
      });
    } catch (error) {
      console.error('❌ Error in uploadBusinessLogo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get image info from Cloudinary
  async getImageInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        success: true,
        info: {
          publicId: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
          createdAt: result.created_at,
          updatedAt: result.updated_at
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test Cloudinary connection
  async testConnection() {
    try {
      console.log('🔗 Testing Cloudinary connection...');
      
      // Try to get cloud details
      const result = await cloudinary.api.ping();
      
      if (result.status === 'ok') {
        console.log('✅ Cloudinary connection successful!');
        return { success: true, message: 'Connection successful' };
      } else {
        console.log('⚠️  Cloudinary connection issue:', result);
        return { success: false, error: 'Ping failed' };
      }

    } catch (error) {
      console.error('❌ Cloudinary connection failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default CloudinaryService;