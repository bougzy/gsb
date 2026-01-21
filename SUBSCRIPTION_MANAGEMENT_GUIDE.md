# Subscription Management Guide

## ✅ Completed Features

You now have complete subscription plan management with two interfaces:

1. **Platform Admin** - Assign plans to any organization
2. **Organization Admin** - Self-service plan selection

---

## 🎯 Platform Admin Features

### Assign Plan to Organization

**Access:** Platform Admin Dashboard → Organizations

**Steps:**
1. Login to platform admin: https://gsams.vercel.app/platform-admin-login.html
2. Navigate to "Organizations" section
3. Find the organization you want to assign a plan to
4. Click the **blue tags icon** (Assign Plan button)
5. Select:
   - Subscription Plan (Starter, Professional, or Enterprise)
   - Billing Cycle (Monthly or Annual)
   - Trial Days (0 for immediate activation, or 7-90 for trial period)
6. Click "Assign Plan"

**Result:**
- Organization gets assigned the selected plan
- Trial period starts if trial days > 0
- Otherwise, subscription becomes active immediately
- Organization admin can see the plan in their dashboard

**API Endpoint:**
```
POST /api/platform-admin/organizations/:orgId/assign-plan
```

**Request Body:**
```json
{
  "planId": "696f40a215fdc3f87eb7869b",
  "billingCycle": "monthly",
  "trialDays": 14
}
```

---

## 🏢 Organization Admin Features

### View and Change Subscription Plan

**Access:** https://gsams.vercel.app/subscription.html

**Features:**

### 1. Current Subscription View
- Current plan name and status
- Monthly price
- Billing cycle (monthly/annual)
- Next billing date or trial end date
- Plan limits (attendees, admins, meetings, storage)

### 2. Usage Tracking
Real-time usage bars showing:
- **Attendees This Month** - Current vs. limit
- **Meetings This Month** - Current vs. limit
- **Storage Used** - Current vs. limit

**Color Coding:**
- Green (0-69%) - Normal usage
- Orange (70-89%) - Warning
- Red (90-100%) - Approaching/exceeded limit

### 3. Available Plans
Browse all available subscription plans with:
- Plan name and description
- Price (monthly or annual)
- All limits and features
- "Select Plan" button (disabled for current plan)

### 4. Self-Service Plan Selection
**Requirement:** Must be a **Super Admin** of the organization

**Steps:**
1. Go to https://gsams.vercel.app/subscription.html
2. Toggle billing cycle (Monthly or Annual)
3. Review available plans
4. Click "Select Plan" on desired plan
5. Confirm the change
6. Plan changes immediately

**What Happens:**
- Subscription status changes to "active"
- Trial period ends (if on trial)
- New billing period starts
- Usage limits update to new plan
- Audit log created

**API Endpoints:**
```
GET /api/organization/plans - List available plans
GET /api/organization/subscription - Get current subscription + usage
POST /api/organization/subscription/select-plan - Change plan
```

---

## 📋 Subscription Plans

### Starter Plan - $49/month
**Limits:**
- 500 attendees/month
- 3 admins
- 20 meetings/month
- 2GB storage

**Features:**
- GPS Verification
- Manual Entry
- PDF Export

**Best For:** Small schools, churches (100-500 members)

---

### Professional Plan - $149/month
**Limits:**
- 2,000 attendees/month
- 10 admins
- 100 meetings/month
- 10GB storage

**Features:**
- All Starter features
- SMS Verification
- USSD Verification
- Kiosk Mode
- Custom Forms
- Advanced Analytics
- Excel Export
- Priority Support

**Best For:** Growing organizations (500-2,000 members)

---

### Enterprise Plan - $499/month
**Limits:**
- Unlimited attendees
- 999 admins
- Unlimited meetings
- 100GB storage

**Features:**
- All Professional features
- API Access
- White Label
- SLA (Service Level Agreement)

**Best For:** Large organizations (unlimited)

---

## 🔄 Common Workflows

### Workflow 1: Onboard New Customer with Trial

**As Platform Admin:**
1. Create organization via "Create Organization" button
2. Fill organization details and admin credentials
3. Click on newly created organization
4. Click "Assign Plan" (blue tags icon)
5. Select plan (e.g., Professional)
6. Set billing cycle: Monthly
7. Set trial days: 14
8. Click "Assign Plan"

**Customer Experience:**
- Organization created with 14-day trial
- Trial ends in 14 days
- Can use all Professional plan features
- After 14 days, must upgrade to keep access

---

### Workflow 2: Customer Self-Upgrades from Trial

**As Organization Admin:**
1. Login to organization dashboard
2. Go to https://gsams.vercel.app/subscription.html
3. Review current trial status
4. Check usage bars
5. Choose desired plan (e.g., Professional)
6. Select billing cycle (Monthly or Annual)
7. Click "Select Plan"
8. Confirm upgrade
9. Trial converts to paid subscription immediately

**What Changes:**
- Status: trial → active
- Trial end date removed
- Billing period starts
- Plan features activated

---

### Workflow 3: Downgrade or Upgrade Plan

**As Organization Admin:**
1. Go to subscription page
2. Review current plan and usage
3. Select new plan (higher or lower tier)
4. Choose billing cycle
5. Click "Select Plan"
6. Confirm change

**Important Notes:**
- Changes take effect immediately
- New limits apply right away
- If downgrading, ensure current usage is within new limits
- No prorated refunds (implement payment integration for this)

---

### Workflow 4: Platform Admin Assigns Free Trial

**Use Case:** Demo for potential customer

**Steps:**
1. Create organization
2. Assign plan with 30-90 trial days
3. Send credentials to customer
4. Customer tests system during trial
5. Follow up before trial ends
6. Customer upgrades or trial expires

---

## 🎨 UI Features

### Platform Admin Dashboard
- **Blue tags icon** - Assign Plan button in organizations table
- **Modal** - Beautiful plan assignment interface
- **Validation** - Ensures plan is selected before submission
- **Success message** - Confirms plan assignment

### Organization Subscription Page
- **Gradient background** - Professional look
- **Current plan badge** - Shows which plan is active
- **Usage bars** - Visual representation of limits
- **Plan cards** - Hover effects, current plan highlighted
- **Billing toggle** - Switch between monthly and annual pricing
- **Responsive** - Works on all devices

---

## 🔐 Permissions

### Platform Admin
- ✅ Can view all organizations
- ✅ Can assign any plan to any organization
- ✅ Can set trial periods
- ✅ Can change billing cycles
- ✅ Full control over subscriptions

### Organization Super Admin
- ✅ Can view current subscription
- ✅ Can view usage
- ✅ Can view available plans
- ✅ Can change subscription plan
- ✅ Can choose billing cycle
- ❌ Cannot set trial periods (platform admin only)

### Regular Organization Admin
- ✅ Can view current subscription
- ✅ Can view usage
- ❌ Cannot change subscription plan
- ❌ Must be Super Admin to change plans

---

## 📊 Subscription Statuses

### Trial
- Organization is in free trial period
- `trialEndsAt` date set
- Full access to plan features
- Converts to "active" when plan selected
- Becomes "expired" if trial ends without conversion

### Active
- Paid subscription
- Full access to features
- Billing period tracked
- Usage counted against limits

### Past Due
- Payment failed (future feature)
- Grace period active
- Needs payment method update

### Cancelled
- Organization cancelled subscription
- May continue until period end
- `cancelAtPeriodEnd` flag set

### Expired
- Trial ended without conversion
- Subscription period ended
- Access restricted

---

## 🚀 Testing Instructions

### Test Platform Admin Plan Assignment

1. **Login as Platform Admin:**
   ```
   URL: https://gsams.vercel.app/platform-admin-login.html
   Email: admin@gsams.com
   Password: Admin@123456
   ```

2. **Assign Plan:**
   - Click "Organizations"
   - Find any organization (e.g., "happyday")
   - Click blue tags icon
   - Select "Professional" plan
   - Choose "Monthly" billing
   - Set trial days to 7
   - Click "Assign Plan"

3. **Verify:**
   - Organization table shows plan name
   - Status shows "trial"
   - Refresh and confirm plan persists

---

### Test Organization Admin Plan Selection

1. **Login as Organization Admin:**
   - Use any organization's admin credentials
   - Or create test organization via platform admin

2. **View Subscription:**
   - Go to https://gsams.vercel.app/subscription.html
   - Verify current subscription displays
   - Check usage bars show correct data

3. **Change Plan:**
   - Toggle to "Annual" billing
   - Click "Select Plan" on different plan
   - Confirm change
   - Verify plan updates

4. **Check Dashboard:**
   - Return to organization dashboard
   - Verify new limits apply
   - Check features match new plan

---

## 🔧 API Reference

### Platform Admin Endpoints

**GET /api/platform-admin/plans**
- Returns all subscription plans
- Used to populate plan dropdowns

**POST /api/platform-admin/organizations/:orgId/assign-plan**
- Assigns plan to organization
- Body: `{ planId, billingCycle, trialDays }`
- Returns updated organization

---

### Organization Admin Endpoints

**GET /api/organization/plans**
- Returns active subscription plans
- Available to all authenticated organization users

**GET /api/organization/subscription**
- Returns current subscription + usage
- Available to all authenticated organization users

**POST /api/organization/subscription/select-plan**
- Changes organization's subscription plan
- Requires Super Admin permission
- Body: `{ planId, billingCycle }`
- Returns updated subscription

---

## 💡 Future Enhancements

### Payment Integration
- Stripe/Paystack integration
- Automatic billing
- Payment method management
- Invoice generation
- Prorated charges on plan changes

### Enhanced Features
- Usage alerts (email when 80% of limit reached)
- Automatic trial expiration handling
- Upgrade prompts when limits exceeded
- Billing history and invoices
- Payment receipts
- Subscription pause/resume
- Add-ons (extra storage, attendees, etc.)

---

## ✅ Summary

**What Works Now:**
- ✅ Platform admins can assign plans to organizations
- ✅ Organization admins can view their subscription
- ✅ Organization admins can change plans (self-service)
- ✅ Real-time usage tracking vs. limits
- ✅ Trial period support
- ✅ Monthly and annual billing
- ✅ Beautiful, responsive UI
- ✅ Audit logging for plan changes
- ✅ **Automatic email notifications** (trial expiring at 7, 3, 1 days)
- ✅ **Parent/Guardian SMS notifications** (when child checks in)
- ✅ **Photo verification** for attendance

**What's Needed for Production:**
- ⏳ Payment integration (Stripe/Paystack)
- ⏳ Automated billing
- ⏳ Usage limit enforcement (prevent exceeding limits)
- ⏳ Invoice generation

**Your system is ready for customers!** You can:
1. Create organizations via platform admin
2. Assign them trial subscriptions
3. Let them upgrade themselves
4. Track their usage
5. Manage subscriptions centrally
6. Send automated trial expiration emails
7. Notify parents when children check in
8. Verify attendance with photos

Just add payment integration when you're ready to charge customers.

---

## 📧 Email Notification System

### Configuration
Set these environment variables to enable email notifications:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@gsams.com
EMAIL_FROM_NAME=GSAMS
```

### Automatic Notifications
The system automatically sends:
- **7 days before trial expires**: Warning email
- **3 days before trial expires**: Urgent reminder
- **1 day before trial expires**: Final warning
- **On trial expiration**: Expired notification + status update

### Manual Trigger
Platform admins can manually trigger trial expiration emails:
```
POST /api/platform-admin/notifications/trial-expiration
```

### Test Email
Test your email configuration:
```
POST /api/notifications/test
Body: { "email": "test@example.com" }
```

---

## 📱 Parent/Guardian SMS Notifications

### How It Works
When a child/member checks in to a meeting, their parent/guardian receives an SMS notification.

### Setting Up Parent Contact
Include parent contact in the attendance request:
```javascript
{
  "attendeeInfo": {
    "fullName": "John Smith",
    "phone": "+1234567890",
    "parentContact": {
      "name": "Jane Smith",
      "phone": "+0987654321",
      "email": "parent@example.com",
      "relationship": "parent",
      "notifyOnCheckIn": true,
      "notifyOnCheckOut": true
    }
  }
}
```

### SMS Configuration
Set Twilio environment variables:
```
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 📷 Photo Verification

### Upload Photo with Attendance
```
POST /api/attend/photo
Content-Type: multipart/form-data

Fields:
- photo: (file) JPEG, PNG, or WebP image (max 5MB)
- meetingCode: (string) Meeting access code
- attendeeInfo: (JSON) { "fullName": "John Doe", "phone": "..." }
- locationData: (JSON) { "latitude": ..., "longitude": ... }
- deviceInfo: (JSON) { "userAgent": "...", "platform": "..." }
```

### Add Photo to Existing Attendance
```
POST /api/attend/photo
Content-Type: multipart/form-data

Fields:
- photo: (file) Image file
- attendanceId: (string) Existing attendance record ID
```

### Admin: Verify Photo
```
POST /api/attendance/:attendanceId/verify-photo
Body: { "isVerified": true }
// or
Body: { "isVerified": false, "rejectionReason": "Photo not clear" }
```

### Get Pending Photo Verifications
```
GET /api/attendance/pending-photos
GET /api/attendance/pending-photos?meetingId=123
```

---

**Last Updated:** 2026-01-21
**Status:** ✅ Production Ready (Manual Billing) + Notifications + Photo Verification
