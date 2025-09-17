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
          cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.'), false);
        }
      }
    });
  }

  // Upload image to Cloudinary
  async uploadImage(buffer, options = {}) {
    try {
      const uploadOptions = {
        resource_type: 'image',
        folder: options.folder || 'ai-invoice-generator',
        public_id: options.filename || `upload_${Date.now()}`,
        overwrite: true,
        transformation: options.transformations || [
          { width: 800, height: 600, crop: 'limit' },
          { quality: 'auto:good' },
          { format: 'auto' }
        ]
      };

      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              resolve({
                success: false,
                error: error.message
              });
            } else {
              console.log('✅ Cloudinary upload successful:', result.secure_url);
              resolve({
                success: true,
                url: result.secure_url,
                publicId: result.public_id
              });
            }
          }
        ).end(buffer);
      });
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload business logo with specific formatting
  async uploadBusinessLogo(buffer, businessName, merchantId) {
    const options = {
      filename: `merchant_${merchantId}_business_logo_${Date.now()}`,
      folder: 'ai-invoice-generator/business-logos',
      transformations: [
        { width: 300, height: 300, crop: 'limit' },
        { quality: 'auto:good' },
        { format: 'auto' }
      ]
    };

    return this.uploadImage(buffer, options);
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('🗑️ Cloudinary delete result:', result);

      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default CloudinaryService;
