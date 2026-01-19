# Vercel Deployment Checklist

Quick checklist for deploying GSAMS to Vercel.

## Pre-Deployment

### MongoDB Atlas Setup
- [ ] Create MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
- [ ] Create a free M0 cluster
- [ ] Create database user with username and strong password
- [ ] Whitelist IP addresses (use 0.0.0.0/0 for development)
- [ ] Get connection string
- [ ] Replace `<password>` in connection string with actual password
- [ ] Add database name (gsams) to connection string
- [ ] **Save connection string securely**

### Git Repository
- [ ] Push code to GitHub/GitLab/Bitbucket
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

## Vercel Deployment

### Account Setup
- [ ] Create Vercel account at https://vercel.com
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Login to Vercel: `vercel login`

### Deploy via Web Dashboard
- [ ] Go to https://vercel.com/new
- [ ] Import Git repository
- [ ] Configure project settings
- [ ] Add environment variables (see below)
- [ ] Click Deploy
- [ ] Wait for deployment to complete
- [ ] Copy deployment URL

### Deploy via CLI
```bash
cd /Users/sph/Desktop/hello/gsb
vercel --prod
```

## Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

### Required Variables
```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/gsams?retryWrites=true&w=majority
JWT_SECRET=<generate using: openssl rand -base64 32>
BASE_URL=https://your-app-name.vercel.app
```

### Optional Variables (for SMS)
```bash
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

## Post-Deployment

### Update BASE_URL
- [ ] After first deployment, copy your Vercel URL
- [ ] Update `BASE_URL` environment variable with actual Vercel URL
- [ ] Redeploy (Vercel Dashboard → Deployments → Redeploy)

### Test Deployment
- [ ] Visit: `https://your-app.vercel.app/api/health`
- [ ] Should see: `{"status":"OK","message":"GSAMS API is running"}`
- [ ] Visit: `https://your-app.vercel.app/`
- [ ] Should see login page

### Create Admin User

**Method 1: MongoDB Compass**
- [ ] Download MongoDB Compass
- [ ] Connect using MongoDB URI
- [ ] Create admin user in `gsams.admins` collection

**Method 2: Use Script**
```bash
# Generate password hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123!', 10));"

# Insert admin document in MongoDB
```

### Test Features
- [ ] Login with admin credentials
- [ ] Create a meeting (all 3 steps)
- [ ] Activate meeting
- [ ] Copy meeting link
- [ ] Open meeting link in incognito/new browser
- [ ] Submit attendance
- [ ] View attendance in dashboard
- [ ] Generate PDF report
- [ ] Generate Excel report

## Verification

### API Endpoints
- [ ] Health check: `GET /api/health`
- [ ] Login: `POST /api/login`
- [ ] Meetings: `GET /api/meetings`
- [ ] Public form: `GET /api/meetings/:publicCode/form`

### Frontend Pages
- [ ] Login page: `/`
- [ ] Dashboard: `/dashboard.html`
- [ ] Attendance: `/attend.html?code=XXXXXX`

## Security Review

- [ ] JWT_SECRET is strong random string (32+ characters)
- [ ] MongoDB password is strong
- [ ] Environment variables are set (not hardcoded)
- [ ] CORS is properly configured
- [ ] MongoDB IP whitelist is configured
- [ ] SSL is enabled (Vercel does automatically)

## Performance

- [ ] Test API response times
- [ ] Check for timeout errors (Vercel free = 10s limit)
- [ ] Monitor function execution time
- [ ] Review MongoDB query performance

## Troubleshooting

### Common Issues

**"CORS Error"**
- Check CORS configuration in index.js
- Vercel URL should be allowed (already configured for .vercel.app)

**"MongoDB connection failed"**
- Verify MONGODB_URI in Vercel environment variables
- Check IP whitelist in MongoDB Atlas
- Verify password in connection string

**"Function timeout"**
- Optimize database queries
- Reduce response payload size
- Consider upgrading to Vercel Pro

**"Module not found"**
- Check package.json has all dependencies
- Run `npm install` locally to verify
- Redeploy

**Meeting link shows "undefined"**
- Already fixed - uses `meeting.accessCodes.publicCode`
- Clear cache and try again

## Monitoring

### Vercel Dashboard
- [ ] Check deployment status
- [ ] Review function logs
- [ ] Monitor error rate
- [ ] Check bandwidth usage

### MongoDB Atlas
- [ ] Monitor database size
- [ ] Check connection count
- [ ] Review query performance

## Next Steps

- [ ] Configure custom domain (optional)
- [ ] Set up monitoring/alerting
- [ ] Configure Twilio for SMS (optional)
- [ ] Add more admin users
- [ ] Test with real meetings
- [ ] Train users on the system

## Quick Commands

```bash
# View logs
vercel logs YOUR_DEPLOYMENT_URL

# List deployments
vercel ls

# List environment variables
vercel env ls

# Add environment variable
vercel env add VARIABLE_NAME

# Redeploy
vercel --prod

# Remove deployment
vercel rm DEPLOYMENT_URL
```

## Support

- Vercel Status: https://www.vercel-status.com/
- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas Support: https://www.mongodb.com/cloud/atlas/support

---

## Files Created

✅ `vercel.json` - Vercel configuration
✅ `.gitignore` - Git ignore rules
✅ `.env.production` - Production environment template
✅ `VERCEL_DEPLOYMENT_GUIDE.md` - Comprehensive guide
✅ `DEPLOYMENT_CHECKLIST.md` - This checklist

---

**Ready to Deploy:** YES ✅
**Estimated Time:** 15-30 minutes
**Difficulty:** Easy

Good luck! 🚀
