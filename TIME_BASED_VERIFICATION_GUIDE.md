# Time-Based Attendance Verification - Complete Guide

## Overview

The system now supports **time-based attendance verification**, allowing admins to require attendees to stay at a meeting location for a minimum duration before their attendance is approved.

## Key Features

### 1. Minimum Stay Requirement
- Admin sets minimum time attendees must stay (e.g., 30 minutes, 1 hour, 2 hours)
- System tracks check-in and check-out times
- Attendance only verified if minimum stay is met

### 2. Duration Tracking
- Automatic tracking of how long each attendee stays
- Real-time duration display in admin dashboard
- Visual indicators showing if requirements are met

### 3. Auto-Verification
- Optional automatic approval when minimum stay is reached
- Reduces admin workload
- Ensures consistent enforcement of time requirements

### 4. Continuous Monitoring
- Optional location monitoring throughout the stay
- Ensures attendees don't leave and return
- Tracks presence percentage over time

---

## How to Use

### For Admins: Creating a Meeting with Time Verification

#### Step 1: Go to Create Meeting

1. Open Dashboard → Meetings
2. Click "Create New Meeting"
3. Fill in basic meeting details (title, time, location, etc.)

#### Step 2: Enable Time Verification

Scroll down to **"Time Verification Settings"** section:

```
┌────────────────────────────────────────────────┐
│ ⏰ Time Verification Settings                  │
├────────────────────────────────────────────────┤
│ ℹ️ Require attendees to stay at the location  │
│    for a minimum duration before approval     │
│                                                │
│ ☑ Require Minimum Stay Duration               │
│   Attendees must stay at location for         │
│   specified time                               │
└────────────────────────────────────────────────┘
```

**Check the box** to enable time verification.

#### Step 3: Configure Settings

Once enabled, you'll see these options:

**A. Minimum Stay Required (minutes)**
```
┌──────────────────────────────────────┐
│ Minimum Stay Required (minutes) *    │
│ [    30    ] minutes                 │
│ How long attendees must stay         │
└──────────────────────────────────────┘
```
- Set how long attendees must stay (e.g., 30 minutes)
- This is the MINIMUM time required for approval

**B. Auto-Verify After (minutes)**
```
┌──────────────────────────────────────┐
│ Auto-Verify After (minutes)          │
│ [    30    ] minutes                 │
│ Auto-approve when this duration met  │
└──────────────────────────────────────┘
```
- When attendee reaches this duration, auto-approve
- Usually same as minimum stay

**C. Enable Continuous Monitoring** (Optional)
```
☐ Enable Continuous Location Monitoring
  Track if attendee stays at location
  throughout duration
```

If you enable monitoring, additional options appear:

```
  Check Interval (minutes): [  5  ]
  How often to check location

  Max Allowed Absence (minutes): [  2  ]
  Allowed time outside location
```

**D. Auto-Approve When Duration Met**
```
☑ Auto-Approve When Duration Met
  Automatically verify attendance after
  minimum stay
```
- Recommended: Keep this checked
- System will auto-approve when requirements are met

#### Step 4: Create Meeting

Click "Next" → "Create Meeting"

---

## How It Works

### Scenario 1: Church Service (30-minute minimum stay)

**Admin Setup:**
```
Meeting: "Sunday Service"
Time: 10:00 AM - 12:00 PM
Minimum Stay: 30 minutes
Auto-Verify: Enabled (30 minutes)
Continuous Monitoring: Disabled
```

**Attendee Flow:**

**9:55 AM** - John arrives at church

**10:00 AM** - John opens meeting link, submits attendance
- System records: Check-in time = 10:00 AM
- Status: Pending
- Duration: 0 minutes

**10:15 AM** - Admin checks dashboard
- Sees: "John Doe - 15 min (ongoing) - 30 min required"
- Badge: Red (requirement not met)
- Admin cannot approve yet (or can override)

**10:30 AM** - System auto-checks
- Duration: 30 minutes ✓
- Requirement: 30 minutes
- Status: Automatically changed to "Verified"
- Admin sees: "John Doe - 30 min ✓ - Verified"

**12:00 PM** - John leaves
- Final duration: 120 minutes
- Already verified at 30-minute mark

---

### Scenario 2: Conference with Continuous Monitoring

**Admin Setup:**
```
Meeting: "Annual Conference"
Minimum Stay: 60 minutes
Continuous Monitoring: Enabled
  Check Interval: 5 minutes
  Max Allowed Absence: 2 minutes
Auto-Verify: Enabled (60 minutes)
```

**Attendee Flow:**

**2:00 PM** - Sarah arrives, marks attendance
- Check-in: 2:00 PM
- Status: Pending

**2:05 PM** - First location check
- Location: At venue ✓
- Presence: 100%

**2:10 PM** - Second location check
- Location: At venue ✓
- Presence: 100%

**2:25 PM** - Sarah leaves venue briefly (restroom)
- Location: Outside venue
- Duration outside: 3 minutes
- Allowed absence: 2 minutes
- ⚠️ Warning logged

**2:28 PM** - Sarah returns
- Location: At venue ✓
- Total absence: 3 minutes (flagged)

**2:30 PM** - Location check
- Still at venue ✓

**3:00 PM** - Auto-verification check
- Duration: 60 minutes
- Requirement: 60 minutes
- Continuous presence: 95% (flagged for brief absence)
- Status: Pending (not auto-verified due to absence)
- Admin must manually review

**Admin Review:**
- Sees: "Sarah - 60 min (3 min absence) - Pending"
- Decides: Minor absence acceptable → Manually verifies

---

### Scenario 3: Exam Proctoring (strict monitoring)

**Admin Setup:**
```
Meeting: "Final Exam"
Minimum Stay: 120 minutes (2 hours)
Continuous Monitoring: Enabled
  Check Interval: 2 minutes
  Max Allowed Absence: 0 minutes
Auto-Verify: Disabled (manual review only)
```

**Attendee Flow:**

**9:00 AM** - Students mark attendance
**9:00-11:00 AM** - System checks every 2 minutes
- Any student leaving venue flagged immediately
- Admin receives real-time alerts

**11:00 AM** - Exam ends (2 hours)
- System shows: "120 min ✓"
- Status: Still Pending (auto-verify disabled)
- Admin reviews location history before approving

---

## Admin Dashboard View

### Attendance Table

```
┌─────────────┬─────────────┬────────────────┬────────────┬──────────┐
│ Name        │ Meeting     │ Check-in Time  │ Duration   │ Status   │
├─────────────┼─────────────┼────────────────┼────────────┼──────────┤
│ John Doe    │ Service     │ 10:00 AM       │ 30 min ✓  │ Verified │
│ Jane Smith  │ Service     │ 10:05 AM       │ 25 min     │ Pending  │
│             │             │                │ (30 req)   │          │
│ Bob Jones   │ Service     │ 10:10 AM       │ 20 min     │ Pending  │
│             │             │                │ (ongoing)  │          │
│ Alice Brown │ Conference  │ 2:00 PM        │ 45 min ✓  │ Verified │
│ Mike Wilson │ Conference  │ 2:15 PM        │ 30 min     │ Pending  │
│             │             │                │ (60 req)   │          │
└─────────────┴─────────────┴────────────────┴────────────┴──────────┘
```

### Duration Badge Colors

**Green (✓):**
- Minimum stay requirement met
- Ready for verification or already verified

**Red (X min required):**
- Minimum stay NOT met
- Shows how many minutes required
- Cannot auto-verify yet

**Yellow (ongoing):**
- Attendee still at location
- Duration counting up
- Will auto-verify when requirement met

**Blue (X min):**
- Completed attendance
- Shows final duration
- Already checked out

---

## Use Cases

### 1. Church Services
**Requirement:** 30-minute minimum stay
**Why:** Ensure members attend full service
**Settings:**
- Minimum Stay: 30 minutes
- Auto-Verify: Yes
- Monitoring: No (trust-based)

### 2. Company Training
**Requirement:** Full attendance (2 hours)
**Why:** Compliance, certification
**Settings:**
- Minimum Stay: 120 minutes
- Auto-Verify: Yes
- Monitoring: Yes (every 5 min)
- Max Absence: 5 minutes (bathroom breaks)

### 3. University Lectures
**Requirement:** 50-minute minimum
**Why:** Attendance tracking for credits
**Settings:**
- Minimum Stay: 50 minutes
- Auto-Verify: Yes
- Monitoring: No

### 4. Exams/Proctoring
**Requirement:** Entire exam duration
**Why:** Academic integrity
**Settings:**
- Minimum Stay: 120 minutes
- Auto-Verify: No (manual review)
- Monitoring: Yes (every 2 min)
- Max Absence: 0 minutes (strict)

### 5. Conferences/Seminars
**Requirement:** Partial attendance acceptable
**Why:** Networking breaks allowed
**Settings:**
- Minimum Stay: 120 minutes (3-hour event)
- Auto-Verify: Yes
- Monitoring: Yes
- Max Absence: 15 minutes (coffee breaks)

---

## Configuration Reference

### Meeting Creation Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| **Require Minimum Stay** | Checkbox | Unchecked | Enable time verification |
| **Minimum Stay (min)** | Number | 30 | Required duration in minutes |
| **Auto-Verify After (min)** | Number | 30 | When to auto-approve |
| **Continuous Monitoring** | Checkbox | Unchecked | Track throughout stay |
| **Check Interval (min)** | Number | 5 | How often to check location |
| **Max Allowed Absence (min)** | Number | 2 | Tolerance for leaving |
| **Auto-Approve When Met** | Checkbox | Checked | Auto-verify on completion |

### Backend API

**Time Verification Object:**
```json
{
  "timeVerification": {
    "requireMinimumStay": true,
    "minimumStayMinutes": 30,
    "enableContinuousMonitoring": false,
    "monitoringInterval": 5,
    "maxAllowedAbsence": 2,
    "autoVerifyAfterStay": true,
    "autoVerifyMinutes": 30
  }
}
```

**Attendance Record Time Tracking:**
```json
{
  "timeTracking": {
    "checkInTime": "2026-01-20T10:00:00Z",
    "checkOutTime": "2026-01-20T11:30:00Z",
    "totalDuration": 90,
    "meetsTimeRequirement": true,
    "locationHistory": [
      {
        "timestamp": "2026-01-20T10:00:00Z",
        "latitude": 6.524419,
        "longitude": 3.379206,
        "isWithinRadius": true
      }
    ]
  },
  "verificationDetails": {
    "minimumStayRequired": 30,
    "requiresTimeVerification": true
  }
}
```

---

## FAQ

### Q: Can attendees leave and return?

**A:** Depends on your settings.

- **Without Continuous Monitoring:** System only tracks check-in time. Attendees could theoretically leave and return. Duration is calculated from check-in to now (or check-out).

- **With Continuous Monitoring:** System checks location every X minutes. If attendee leaves for more than "Max Allowed Absence", they're flagged and may not be auto-verified.

### Q: What happens if someone's phone dies?

**A:**
- Their last known check-in time is saved
- Duration calculated up to last successful location check
- Admin can manually verify based on circumstances
- Recommendation: Use reasonable "Max Allowed Absence" (5-10 min)

### Q: Can admin override and approve before minimum time?

**A:**
- Yes! Admin can manually click "Verify" anytime
- Time requirement is enforced for auto-verification only
- Admin has final authority

### Q: What if meeting runs longer than expected?

**A:**
- Duration continues tracking until attendee leaves or admin closes meeting
- No maximum duration (only minimum)
- Final duration shown in records

### Q: How accurate is the duration tracking?

**A:**
- **Check-in:** Exact timestamp when attendance submitted
- **Check-out:** When attendee leaves radius (if monitoring enabled) or when meeting ends
- **Without monitoring:** Duration = time between check-in and now/meeting end
- **With monitoring:** More accurate, tracks actual presence

### Q: Can I change settings after creating meeting?

**A:**
- Yes, edit the meeting
- Time verification settings can be updated
- Changes apply to new attendances
- Existing attendances keep original requirements

---

## Best Practices

### 1. Set Realistic Minimums
```
✓ Good: 30 min for 1-hour service
✓ Good: 50 min for 1-hour lecture
✗ Bad: 90 min for 1-hour event (impossible)
```

### 2. Use Monitoring Wisely
```
✓ Use for: Exams, strict compliance
✓ Use for: Paid training (accountability)
✗ Don't use for: Casual meetings
✗ Don't use for: Trust-based communities
```

### 3. Allow Reasonable Absence
```
✓ Good: 5-10 min (bathroom, calls)
✗ Bad: 0 min (too strict, tech issues)
```

### 4. Communicate Requirements
```
Tell attendees in advance:
- "Must stay at least 30 minutes"
- "Location will be monitored every 5 minutes"
- "Leaving early may result in unverified attendance"
```

### 5. Manual Review Option
```
✓ Enable auto-verify for routine meetings
✓ Disable auto-verify for high-stakes (exams)
✓ Always allow admin override
```

---

## Troubleshooting

### Issue: Auto-verification not working

**Check:**
1. "Auto-Approve When Duration Met" is checked
2. Attendee has reached minimum stay duration
3. If monitoring enabled, attendee hasn't exceeded max absence
4. Attendance status was "pending" (not "flagged" or "rejected")

### Issue: Duration shows incorrectly

**Causes:**
- Attendee's device time is wrong
- Check-in time not recorded properly
- Check-out time not set

**Solution:**
- Admin can manually review and adjust
- Check attendance details for full history

### Issue: Continuous monitoring not working

**Check:**
1. "Enable Continuous Monitoring" is checked
2. Monitoring interval is reasonable (2-10 min)
3. Attendee's GPS is enabled
4. Attendee has internet connection

---

## Summary

✅ **Admins can now:**
- Set minimum stay requirements
- Track how long attendees stay
- Auto-verify when requirements met
- Monitor continuous presence
- Manually review and override

✅ **Attendees:**
- Must stay at location for specified time
- Duration tracked automatically
- Auto-approved when requirement met
- Can see their own duration status

✅ **System:**
- Tracks check-in/check-out times
- Calculates duration accurately
- Monitors presence throughout stay (optional)
- Auto-verifies based on settings
- Provides detailed time tracking data

---

**Status:** ✅ Live and Deployed
**Backend:** Fully implemented
**Frontend:** UI added to meeting creation form
**Dashboard:** Duration column added to attendance table

**Last Updated:** January 20, 2026
