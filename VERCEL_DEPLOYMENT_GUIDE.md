# Vercel Deployment Guide for GSAMS

This guide will walk you through deploying your GSAMS (GeoSecure Attendance Management System) application to Vercel.

## Prerequisites

Before deploying, you need:

1. ✅ A Vercel account (free tier works)
2. ✅ MongoDB Atlas account (for production database)
3. ✅ Git repository (GitHub, GitLab, or Bitbucket)
4. ✅ Vercel CLI installed (optional, but recommended)

---

## Step 1: Prepare MongoDB Atlas (Database)

### 1.1 Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for a free account
3. Create a new cluster (M0 Free tier is sufficient)

### 1.2 Create Database User

1. Go to **Database Access** in MongoDB Atlas
2. Click **Add New Database User**
3. Choose **Password** authentication
4. Username: `gsams_admin` (or your choice)
5. Password: Generate a **strong password** and save it!
6. Database User Privileges: **Read and write to any database**
7. Click **Add User**

### 1.3 Whitelist IP Addresses

1. Go to **Network Access**
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (0.0.0.0/0)
   - ⚠️ For production, you should restrict this to Vercel's IP ranges
4. Click **Confirm**

### 1.4 Get Connection String

1. Go to **Database** → Click **Connect** on your cluster
2. Choose **Connect your application**
3. Driver: **Node.js**, Version: **4.1 or later**
4. Copy the connection string

Example:
```
mongodb+srv://gsams_admin:<password>@cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

5. Replace `<password>` with your actual password
6. Add database name before the `?`:
```
mongodb+srv://gsams_admin:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/gsams?retryWrites=true&w=majority
```

⚠️ **SAVE THIS CONNECTION STRING - YOU'LL NEED IT FOR VERCEL**

---

## Step 2: Prepare Your Code for Deployment

### 2.1 Files Created

I've created these files for you:

✅ `vercel.json` - Vercel configuration
✅ `.gitignore` - Files to exclude from Git
✅ `.env.production` - Production environment template

### 2.2 Update Git Repository

```bash
cd /Users/sph/Desktop/hello/gsb

# Add all files
git add .

# Commit changes
git commit -m "Add Vercel deployment configuration"

# Push to your repository
git push origin main
```

If you don't have a remote repository yet:

```bash
# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/gsams.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel (Option 1: Web Dashboard)

### 3.1 Connect Repository

1. Go to https://vercel.com/
2. Sign in (or create account)
3. Click **Add New...** → **Project**
4. Import your Git repository
5. Click **Import** on your GSAMS repository

### 3.2 Configure Project

1. **Framework Preset:** Other (or leave as detected)
2. **Root Directory:** `./` (leave as default)
3. **Build Command:** Leave empty (Node.js server)
4. **Output Directory:** Leave empty
5. **Install Command:** `npm install`

### 3.3 Add Environment Variables

Click **Environment Variables** and add these:

| Name | Value | Notes |
|------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | (generate random string) | Use: `openssl rand -base64 32` |
| `BASE_URL` | `https://your-app.vercel.app` | Update after first deployment |
| `PORT` | `5000` | Optional (Vercel auto-assigns) |

**How to generate JWT_SECRET:**
```bash
# Run this in your terminal
openssl rand -base64 32
```

Copy the output and use it as `JWT_SECRET`.

### 3.4 Deploy

1. Click **Deploy**
2. Wait for deployment (usually 2-3 minutes)
3. You'll get a URL like: `https://gsams-xxxx.vercel.app`

### 3.5 Update BASE_URL

1. Copy your deployment URL
2. Go to **Settings** → **Environment Variables**
3. Edit `BASE_URL` and set it to your actual Vercel URL
4. Click **Save**
5. Go to **Deployments** → Click **...** → **Redeploy**

---

## Step 4: Deploy to Vercel (Option 2: CLI)

### 4.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 4.2 Login to Vercel

```bash
vercel login
```

### 4.3 Deploy

```bash
cd /Users/sph/Desktop/hello/gsb

# First deployment
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - Project name? gsams (or your choice)
# - In which directory is your code? ./
# - Want to override settings? No
```

### 4.4 Add Environment Variables

```bash
# Add MongoDB URI
vercel env add MONGODB_URI

# Paste your MongoDB connection string when prompted
# Select: Production, Preview, Development

# Add JWT Secret
vercel env add JWT_SECRET

# Paste your JWT secret
# Select: Production, Preview, Development

# Add other variables
vercel env add NODE_ENV
# Value: production

vercel env add BASE_URL
# Value: (leave empty for now, update after deployment)
```

### 4.5 Deploy to Production

```bash
vercel --prod
```

### 4.6 Update BASE_URL

After deployment, you'll get a URL. Update BASE_URL:

```bash
vercel env add BASE_URL
# Value: https://your-app.vercel.app
# Select: Production, Preview, Development

# Redeploy
vercel --prod
```

---

## Step 5: Test Your Deployment

### 5.1 Check API Health

Open in browser:
```
https://your-app.vercel.app/api/health
```

Should return:
```json
{
  "status": "OK",
  "message": "GSAMS API is running",
  "timestamp": "..."
}
```

### 5.2 Access Dashboard

```
https://your-app.vercel.app/
```

You should see the login page.

### 5.3 Create Admin User

You'll need to create an admin user manually in MongoDB:

**Option 1: Use MongoDB Compass**

1. Download MongoDB Compass: https://www.mongodb.com/try/download/compass
2. Connect using your MongoDB URI
3. Navigate to `gsams` database → `admins` collection
4. Insert document:

```json
{
  "fullName": "Admin User",
  "email": "admin@gsams.com",
  "phone": "+1234567890",
  "password": "$2a$10$X8Y9Z...",
  "organizationId": ObjectId("..."),
  "role": "Super Admin",
  "permissions": {
    "canCreateMeetings": true,
    "canEditMeetings": true,
    "canDeleteMeetings": true,
    "canViewAttendance": true,
    "canVerifyAttendance": true,
    "canGenerateReports": true,
    "canManageAdmins": true,
    "canManageSettings": true
  },
  "status": "active",
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

**Generate password hash:**
```bash
# In Node.js console or create a script
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123!', 10));"
```

**Option 2: Use registration endpoint** (if enabled)

POST to:
```
https://your-app.vercel.app/api/register-admin
```

Body:
```json
{
  "fullName": "Admin User",
  "email": "admin@gsams.com",
  "phone": "+1234567890",
  "password": "YourSecurePassword123!",
  "organizationName": "Your Organization"
}
```

---

## Step 6: Update Frontend URLs

If your dashboard.html has hardcoded localhost URLs, update them:

**In `/public/dashboard.html`:**

Find:
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5000';
```

Replace with:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : `${window.location.origin}/api`;

const FRONTEND_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : window.location.origin;
```

Then commit and push:
```bash
git add .
git commit -m "Update frontend URLs for Vercel"
git push origin main
```

Vercel will automatically redeploy.

---

## Important Vercel Limitations

### ⚠️ Serverless Function Timeout

Vercel free tier has a **10-second timeout** for serverless functions. If your API requests take longer, they'll fail.

**Solutions:**
- Optimize database queries
- Use indexes in MongoDB
- Implement pagination for large datasets
- Consider upgrading to Pro plan (60-second timeout)

### ⚠️ Stateless Functions

Each request runs in a new serverless function instance. This means:
- No in-memory session storage
- No file uploads to server disk (use cloud storage like AWS S3)
- No long-running background jobs

**Solutions:**
- Use MongoDB for session storage
- Use external storage services
- Use job queues (Vercel Cron Jobs or external services)

### ⚠️ Cold Starts

First request after inactivity may be slower (3-5 seconds).

---

## Environment Variables Summary

Here's what you need to set in Vercel:

```bash
# Required
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gsams?retryWrites=true&w=majority
JWT_SECRET=your-random-secret-here
BASE_URL=https://your-app.vercel.app

# Optional (for SMS features)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Optional (for caching - not recommended on Vercel free tier)
# REDIS_URL=redis://default:password@host:port
```

---

## Troubleshooting

### Error: "CORS Error"

**Solution:** Make sure your Vercel URL is added to CORS whitelist in `index.js`:
```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://your-app.vercel.app',  // Add your Vercel URL
];
```

I've already updated the code to allow all `.vercel.app` domains.

### Error: "MongoDB connection failed"

**Solutions:**
1. Check `MONGODB_URI` environment variable in Vercel
2. Verify IP whitelist includes 0.0.0.0/0 in MongoDB Atlas
3. Check password in connection string is URL-encoded
4. Verify database user has correct permissions

### Error: "Function timeout"

**Solutions:**
1. Optimize your database queries
2. Add indexes to MongoDB collections
3. Reduce data returned in API responses
4. Upgrade to Vercel Pro (if needed)

### Error: "Module not found"

**Solutions:**
1. Make sure all dependencies are in `package.json`
2. Run `vercel --prod` to redeploy
3. Check build logs in Vercel dashboard

---

## Custom Domain (Optional)

To use your own domain (e.g., `gsams.yourdomain.com`):

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain
4. Follow DNS configuration instructions
5. Wait for DNS propagation (can take up to 48 hours)

---

## Monitoring and Logs

### View Logs

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments**
3. Click on a deployment
4. Click **Functions** tab to see logs

### Monitor Usage

1. Go to **Analytics** tab
2. View:
   - Request count
   - Response times
   - Error rates
   - Bandwidth usage

---

## Continuous Deployment

Vercel automatically deploys when you push to Git:

- `main` branch → Production deployment
- Other branches → Preview deployments

To disable auto-deploy:
1. Go to **Settings** → **Git**
2. Configure auto-deploy settings

---

## Cost Estimate

### Free Tier Includes:
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth per month
- ✅ Serverless function executions
- ✅ SSL certificates
- ✅ Preview deployments

### When to Upgrade to Pro ($20/month):
- Need longer function timeout (60s vs 10s)
- Higher bandwidth (1 TB vs 100 GB)
- Team collaboration features
- Commercial projects

### MongoDB Atlas Free Tier:
- ✅ 512 MB storage
- ✅ Shared cluster
- ✅ Suitable for small projects

Upgrade when:
- Need more storage
- Need better performance
- Production workloads

---

## Security Checklist

Before going live:

- [ ] Strong JWT_SECRET (use `openssl rand -base64 32`)
- [ ] Secure MongoDB password
- [ ] Environment variables set correctly
- [ ] CORS properly configured
- [ ] MongoDB IP whitelist configured
- [ ] Admin users have strong passwords
- [ ] SSL enabled (Vercel does this automatically)
- [ ] Rate limiting enabled (already in code)
- [ ] Helmet security headers enabled (already in code)

---

## Next Steps After Deployment

1. ✅ Test all features on production
2. ✅ Create admin users
3. ✅ Configure organization settings
4. ✅ Test meeting creation and activation
5. ✅ Test attendance submission
6. ✅ Generate test reports
7. ✅ Monitor logs and errors
8. ✅ Set up custom domain (optional)
9. ✅ Configure Twilio for SMS (optional)

---

## Files Created for Vercel

```
/Users/sph/Desktop/hello/gsb/
├── vercel.json              # Vercel configuration
├── .gitignore               # Git ignore rules
├── .env.production          # Production env template
└── VERCEL_DEPLOYMENT_GUIDE.md  # This file
```

---

## Quick Deploy Commands

```bash
# 1. Commit changes
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main

# 2. Deploy to Vercel
vercel --prod

# 3. Set environment variables (if not done via dashboard)
vercel env add MONGODB_URI
vercel env add JWT_SECRET
vercel env add NODE_ENV
vercel env add BASE_URL

# 4. Redeploy
vercel --prod
```

---

## Support and Resources

- Vercel Documentation: https://vercel.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/
- Node.js on Vercel: https://vercel.com/docs/runtimes#official-runtimes/node-js

---

**Last Updated:** January 19, 2026
**Deployment Status:** Ready for Vercel ✅

Good luck with your deployment! 🚀
