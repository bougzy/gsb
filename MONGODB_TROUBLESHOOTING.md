# MongoDB Connection Troubleshooting Guide

## Current Issue: MongoDB Disconnecting

### Symptoms
```
MongoDB disconnected. Attempting to reconnect...
```

---

## Common Causes & Solutions

### 1. ✅ Network/Firewall Issues

**Problem:** MongoDB Atlas blocks connections from unauthorized IPs.

**Solution:**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Navigate to: Network Access → IP Access List
3. Add your current IP address OR add `0.0.0.0/0` (allow from anywhere)
4. Wait 1-2 minutes for changes to apply

**Note:** For security, whitelist specific IPs in production.

---

### 2. ✅ Invalid Credentials

**Problem:** Username or password is incorrect.

**Solution:**
1. Go to MongoDB Atlas → Database Access
2. Verify username: `prezent`
3. If needed, reset the password
4. Update connection string in `.env`:
   ```
   MONGODB_URI=mongodb+srv://prezent:NEW_PASSWORD@prezent.pw70dzq.mongodb.net/prezent
   ```

---

### 3. ✅ Connection String Issues

**Problem:** Malformed connection string.

**Current Connection String:**
```
mongodb+srv://prezent:prezent@prezent.pw70dzq.mongodb.net/prezent
```

**Check:**
- ✓ Username: `prezent`
- ✓ Password: `prezent` (make sure it's correct)
- ✓ Cluster: `prezent.pw70dzq.mongodb.net`
- ✓ Database: `prezent`

**If password contains special characters:**
- Encode them using percent-encoding
- Example: `@` → `%40`, `#` → `%23`

---

### 4. ✅ MongoDB Atlas Free Tier Limits

**Problem:** Free tier clusters pause after inactivity or hit limits.

**Solution:**
1. Check MongoDB Atlas dashboard
2. Verify cluster is running (not paused)
3. Check if you've exceeded free tier limits:
   - Storage: 512MB max
   - Connections: 500 max concurrent

**Upgrade if needed:** Click "Upgrade" in Atlas dashboard

---

### 5. ✅ DNS Resolution Issues

**Problem:** Can't resolve `prezent.pw70dzq.mongodb.net`.

**Solution:**
```bash
# Test DNS resolution
nslookup prezent.pw70dzq.mongodb.net

# If fails, try using Google DNS
# Add to /etc/hosts or configure DNS to 8.8.8.8
```

---

### 6. ✅ Connection Pool Exhaustion

**Problem:** Too many connections.

**Current Settings:**
```javascript
maxPoolSize: 10,
minPoolSize: 2,
```

**Solution:** Already optimized. If issues persist:
- Reduce `maxPoolSize` to 5
- Check for connection leaks in your code

---

## Quick Fixes

### Option 1: Use Environment Variable
Create a `.env` file:
```bash
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb+srv://prezent:YOUR_PASSWORD@prezent.pw70dzq.mongodb.net/prezent
```

Restart server:
```bash
npm run dev
```

### Option 2: Test Connection Manually

Create `test-mongodb.js`:
```javascript
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://prezent:prezent@prezent.pw70dzq.mongodb.net/prezent')
  .then(() => {
    console.log('✅ Connection successful!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  });
```

Run:
```bash
node test-mongodb.js
```

---

## Enhanced Connection (Already Implemented)

Your server now has:

✅ **Auto-reconnect** - Automatically tries to reconnect
✅ **Retry logic** - Retries 5 times with 5-second delays
✅ **Connection pooling** - Maintains 2-10 connections
✅ **Better timeouts** - 10s server selection, 45s socket timeout
✅ **Event logging** - Shows connection status changes

---

## Monitoring Connection Status

### Check Health Endpoint
```bash
curl http://localhost:5000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-19T16:00:00.000Z",
  "uptime": 123.456,
  "services": {
    "api": "operational",
    "database": {
      "status": "connected",
      "readyState": 1,
      "name": "prezent"
    }
  }
}
```

**Database States:**
- `0` - disconnected
- `1` - connected ✅
- `2` - connecting
- `3` - disconnecting

---

## Production Recommendations

### 1. Use Environment Variables
Never hardcode credentials:
```javascript
// ❌ Bad
mongoose.connect('mongodb+srv://prezent:prezent@...')

// ✅ Good
mongoose.connect(process.env.MONGODB_URI)
```

### 2. Add Retry Logic
Already implemented in your server!

### 3. Monitor Connection
Set up alerts for disconnections:
```javascript
mongoose.connection.on('disconnected', () => {
  // Send alert to admin
  notifyAdmin('MongoDB disconnected!');
});
```

### 4. Use MongoDB Atlas Alerts
Configure in Atlas dashboard:
- Connection count warnings
- Cluster CPU/memory alerts
- Disk space warnings

---

## Immediate Action Items

1. **Check MongoDB Atlas:**
   - [ ] Cluster is running
   - [ ] Your IP is whitelisted
   - [ ] Credentials are correct

2. **Verify Connection:**
   ```bash
   node test-mongodb.js
   ```

3. **Check Logs:**
   Look for specific error messages in server console

4. **Test Health Endpoint:**
   ```bash
   curl http://localhost:5000/api/health
   ```

---

## Still Having Issues?

### Get Detailed Error Info:

Add this temporarily to `index.js`:
```javascript
mongoose.set('debug', true); // See all MongoDB queries
```

### Check MongoDB Atlas Status:
https://status.cloud.mongodb.com/

### Contact Support:
If using paid tier, contact MongoDB support with:
- Connection string (remove password)
- Error messages
- Server logs
- Your IP address

---

## Summary

Your server is now configured with:
- ✅ Auto-reconnect on disconnection
- ✅ 5 retry attempts with delays
- ✅ Optimized connection pooling
- ✅ Comprehensive event logging
- ✅ Health check endpoint

**Most likely cause:** IP not whitelisted in MongoDB Atlas

**Quick fix:** Add your IP to MongoDB Atlas Network Access
