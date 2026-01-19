#!/bin/bash

echo "🚀 GSAMS Vercel Deployment Script"
echo "=================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found"
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Vercel CLI"
        exit 1
    fi
    echo "✅ Vercel CLI installed"
fi

echo "✅ Vercel CLI found"
echo ""

# Check if git repo has uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes"
    read -p "Do you want to commit and push them? (y/N): " commit_changes
    if [ "$commit_changes" = "y" ] || [ "$commit_changes" = "Y" ]; then
        git add .
        read -p "Enter commit message: " commit_message
        git commit -m "$commit_message"
        git push origin main
        echo "✅ Changes committed and pushed"
    else
        echo "⚠️  Continuing with uncommitted changes..."
    fi
fi

echo ""
echo "🔑 Before deploying, make sure you have:"
echo "  1. MongoDB Atlas connection string"
echo "  2. JWT secret (generate with: openssl rand -base64 32)"
echo "  3. GitHub/GitLab/Bitbucket repository set up"
echo ""

read -p "Do you have all required information? (y/N): " has_info

if [ "$has_info" != "y" ] && [ "$has_info" != "Y" ]; then
    echo ""
    echo "📚 Please read VERCEL_DEPLOYMENT_GUIDE.md for instructions"
    echo "Or run: cat VERCEL_DEPLOYMENT_GUIDE.md | less"
    exit 0
fi

echo ""
echo "📋 Environment Variables Needed:"
echo "  - NODE_ENV"
echo "  - MONGODB_URI"
echo "  - JWT_SECRET"
echo "  - BASE_URL"
echo ""
echo "⚠️  You'll need to add these in Vercel Dashboard after deployment"
echo ""

read -p "Ready to deploy? (y/N): " ready_deploy

if [ "$ready_deploy" != "y" ] && [ "$ready_deploy" != "Y" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Login to Vercel
echo "🔐 Logging in to Vercel..."
vercel login

if [ $? -ne 0 ]; then
    echo "❌ Vercel login failed"
    exit 1
fi

echo "✅ Logged in to Vercel"
echo ""

# Deploy to production
echo "📦 Deploying to production..."
vercel --prod

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📋 Next Steps:"
echo "  1. Go to Vercel Dashboard"
echo "  2. Click on your project"
echo "  3. Go to Settings → Environment Variables"
echo "  4. Add the following variables:"
echo "     - NODE_ENV=production"
echo "     - MONGODB_URI=your-mongodb-atlas-connection-string"
echo "     - JWT_SECRET=generate-random-32-char-string"
echo "     - BASE_URL=https://your-app.vercel.app"
echo "  5. Go to Deployments → Click ... → Redeploy"
echo "  6. Test your deployment at /api/health"
echo "  7. Create admin user in MongoDB"
echo ""
echo "📖 For detailed instructions, see:"
echo "   VERCEL_DEPLOYMENT_GUIDE.md"
echo "   DEPLOYMENT_CHECKLIST.md"
echo ""
echo "🎉 Happy deploying!"
