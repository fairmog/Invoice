#!/bin/bash

# AI Invoice Generator Database Backup Script

set -e

echo "💾 AI Invoice Generator Database Backup"
echo "======================================"

# Configuration
BACKUP_DIR="backups/$(date +%Y-%m-%d)"
TIMESTAMP=$(date +%H-%M-%S)
DATABASE_FILE="database.json"
BACKUP_FILE="$BACKUP_DIR/database-$TIMESTAMP.json"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DATABASE_FILE" ]; then
    echo "❌ Database file $DATABASE_FILE not found"
    exit 1
fi

# Create backup
echo "📋 Creating backup..."
cp "$DATABASE_FILE" "$BACKUP_FILE"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

# Get file size and record count
DATABASE_SIZE=$(stat -c%s "$DATABASE_FILE" 2>/dev/null || stat -f%z "$DATABASE_FILE" 2>/dev/null)
BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)

# Count records
INVOICE_COUNT=$(node -e "
import('./database.json', { assert: { type: 'json' } }).then(({ default: db }) => {
  console.log(db.invoices ? db.invoices.length : 0);
}).catch(() => console.log('0'));
")

CUSTOMER_COUNT=$(node -e "
import('./database.json', { assert: { type: 'json' } }).then(({ default: db }) => {
  console.log(db.customers ? db.customers.length : 0);
}).catch(() => console.log('0'));
")

PRODUCT_COUNT=$(node -e "
import('./database.json', { assert: { type: 'json' } }).then(({ default: db }) => {
  console.log(db.products ? db.products.length : 0);
}).catch(() => console.log('0'));
")

echo "✅ Backup created successfully!"
echo ""
echo "📊 Backup Summary:"
echo "   • File: $BACKUP_FILE"
echo "   • Original size: $(($DATABASE_SIZE / 1024)) KB"
echo "   • Compressed size: $(($BACKUP_SIZE / 1024)) KB"
echo "   • Compression ratio: $(( (100 * ($DATABASE_SIZE - $BACKUP_SIZE)) / $DATABASE_SIZE ))%"
echo "   • Invoices: $INVOICE_COUNT"
echo "   • Customers: $CUSTOMER_COUNT"
echo "   • Products: $PRODUCT_COUNT"
echo "   • Created: $(date)"
echo ""

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups..."
find backups -name "*.gz" -type f -mtime +7 -delete 2>/dev/null || true
find backups -type d -empty -delete 2>/dev/null || true

REMAINING_BACKUPS=$(find backups -name "*.gz" -type f | wc -l)
echo "✅ Cleanup completed. $REMAINING_BACKUPS backup files remaining."

echo ""
echo "🔄 To restore from this backup:"
echo "   gunzip -c $BACKUP_FILE > database.json"
echo ""
echo "📅 Backup completed successfully!"