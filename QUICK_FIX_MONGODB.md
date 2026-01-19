# Quick Fix for MongoDB Connection Error

## The Problem
```
❌ MongoDB connection error: querySrv ETIMEOUT _mongodb._tcp.prezent.pw70dzq.mongodb.net
```

Your application cannot connect to the MongoDB Atlas cluster.

---

## Quick Solution (Choose One)

### Option A: Automatic Setup (Recommended)

Run the setup script:

```bash
cd /Users/sph/Desktop/hello/gsb
./setup-env.sh
```

Follow the prompts to choose your MongoDB setup.

---

### Option B: Manual Setup with Local MongoDB

**Step 1: Install MongoDB**
```bash
# Install MongoDB using Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community
```

**Step 2: Create .env file**
```bash
cd /Users/sph/Desktop/hello/gsb
cat > .env << 'EOF'
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/gsams
JWT_SECRET=$(openssl rand -base64 32)
EOF
```

**Step 3: Restart server**
```bash
npm start
```

---

### Option C: Use MongoDB Atlas (New Cluster)

**Step 1: Create free cluster at https://www.mongodb.com/cloud/atlas**

**Step 2: Get your connection string**
Example:
```
mongodb+srv://username:password@cluster.mongodb.net/gsams
```

**Step 3: Create .env file**
```bash
cd /Users/sph/Desktop/hello/gsb
cat > .env << 'EOF'
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/gsams
JWT_SECRET=your-random-secret-here
EOF
```

Replace `YOUR_USERNAME`, `YOUR_PASSWORD`, and `YOUR_CLUSTER` with actual values.

**Step 4: Restart server**
```bash
npm start
```

---

## Verify It's Working

When the server starts, you should see:
```
✅ MongoDB connected successfully
🚀 Server is running on port 5000
```

Instead of:
```
❌ MongoDB connection error: querySrv ETIMEOUT
```

---

## What Changed

I've updated the code to use local MongoDB by default:
- **Before:** Always tried to connect to `prezent.pw70dzq.mongodb.net`
- **Now:** Uses `mongodb://127.0.0.1:27017/gsams` by default
- **With .env:** Uses whatever you specify in `MONGODB_URI`

---

## Files Created

- ✅ `MONGODB_SETUP_GUIDE.md` - Detailed setup instructions
- ✅ `setup-env.sh` - Automatic setup script
- ✅ `QUICK_FIX_MONGODB.md` - This file

---

## Troubleshooting

### "mongod not found"
MongoDB is not installed. Install it:
```bash
brew install mongodb-community
```

### "Connection refused"
MongoDB service is not running. Start it:
```bash
brew services start mongodb-community
```

### "Authentication failed"
Wrong username or password in connection string. Check your credentials.

---

## Need More Help?

See the detailed guide: `MONGODB_SETUP_GUIDE.md`
