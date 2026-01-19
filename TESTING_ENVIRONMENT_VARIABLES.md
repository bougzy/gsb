# Testing Environment Variables - Quick Setup Guide

## Overview

When testing the GSAMS application, you can bypass certain validations that would normally prevent testing. This is useful for:
- Testing from locations outside meeting venues
- Testing meetings outside scheduled time windows
- Testing with mock/emulator GPS data
- Demonstrating the application

## Environment Variables for Testing

### 1. SKIP_TIME_VALIDATION

**Purpose:** Bypass meeting time window restrictions

**Problem it solves:**
- "Attendance form not available at this time" error
- Can't access meetings created with past dates
- Can't test meetings before/after scheduled time

**How to enable:**
```bash
SKIP_TIME_VALIDATION=true
```

**What it does:**
- Allows attendance submission at ANY time
- Ignores `attendanceStart` and `attendanceEnd` times
- Meeting is always "open" regardless of schedule

**See:** [TIME_VALIDATION_FIX.md](TIME_VALIDATION_FIX.md)

---

### 2. SKIP_LOCATION_VALIDATION

**Purpose:** Bypass GPS location verification

**Problem it solves:**
- "Location verification failed" error (403 Forbidden)
- Can't test from locations outside meeting radius
- Poor GPS accuracy indoors
- Mock location / emulator testing

**How to enable:**
```bash
SKIP_LOCATION_VALIDATION=true
```

**What it does:**
- Accepts attendance from ANY location worldwide
- No GPS distance checking
- No spoofing detection
- Location data is still recorded but not validated

**See:** [LOCATION_VALIDATION_FIX.md](LOCATION_VALIDATION_FIX.md)

---

### 3. NODE_ENV

**Purpose:** Set application mode

**Options:**
```bash
NODE_ENV=development  # Enables both skips automatically
NODE_ENV=production   # Enforces all validations
```

**What it does:**
- `development`: Auto-enables SKIP_TIME_VALIDATION and SKIP_LOCATION_VALIDATION
- `production`: Requires explicit skip variables

---

## Setup Instructions

### Local Development (Using .env file)

1. **Create .env file** (if not exists):
   ```bash
   touch .env
   ```

2. **Add testing variables:**
   ```bash
   # .env file

   # Skip validations for testing
   SKIP_TIME_VALIDATION=true
   SKIP_LOCATION_VALIDATION=true

   # Or use development mode (enables both automatically)
   NODE_ENV=development

   # Other required variables
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_secret_key
   PORT=5000
   ```

3. **Restart server:**
   ```bash
   npm start
   # or
   node index.js
   ```

4. **Verify** in console logs:
   ```
   ⚠️  Time validation SKIPPED (development mode or SKIP_TIME_VALIDATION=true)
   ⚠️  Location validation SKIPPED (development mode or SKIP_LOCATION_VALIDATION=true)
   ```

---

### Vercel Deployment (Production Testing)

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Click **Settings** tab

2. **Add Environment Variables**
   - Click **Environment Variables** section
   - Add these variables:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `SKIP_TIME_VALIDATION` | `true` | ✅ All |
   | `SKIP_LOCATION_VALIDATION` | `true` | ✅ All |
   | `MONGODB_URI` | `your_connection_string` | ✅ All |
   | `JWT_SECRET` | `your_secret_key` | ✅ All |

3. **Redeploy Application**

   **Option A: Redeploy Existing**
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**
   - Wait for deployment to complete

   **Option B: New Deployment**
   - Make any small change to your code (add comment)
   - Commit and push:
     ```bash
     git add .
     git commit -m "Add testing environment variables"
     git push
     ```

4. **Verify Deployment**
   - Click on deployment
   - Click **View Function Logs** or **Runtime Logs**
   - Look for:
     ```
     ⚠️  Time validation SKIPPED
     ⚠️  Location validation SKIPPED
     ```

---

## When to Enable/Disable

### ✅ Enable Testing Variables When:

1. **Initial Testing**
   - First deployment to Vercel
   - Testing all features work
   - Demonstrating the application

2. **Development**
   - Building new features
   - Testing UI/UX changes
   - QA testing

3. **Debugging**
   - Investigating errors
   - Testing edge cases
   - Reproducing issues

4. **Demos**
   - Showing to stakeholders
   - Presenting at meetings
   - Training sessions

### ❌ Disable Testing Variables When:

1. **Production Use**
   - Real attendance tracking
   - Live events
   - Actual meetings

2. **Security Testing**
   - Testing GPS validation
   - Testing time restrictions
   - Penetration testing

3. **Compliance**
   - Audit requirements
   - Verification needed
   - Legal/official use

---

## Quick Enable/Disable

### Enable Testing (Fast)

**Vercel:**
```bash
# Set via Vercel CLI (if installed)
vercel env add SKIP_TIME_VALIDATION
# Enter: true

vercel env add SKIP_LOCATION_VALIDATION
# Enter: true

# Redeploy
vercel --prod
```

**Local:**
```bash
# Add to .env
echo "SKIP_TIME_VALIDATION=true" >> .env
echo "SKIP_LOCATION_VALIDATION=true" >> .env

# Restart
npm start
```

---

### Disable Testing (Production Ready)

**Vercel:**
1. Go to Settings > Environment Variables
2. Delete `SKIP_TIME_VALIDATION` (or set to `false`)
3. Delete `SKIP_LOCATION_VALIDATION` (or set to `false`)
4. Redeploy

**Local:**
```bash
# Comment out in .env
# SKIP_TIME_VALIDATION=true
# SKIP_LOCATION_VALIDATION=true

# Or set to false
SKIP_TIME_VALIDATION=false
SKIP_LOCATION_VALIDATION=false

# Restart
npm start
```

---

## Testing Workflow Example

### Complete Testing Setup

```bash
# 1. Set testing environment variables on Vercel
SKIP_TIME_VALIDATION=true
SKIP_LOCATION_VALIDATION=true

# 2. Redeploy application
# (via Vercel dashboard or git push)

# 3. Test the application
# - Create meeting with any date/time
# - Access meeting link from anywhere
# - Submit attendance (no location/time checks)
# - Verify in dashboard

# 4. After testing, disable for production
SKIP_TIME_VALIDATION=false
SKIP_LOCATION_VALIDATION=false

# 5. Redeploy
# (via Vercel dashboard or git push)
```

---

## Common Testing Scenarios

### Scenario 1: Test Meeting Creation & Attendance

**Setup:**
```bash
SKIP_TIME_VALIDATION=true
SKIP_LOCATION_VALIDATION=true
```

**Test:**
1. Create meeting with past date/time
2. Activate meeting
3. Copy meeting link
4. Submit attendance from any location
5. ✅ Should succeed regardless of time/location

---

### Scenario 2: Test Only Location (Enforce Time)

**Setup:**
```bash
SKIP_TIME_VALIDATION=false  # Enforce time window
SKIP_LOCATION_VALIDATION=true  # Allow any location
```

**Test:**
1. Create meeting with current/future time
2. Wait until attendance window opens
3. Submit from any location
4. ✅ Should succeed (location doesn't matter)

---

### Scenario 3: Test Only Time (Enforce Location)

**Setup:**
```bash
SKIP_TIME_VALIDATION=true  # Allow any time
SKIP_LOCATION_VALIDATION=false  # Enforce GPS check
```

**Test:**
1. Create meeting with coordinates of test location
2. Submit attendance from test location
3. ✅ Should succeed (time doesn't matter)
4. Try from different location
5. ❌ Should fail (location validation enforced)

---

### Scenario 4: Full Production Validation

**Setup:**
```bash
SKIP_TIME_VALIDATION=false  # Enforce time
SKIP_LOCATION_VALIDATION=false  # Enforce location
```

**Test:**
1. Create meeting with correct time & location
2. Wait for attendance window
3. Submit from meeting venue
4. ✅ Should succeed (all checks pass)
5. Try from different location or time
6. ❌ Should fail (validation enforced)

---

## Troubleshooting

### Variables Not Working

**Problem:** Still getting validation errors after enabling skip variables

**Solutions:**

1. **Check variable name spelling**
   ```bash
   ✅ SKIP_TIME_VALIDATION=true
   ❌ SKIP_TIME_VERIFY=true
   ❌ skip_time_validation=true
   ```

2. **Verify variable is set**
   - Vercel: Check Settings > Environment Variables
   - Local: Check `.env` file exists and has variables

3. **Redeploy after adding variables**
   - Variables only apply to NEW deployments
   - Must redeploy or restart server

4. **Check server logs**
   - Should see skip messages:
     ```
     ⚠️  Time validation SKIPPED
     ⚠️  Location validation SKIPPED
     ```
   - If missing, variables not being read

5. **Check environment**
   - Make sure variables are set for correct environment (Production/Preview/Development)

---

### Still Getting Errors After Skip

**Other validations still run:**

1. **Required fields** - Must fill all required form fields
2. **Duplicate prevention** - Can't submit twice from same device
3. **Form validation** - Custom fields must be valid
4. **Authentication** - Meeting must be active

**Check error message to identify which validation is failing.**

---

## Security Warning

### ⚠️ IMPORTANT: Production Security

**DO NOT leave skip variables enabled in production after testing!**

**Why it's dangerous:**
- ✅ `SKIP_TIME_VALIDATION=true` - Anyone can submit attendance anytime (past/future)
- ✅ `SKIP_LOCATION_VALIDATION=true` - Anyone can submit from anywhere in the world

**This defeats the entire purpose of the system!**

**Safe practice:**
1. ✅ Enable for testing
2. ✅ Test thoroughly
3. ✅ **Disable before real events**
4. ✅ Redeploy with validation enabled
5. ✅ Verify validations are working

---

## All Environment Variables Reference

### Required (Production)

```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gsams

# Authentication
JWT_SECRET=your-super-secret-random-string-change-this-in-production

# Server
PORT=5000
```

### Optional (Testing)

```bash
# Skip validations (TESTING ONLY!)
SKIP_TIME_VALIDATION=true
SKIP_LOCATION_VALIDATION=true

# Environment mode
NODE_ENV=development  # Enables both skips automatically
```

### Optional (Configuration)

```bash
# Session
SESSION_SECRET=another-random-secret-for-sessions

# Email (if implemented)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS (if implemented)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Summary

**Testing Variables:**
- `SKIP_TIME_VALIDATION=true` - Bypass time window checks
- `SKIP_LOCATION_VALIDATION=true` - Bypass GPS validation
- `NODE_ENV=development` - Auto-enable both skips

**Setup:**
1. Add to `.env` (local) or Vercel Environment Variables
2. Redeploy/restart
3. Verify skip messages in logs

**Security:**
- ✅ Enable for testing
- ❌ Disable for production
- ⚠️ Never leave enabled for real events

---

**For detailed information:**
- Time validation: [TIME_VALIDATION_FIX.md](TIME_VALIDATION_FIX.md)
- Location validation: [LOCATION_VALIDATION_FIX.md](LOCATION_VALIDATION_FIX.md)
- Vercel deployment: [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)

**Last Updated:** January 19, 2026
