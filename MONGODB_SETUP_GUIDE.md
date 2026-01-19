# MongoDB Connection Setup Guide

## Current Issue
```
❌ MongoDB connection error: querySrv ETIMEOUT _mongodb._tcp.prezent.pw70dzq.mongodb.net
```

This error means the application cannot connect to your MongoDB Atlas cluster.

---

## Solution Options

### Option 1: Fix MongoDB Atlas Connection (Recommended)

#### Step 1: Check MongoDB Atlas Cluster Status
1. Go to https://cloud.mongodb.com/
2. Log in to your account
3. Check if the cluster `prezent` is:
   - ✅ Running (not paused)
   - ✅ In the correct project
   - ✅ Accessible from your IP

#### Step 2: Update IP Whitelist
1. In MongoDB Atlas, go to **Network Access**
2. Click **Add IP Address**
3. Either:
   - Click **Allow Access from Anywhere** (0.0.0.0/0) - For development only
   - Or add your current IP address

#### Step 3: Verify Connection String
1. In MongoDB Atlas, click **Connect** on your cluster
2. Choose **Connect your application**
3. Copy the connection string
4. Create a `.env` file in the project root:

```env
# Create this file: /Users/sph/Desktop/hello/gsb/.env

PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

# Replace with your actual MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/YOUR_DATABASE?retryWrites=true&w=majority

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important:** Replace:
- `YOUR_USERNAME` with your MongoDB username
- `YOUR_PASSWORD` with your MongoDB password
- `YOUR_CLUSTER` with your cluster address
- `YOUR_DATABASE` with your database name (e.g., `gsams` or `prezent`)

#### Step 4: Restart the Server
```bash
cd /Users/sph/Desktop/hello/gsb
npm start
```

---

### Option 2: Install Local MongoDB

If you want to use a local MongoDB database for development:

#### Step 1: Install MongoDB (macOS)

**Using Homebrew:**
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install MongoDB Community Edition
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community
```

**Or Download Directly:**
1. Go to https://www.mongodb.com/try/download/community
2. Download MongoDB Community Server for macOS
3. Follow installation instructions

#### Step 2: Verify MongoDB is Running
```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Or try connecting
mongosh
```

#### Step 3: Update .env File
Create `/Users/sph/Desktop/hello/gsb/.env`:
```env
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

# Local MongoDB (default)
MONGODB_URI=mongodb://127.0.0.1:27017/gsams

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

#### Step 4: Restart Server
```bash
cd /Users/sph/Desktop/hello/gsb
npm start
```

---

### Option 3: Use MongoDB Atlas Free Tier (New Cluster)

If your current cluster is unavailable, create a new one:

#### Step 1: Create New MongoDB Atlas Account/Cluster
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up or log in
3. Click **Build a Database**
4. Choose **FREE** (M0) tier
5. Select a cloud provider and region (choose closest to you)
6. Name your cluster (e.g., `gsams-cluster`)
7. Click **Create**

#### Step 2: Create Database User
1. Go to **Database Access**
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Username: `gsams_admin` (or your choice)
5. Password: Generate a secure password (save it!)
6. Database User Privileges: **Read and write to any database**
7. Click **Add User**

#### Step 3: Whitelist Your IP
1. Go to **Network Access**
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (0.0.0.0/0)
   - Note: For production, restrict to specific IPs
4. Click **Confirm**

#### Step 4: Get Connection String
1. Go to **Database** → Click **Connect**
2. Choose **Connect your application**
3. Driver: **Node.js**, Version: **4.1 or later**
4. Copy the connection string

Example:
```
mongodb+srv://gsams_admin:<password>@gsams-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

#### Step 5: Create .env File
Create `/Users/sph/Desktop/hello/gsb/.env`:
```env
PORT=5000
NODE_ENV=development
BASE_URL=http://localhost:5000

# Replace <password> with your actual password
MONGODB_URI=mongodb+srv://gsams_admin:<password>@gsams-cluster.xxxxx.mongodb.net/gsams?retryWrites=true&w=majority

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important:** Replace `<password>` with your actual database user password!

#### Step 6: Restart Server
```bash
cd /Users/sph/Desktop/hello/gsb
npm start
```

---

## Quick Troubleshooting

### Check if .env file exists
```bash
ls -la /Users/sph/Desktop/hello/gsb/.env
```

If it doesn't exist, create it using one of the options above.

### Test MongoDB Connection
Create a test file:

```javascript
// test-mongodb.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gsams';

console.log('Testing connection to:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Failed:', err.message);
    process.exit(1);
  });
```

Run it:
```bash
node test-mongodb.js
```

### Common Errors and Solutions

#### Error: `ETIMEOUT` or `querySrv ETIMEOUT`
**Cause:** Cannot reach MongoDB server
**Solutions:**
- Check internet connection
- Verify MongoDB Atlas cluster is running
- Check IP whitelist in MongoDB Atlas
- Try local MongoDB instead

#### Error: `Authentication failed`
**Cause:** Wrong username or password
**Solutions:**
- Verify credentials in MongoDB Atlas
- Make sure password is URL-encoded (replace special characters)
- Update .env file with correct credentials

#### Error: `ECONNREFUSED`
**Cause:** MongoDB service not running (local MongoDB)
**Solutions:**
```bash
# macOS
brew services start mongodb-community

# Or start manually
mongod --config /usr/local/etc/mongod.conf
```

#### Error: `MongoServerError: bad auth`
**Cause:** Database user doesn't have proper permissions
**Solutions:**
- In MongoDB Atlas, check Database Access
- Ensure user has "Read and write to any database" role
- Try recreating the database user

---

## Recommended Setup for Development

**For quick start with no internet dependency:**
1. Install MongoDB locally (Option 2)
2. Use local connection string

**For production-ready setup:**
1. Use MongoDB Atlas (Option 3)
2. Set proper IP restrictions
3. Use environment variables for credentials

---

## Current Configuration

The application is now configured to use:
```javascript
MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gsams'
```

This means:
- ✅ If you create a `.env` file with `MONGODB_URI`, it will use that
- ✅ Otherwise, it tries to connect to local MongoDB on `127.0.0.1:27017`

---

## Next Steps

1. **Choose one of the 3 options above**
2. **Create the .env file** with your chosen MongoDB connection
3. **Restart the server**
4. **Verify connection** - You should see:
   ```
   ✅ MongoDB connected successfully
   🚀 Server is running on port 5000
   ```

---

## Need Help?

If you continue to have issues:

1. **Check server logs** - Look for specific error messages
2. **Verify .env file** - Make sure it's in the project root
3. **Test connection** - Use the test script above
4. **Check MongoDB status** - Ensure service is running

---

## Security Notes

⚠️ **Important Security Tips:**

1. **Never commit .env file** - It's already in `.gitignore`
2. **Use strong passwords** - For database users
3. **Restrict IP access** - In production, don't use 0.0.0.0/0
4. **Change JWT_SECRET** - Use a strong random string
5. **Use environment variables** - For all sensitive data

---

**Last Updated:** January 19, 2026
**Project:** GSAMS (GeoSecure Attendance Management System)
