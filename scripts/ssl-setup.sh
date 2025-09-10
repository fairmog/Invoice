#!/bin/bash

# SSL Certificate Setup Script for AI Invoice Generator

set -e

echo "🔐 SSL Certificate Setup for AI Invoice Generator"
echo "================================================="

# Check if OpenSSL is installed
if ! command -v openssl &> /dev/null; then
    echo "❌ OpenSSL is not installed. Please install OpenSSL and try again."
    echo "   Ubuntu/Debian: sudo apt-get install openssl"
    echo "   CentOS/RHEL: sudo yum install openssl"
    echo "   macOS: brew install openssl"
    exit 1
fi

echo "✅ OpenSSL version: $(openssl version)"

# Create SSL directory
SSL_DIR="ssl"
if [ ! -d "$SSL_DIR" ]; then
    mkdir -p "$SSL_DIR"
    echo "✅ Created SSL directory: $SSL_DIR"
fi

# Certificate files
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"
CONFIG_FILE="$SSL_DIR/openssl.conf"

# Function to generate self-signed certificate
generate_self_signed() {
    echo ""
    echo "🔧 Generating self-signed SSL certificate..."
    
    # Create OpenSSL configuration
    cat > "$CONFIG_FILE" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = ID
ST = Jakarta
L = Jakarta
O = AI Invoice Generator
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Generate private key
    openssl genrsa -out "$KEY_FILE" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "$KEY_FILE" -out "$CERT_FILE" -days 365 -config "$CONFIG_FILE" -extensions v3_req
    
    # Set proper permissions
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    
    echo "✅ Self-signed certificate generated successfully!"
    echo "   Certificate: $CERT_FILE"
    echo "   Private Key: $KEY_FILE"
    echo "   Valid for: 365 days"
    echo ""
    echo "⚠️  This is a self-signed certificate for development only"
    echo "   Your browser will show a security warning"
    echo "   Click 'Advanced' and 'Proceed to localhost' to continue"
}

# Function to generate CSR for CA-signed certificate
generate_csr() {
    echo ""
    echo "📋 Generating Certificate Signing Request (CSR)..."
    
    CSR_FILE="$SSL_DIR/cert.csr"
    
    # Interactive prompts for CSR
    echo "Please enter your certificate details:"
    read -p "Country (2 letter code) [ID]: " COUNTRY
    COUNTRY=${COUNTRY:-ID}
    
    read -p "State/Province [Jakarta]: " STATE
    STATE=${STATE:-Jakarta}
    
    read -p "City [Jakarta]: " CITY
    CITY=${CITY:-Jakarta}
    
    read -p "Organization [AI Invoice Generator]: " ORG
    ORG=${ORG:-"AI Invoice Generator"}
    
    read -p "Domain name (e.g., yourdomain.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        echo "❌ Domain name is required for CSR"
        exit 1
    fi
    
    # Create CSR configuration
    cat > "$CONFIG_FILE" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORG
CN = $DOMAIN

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
EOF

    # Generate private key
    openssl genrsa -out "$KEY_FILE" 2048
    
    # Generate CSR
    openssl req -new -key "$KEY_FILE" -out "$CSR_FILE" -config "$CONFIG_FILE"
    
    # Set proper permissions
    chmod 600 "$KEY_FILE"
    chmod 644 "$CSR_FILE"
    
    echo "✅ CSR generated successfully!"
    echo "   CSR File: $CSR_FILE"
    echo "   Private Key: $KEY_FILE"
    echo ""
    echo "📤 Next steps:"
    echo "   1. Submit $CSR_FILE to your Certificate Authority"
    echo "   2. Download the signed certificate"
    echo "   3. Save it as $CERT_FILE"
    echo "   4. Update your .env file: SSL_ENABLED=true"
}

# Function to install CA-signed certificate
install_ca_cert() {
    echo ""
    echo "📥 Installing CA-signed certificate..."
    
    read -p "Enter path to your certificate file: " CERT_PATH
    if [ ! -f "$CERT_PATH" ]; then
        echo "❌ Certificate file not found: $CERT_PATH"
        exit 1
    fi
    
    read -p "Enter path to your private key file: " KEY_PATH
    if [ ! -f "$KEY_PATH" ]; then
        echo "❌ Private key file not found: $KEY_PATH"
        exit 1
    fi
    
    # Copy files
    cp "$CERT_PATH" "$CERT_FILE"
    cp "$KEY_PATH" "$KEY_FILE"
    
    # Set proper permissions
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    
    echo "✅ CA-signed certificate installed successfully!"
    echo "   Certificate: $CERT_FILE"
    echo "   Private Key: $KEY_FILE"
}

# Function to validate certificate
validate_cert() {
    echo ""
    echo "🔍 Validating SSL certificate..."
    
    if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
        echo "❌ Certificate files not found"
        exit 1
    fi
    
    # Check certificate
    echo "📋 Certificate Information:"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -A2 "Subject:"
    openssl x509 -in "$CERT_FILE" -text -noout | grep -A2 "Validity"
    
    # Check if certificate matches private key
    CERT_HASH=$(openssl x509 -noout -modulus -in "$CERT_FILE" | openssl md5)
    KEY_HASH=$(openssl rsa -noout -modulus -in "$KEY_FILE" | openssl md5)
    
    if [ "$CERT_HASH" = "$KEY_HASH" ]; then
        echo "✅ Certificate and private key match"
    else
        echo "❌ Certificate and private key do not match"
        exit 1
    fi
    
    echo "✅ Certificate validation passed"
}

# Main menu
echo ""
echo "What would you like to do?"
echo "1. Generate self-signed certificate (Development)"
echo "2. Generate CSR for CA-signed certificate (Production)"
echo "3. Install CA-signed certificate"
echo "4. Validate existing certificate"
echo "5. Exit"
echo ""

read -p "Enter your choice (1-5): " CHOICE

case $CHOICE in
    1)
        generate_self_signed
        ;;
    2)
        generate_csr
        ;;
    3)
        install_ca_cert
        ;;
    4)
        validate_cert
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🔧 To enable SSL in your application:"
echo "   1. Edit your .env file"
echo "   2. Set SSL_ENABLED=true"
echo "   3. Set SSL_CERT_PATH=./ssl/cert.pem"
echo "   4. Set SSL_KEY_PATH=./ssl/key.pem"
echo "   5. Restart your application"
echo ""
echo "✅ SSL setup completed!"