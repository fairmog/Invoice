#!/bin/bash

# AI Invoice Generator Deployment Script
# This script helps deploy the application to production

set -e

echo "🚀 AI Invoice Generator Deployment Script"
echo "=========================================="

# Check if environment is specified
if [ -z "$1" ]; then
    echo "❌ Usage: $0 <environment> [options]"
    echo "   Environments: development, staging, production"
    echo "   Options:"
    echo "     --skip-backup   Skip database backup"
    echo "     --skip-install  Skip npm install"
    echo "     --skip-build    Skip build process"
    exit 1
fi

ENVIRONMENT=$1
SKIP_BACKUP=${2:-false}
SKIP_INSTALL=${3:-false}
SKIP_BUILD=${4:-false}

echo "🎯 Target Environment: $ENVIRONMENT"
echo "📅 Deployment Date: $(date)"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo "📝 Please edit .env file with your configuration before continuing"
        echo "   Required variables:"
        echo "   - OPENAI_API_KEY"
        echo "   - SMTP_USER and SMTP_PASS (for email)"
        echo "   - MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY (for payments)"
        exit 1
    else
        echo "❌ .env.example file not found"
        exit 1
    fi
fi

# Update environment in .env file
echo "🔧 Updating NODE_ENV to $ENVIRONMENT..."
if grep -q "NODE_ENV=" .env; then
    sed -i "s/NODE_ENV=.*/NODE_ENV=$ENVIRONMENT/" .env
else
    echo "NODE_ENV=$ENVIRONMENT" >> .env
fi

# Backup database if not skipped
if [ "$SKIP_BACKUP" != "--skip-backup" ]; then
    echo "💾 Creating database backup..."
    if [ -f database.json ]; then
        BACKUP_DIR="backups/$(date +%Y-%m-%d)"
        mkdir -p "$BACKUP_DIR"
        cp database.json "$BACKUP_DIR/database-$(date +%H-%M-%S).json"
        echo "✅ Database backed up to $BACKUP_DIR/"
    else
        echo "⚠️  No database.json found to backup"
    fi
fi

# Install dependencies if not skipped
if [ "$SKIP_INSTALL" != "--skip-install" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
    echo "✅ Dependencies installed"
fi

# Run build process if not skipped
if [ "$SKIP_BUILD" != "--skip-build" ]; then
    echo "🔨 Running build process..."
    # Add any build commands here if needed
    echo "✅ Build completed"
fi

# Validate configuration
echo "🔍 Validating configuration..."
node -e "
import('./config.js').then(({ default: config }) => {
  console.log('Environment:', config.env);
  console.log('OpenAI API Key:', config.ai.openaiApiKey ? '✅ Configured' : '❌ Missing');
  console.log('Email Service:', config.email.user ? '✅ Configured' : '⚠️  Not configured');
  console.log('Payment Gateway:', config.payment.midtrans.serverKey ? '✅ Configured' : '⚠️  Not configured');
}).catch(console.error);
"

# Production-specific checks
if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    echo "🔒 Production Environment Checks:"
    
    # Check SSL configuration
    if grep -q "SSL_ENABLED=true" .env; then
        echo "✅ SSL enabled"
        if [ -f ssl/cert.pem ] && [ -f ssl/key.pem ]; then
            echo "✅ SSL certificates found"
        else
            echo "❌ SSL certificates not found in ssl/ directory"
            exit 1
        fi
    else
        echo "⚠️  SSL not enabled (recommended for production)"
    fi
    
    # Check security settings
    if grep -q "DEBUG_MODE=false" .env; then
        echo "✅ Debug mode disabled"
    else
        echo "⚠️  Debug mode should be disabled in production"
    fi
    
    # Check JWT secret
    if grep -q "JWT_SECRET=your_jwt_secret_key_here" .env; then
        echo "❌ Default JWT secret detected - please change it"
        exit 1
    else
        echo "✅ JWT secret configured"
    fi
fi

echo ""
echo "🎉 Deployment preparation completed!"
echo ""
echo "🚀 To start the application:"
echo "   npm run web"
echo ""
echo "🔧 To monitor the application:"
echo "   tail -f logs/app.log"
echo ""
echo "📊 Access points:"
echo "   • Main Interface: http://localhost:3000"
echo "   • Merchant Dashboard: http://localhost:3000/merchant"
echo "   • Customer Portal: http://localhost:3000/customer"
echo "   • Health Check: http://localhost:3000/api/health"
echo ""
echo "📋 Post-deployment checklist:"
echo "   □ Test main interface functionality"
echo "   □ Verify email notifications (if configured)"
echo "   □ Test payment processing (if configured)"
echo "   □ Check all API endpoints"
echo "   □ Monitor server logs for errors"
echo "   □ Verify SSL certificate (if enabled)"
echo ""
echo "✅ Deployment script completed successfully!"