#!/bin/bash

# AI Invoice Generator Setup Script
# Initial setup for development environment

set -e

echo "🔧 AI Invoice Generator Setup Script"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ Node.js version: v$NODE_VERSION"
echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p backups
mkdir -p ssl
mkdir -p temp

# Set up environment file
if [ ! -f .env ]; then
    echo ""
    echo "⚙️  Setting up environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo ""
    echo "📝 IMPORTANT: Please edit .env file with your configuration:"
    echo "   1. Set your OPENAI_API_KEY (required)"
    echo "   2. Configure email settings (optional but recommended)"
    echo "   3. Set up payment gateway credentials (optional)"
    echo "   4. Update merchant information"
    echo ""
    echo "   Example:"
    echo "   OPENAI_API_KEY=your_actual_api_key_here"
    echo "   SMTP_USER=your_email@gmail.com"
    echo "   SMTP_PASS=your_app_password"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Create initial database if it doesn't exist
if [ ! -f database.json ]; then
    echo ""
    echo "💾 Creating initial database..."
    cat > database.json << EOF
{
  "invoices": [],
  "customers": [],
  "products": [
    {
      "id": 1,
      "sku": "IPHONE15PRO",
      "name": "iPhone 15 Pro",
      "description": "Latest iPhone with Pro features",
      "category": "Smartphones",
      "unit_price": 16500000,
      "cost_price": 14000000,
      "stock_quantity": 25,
      "min_stock_level": 5,
      "is_active": true,
      "tax_rate": 11,
      "dimensions": "14.7 x 7.1 x 0.8",
      "weight": 0.187,
      "image_url": "",
      "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
      "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
    }
  ],
  "invoice_items": [],
  "orders": [],
  "order_items": [],
  "access_logs": [],
  "lastId": {
    "invoices": 0,
    "customers": 0,
    "products": 1,
    "invoice_items": 0,
    "orders": 0,
    "order_items": 0,
    "access_logs": 0
  }
}
EOF
    echo "✅ Initial database created"
else
    echo "✅ Database already exists"
fi

# Make scripts executable
if [ -f scripts/deploy.sh ]; then
    chmod +x scripts/deploy.sh
    echo "✅ Made deploy.sh executable"
fi

if [ -f scripts/backup.sh ]; then
    chmod +x scripts/backup.sh
    echo "✅ Made backup.sh executable"
fi

# Run configuration validation
echo ""
echo "🔍 Validating setup..."
node -e "
import('./config.js').then(({ default: config }) => {
  console.log('✅ Configuration loaded successfully');
  console.log('Environment:', config.env);
  console.log('Port:', config.server.port);
  console.log('Features enabled:', Object.keys(config.features).filter(k => config.features[k]).join(', '));
}).catch(error => {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
});
"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit .env file with your configuration"
echo "   2. Run: npm run web"
echo "   3. Open: http://localhost:3000"
echo ""
echo "📚 Documentation:"
echo "   • README.md - General usage"
echo "   • .env.example - Configuration options"
echo "   • AI-Invoice-Gen-Wrapup.md - Project status"
echo ""
echo "🔧 Available scripts:"
echo "   • npm run web - Start the web server"
echo "   • ./scripts/deploy.sh - Deploy to different environments"
echo "   • ./scripts/backup.sh - Backup database"
echo ""
echo "✅ Setup completed! You're ready to start generating invoices with AI!"