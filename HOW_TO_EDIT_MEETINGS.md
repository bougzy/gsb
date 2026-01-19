# How to Edit Meetings - Quick Guide

## Where to Find the Edit Button

The **Edit** button is located in the **Meetings** section of your dashboard.

### Step-by-Step:

1. **Go to Meetings Section**
   - Click on "Meetings" in the left sidebar
   - Or navigate to the Meetings tab

2. **Find Your Meeting**
   - Look at the list of meetings in the table
   - Each row shows: Title, Schedule, Location, Status, Actions

3. **Look for the Edit Button**
   - In the "Actions" column (last column)
   - Yellow button with pencil icon ✏️
   - Says "**Edit**"
   - Located next to the View (eye) button

### Visual Layout:

```
┌─────────────────────────────────────────────────────────────┐
│ Meeting Title │ Schedule  │ Location │ Status │ Actions     │
├─────────────────────────────────────────────────────────────┤
│ Prayer Meet   │ Jan 20... │ Church   │ draft  │ [👁️] [✏️Edit]│
│                                                 [🔗] [📱]    │
│                                                 [👥]         │
│                                                 [▶️] [🗑️]    │
└─────────────────────────────────────────────────────────────┘
```

## Button Appearance

**Edit Button:**
- 🟡 **Color:** Yellow/Warning (btn-warning)
- 📝 **Icon:** Pencil (fas fa-edit)
- 📄 **Text:** "Edit"
- 🔘 **Size:** Small button

## When Edit Button Shows

### ✅ Edit Button WILL Show For:
- **Draft meetings** - Not yet activated
- **Active meetings** - Currently accepting attendance (with warning)

### ❌ Edit Button WON'T Show For:
- **Completed meetings** - Already finished
- **Cancelled meetings** - Deleted/cancelled
- **In-progress meetings** - Currently ongoing

## What Happens When You Click Edit

1. **Warning Dialog (if active meeting):**
   ```
   ⚠️ WARNING: This meeting is currently active!

   Editing an active meeting may affect attendees who are
   currently registering.

   Recommended actions:
   • End the meeting first, then create a new one
   • Or only make minor adjustments

   Do you want to proceed with editing?
   ```

2. **Edit Modal Opens:**
   - Large modal window
   - Title: "Edit Meeting: [Meeting Name]"
   - Info banner at top
   - All fields pre-filled with current values

3. **Make Your Changes:**
   - Update any field you want
   - Add/remove custom fields
   - Modify schedule, location, etc.

4. **Click "Update Meeting":**
   - Changes are saved
   - Modal closes
   - Success message appears
   - Meeting list refreshes

## Editable Fields

### Basic Information
- ✏️ Meeting Title
- ✏️ Description
- ✏️ Start Date & Time
- ✏️ End Date & Time

### Location
- ✏️ Location Name
- ✏️ Latitude
- ✏️ Longitude
- ✏️ Allowed Radius (meters)

### Attendance Settings
- ✏️ Allowed Modes (GPS, SMS, USSD)
- ✏️ Required Fields (Email, Phone, ID Number)

### Custom Form Fields
- ➕ Add new fields
- ✏️ Edit existing fields (label, type, required)
- 🗑️ Remove fields
- 📝 Change field types
- 🔢 Modify dropdown options

### What CANNOT Be Changed
- ❌ Access Codes (publicCode, smsCode, ussdCode)
- ❌ Meeting ID
- ❌ Creation Date
- ❌ Organization

## Example: Editing a Draft Meeting

### Scenario
You created "Prayer Meeting" but made a typo in the title.

### Steps:
1. Go to Meetings section
2. Find "Prayer Meeting" in the list
3. Status should be "draft" (gray badge)
4. Click yellow **[✏️ Edit]** button
5. Modal opens with "Edit Meeting: Prayer Meeting"
6. Change title to "Sunday Prayer Meeting"
7. Click "Update Meeting"
8. Success! ✅

## Example: Editing an Active Meeting

### Scenario
Meeting is active but you need to change the end time.

### Steps:
1. Find the active meeting (green badge)
2. Click **[✏️ Edit]** button
3. ⚠️ Warning appears about editing active meeting
4. Click "OK" to proceed
5. Change End Date & Time
6. Click "Update Meeting"
7. ⚠️ Note: Attendees already registered are not affected

## Troubleshooting

### "I don't see the Edit button!"

**Check 1: Meeting Status**
- Edit button only shows for draft and active meetings
- If status is "completed" or "cancelled", you can't edit
- Solution: Create a new meeting instead

**Check 2: Permissions**
- You need edit permission
- Only admins with `canEditMeetings` permission can edit
- Solution: Contact super admin for permissions

**Check 3: Screen Size**
- On small screens, buttons might wrap
- Scroll right in the Actions column
- Solution: Use a larger screen or zoom out

**Check 4: Page Not Loaded**
- Meeting list might still be loading
- Refresh the page (Cmd+R or Ctrl+R)
- Solution: Wait for page to fully load

### "Edit button is grayed out"

This shouldn't happen, but if it does:
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Clear cache and reload
- Log out and log back in

### "Modal won't open"

**Possible causes:**
- JavaScript error
- Network issue
- Meeting doesn't exist

**Solutions:**
- Check browser console for errors (F12)
- Refresh the page
- Try a different browser

### "Changes aren't saving"

**Check:**
1. Fill all required fields (marked with *)
2. Check browser console for errors
3. Verify internet connection
4. Make sure you clicked "Update Meeting" not "Cancel"

**Solutions:**
- Try again
- Check field validation
- Log out and back in

## Quick Tips

✅ **DO:**
- Edit draft meetings freely
- Fix typos and minor errors
- Update times if schedule changes
- Add custom fields as needed
- Test changes before activating

❌ **DON'T:**
- Edit active meetings unless urgent
- Change critical info after activation
- Edit if attendees are currently registering
- Forget to click "Update Meeting"

## Button Reference

All buttons in the Actions column:

| Button | Icon | Color | Action |
|--------|------|-------|--------|
| **View** | 👁️ | Blue | View details |
| **Edit** | ✏️ | Yellow | Edit meeting |
| **Copy** | 🔗 | Blue | Copy link |
| **QR** | 📱 | Green | Show QR code |
| **Attendance** | 👥 | Gray | View attendance |
| **Activate** | ▶️ | Green | Start meeting |
| **End** | ⏹️ | Red | End meeting |
| **Delete** | 🗑️ | Red | Delete meeting |

## Screenshots Guide

### 1. Finding the Edit Button
```
Meetings Table:
┌──────────────────────────────────────────────────┐
│ Title          │ Status │ Actions               │
├──────────────────────────────────────────────────┤
│ Prayer Meeting │ draft  │ [View] [✏️ Edit]      │ ← HERE!
│                │        │ [Link] [QR]           │
│                │        │ [Attendance]          │
│                │        │ [Activate] [Delete]   │
└──────────────────────────────────────────────────┘
```

### 2. Edit Modal Layout
```
┌─────────────────────────────────────────────────┐
│ Edit Meeting: Prayer Meeting            [X]    │
├─────────────────────────────────────────────────┤
│ ℹ️ Edit Meeting: Update details, schedule...   │
│                                                 │
│ Meeting Title: [Prayer Meeting................]│
│ Description:   [Weekly prayer service.......]  │
│                                                 │
│ Start Time:    [2026-01-20T14:00]              │
│ End Time:      [2026-01-20T15:00]              │
│                                                 │
│ ... more fields ...                             │
│                                                 │
│ [Cancel] [Update Meeting]                       │
└─────────────────────────────────────────────────┘
```

## Need More Help?

- 📖 See [EDIT_MEETING_FEATURE.md](EDIT_MEETING_FEATURE.md) for technical details
- 📖 See [ALL_FEATURES_WORKING.md](ALL_FEATURES_WORKING.md) for all features
- 🐛 Report issues via your admin panel

---

**Summary:**
1. Go to **Meetings** section
2. Find your meeting in the table
3. Click yellow **[✏️ Edit]** button in Actions column
4. Make changes in the modal
5. Click **Update Meeting**
6. Done! ✅

**Last Updated:** January 19, 2026
