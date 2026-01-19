#!/bin/bash

echo "🔧 GSAMS Environment Setup"
echo "=========================="
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "❌ Setup cancelled."
        exit 0
    fi
fi

echo "Choose MongoDB setup option:"
echo "1. Local MongoDB (127.0.0.1:27017)"
echo "2. MongoDB Atlas (you provide connection string)"
echo "3. Keep trying the old cluster (not recommended)"
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "Setting up for local MongoDB..."
        MONGODB_URI="mongodb://127.0.0.1:27017/gsams"
        ;;
    2)
        echo "Enter your MongoDB Atlas connection string:"
        echo "Example: mongodb+srv://username:password@cluster.mongodb.net/database"
        read -p "Connection string: " atlas_uri
        MONGODB_URI="$atlas_uri"
        ;;
    3)
        echo "Using old cluster (may not work)..."
        MONGODB_URI="mongodb+srv://prezent:prezent@prezent.pw70dzq.mongodb.net/prezent"
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

# Generate random JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# Server Configuration
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

# MongoDB Configuration
MONGODB_URI=$MONGODB_URI

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Twilio Configuration (Optional - for SMS features)
# TWILIO_ACCOUNT_SID=your-twilio-account-sid
# TWILIO_AUTH_TOKEN=your-twilio-auth-token
# TWILIO_PHONE_NUMBER=+1234567890
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "Configuration:"
echo "  MongoDB: $MONGODB_URI"
echo "  Port: 5000"
echo "  JWT Secret: (generated randomly)"
echo ""

if [ "$choice" == "1" ]; then
    echo "⚠️  Make sure MongoDB is running locally:"
    echo "   brew services start mongodb-community"
    echo ""
    echo "   Or install it with:"
    echo "   brew tap mongodb/brew"
    echo "   brew install mongodb-community"
    echo ""
fi

echo "🚀 Next steps:"
echo "1. Start the server: npm start"
echo "2. Open browser: http://localhost:5000"
echo ""
echo "📖 For more help, see: MONGODB_SETUP_GUIDE.md"
