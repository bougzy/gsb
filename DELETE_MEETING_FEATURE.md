# Delete Meeting Feature

## Overview
You can now delete meetings from the dashboard. The system provides intelligent deletion with safeguards for meetings that have attendance records.

---

## How to Delete a Meeting

### Step 1: Find the Meeting
1. Go to the **Meetings** section in the dashboard
2. Locate the meeting you want to delete
3. Click the **red trash icon** (🗑️) in the actions column

### Step 2: Confirm Deletion
You'll see a confirmation dialog:
```
Are you sure you want to delete this meeting?

This action cannot be undone.
```

- Click **OK** to proceed
- Click **Cancel** to keep the meeting

---

## Deletion Scenarios

### Scenario 1: Meeting Without Attendance
If the meeting has **no attendance records**, it will be:
- ✅ Marked as **cancelled** (soft delete)
- ✅ Removed from the active meetings list
- ✅ Preserved in the database for audit purposes

**Result:**
```
✅ Meeting deleted successfully!
```

---

### Scenario 2: Meeting With Attendance Records

If the meeting has attendance records, you'll see an additional confirmation:

```
This meeting has 15 attendance record(s).

Do you want to cancel it anyway?

- Click OK to cancel the meeting (keeps attendance records)
- Click Cancel to keep the meeting
```

**Options:**

1. **Click OK**
   - Meeting is marked as **cancelled**
   - All attendance records are **preserved**
   - Meeting appears in reports as "cancelled"
   - You can still view attendance history

2. **Click Cancel**
   - Meeting remains active
   - No changes made

---

## Technical Details

### Soft Delete (Default)
When you delete a meeting, it's **soft deleted**:
- Status changes to `cancelled`
- Meeting remains in database
- Attendance records are preserved
- Audit trail maintained
- Can still generate reports

### Hard Delete (Not Available in UI)
Hard delete is only available via API for administrators:
```bash
DELETE /api/meetings/{id}?hardDelete=true&deleteAttendance=true
```

This:
- Permanently removes the meeting
- Optionally deletes all attendance records
- Cannot be undone
- Requires special permissions

---

## Permissions

### Who Can Delete Meetings?

- ✅ **Super Admin** - Can delete any meeting
- ✅ **Admin with `canDeleteMeetings` permission**
- ❌ **Regular users** - Cannot delete meetings

If you don't have permission, you'll see:
```
❌ Permission denied
You do not have permission to delete meetings. Contact your administrator.
```

---

## What Happens to Attendance Records?

### Soft Delete (UI)
- ✅ All attendance records are **preserved**
- ✅ You can still view attendance in the Attendance section
- ✅ Reports include cancelled meetings
- ✅ Attendees can see their submission history

### Hard Delete (API Only)
- ⚠️ Optionally deletes attendance records
- ⚠️ Cannot be recovered
- ⚠️ Use with extreme caution

---

## Meeting Status After Deletion

After deletion, the meeting status becomes:
```
cancelled
```

This status:
- Prevents new attendance submissions
- Keeps the meeting in reports
- Maintains audit trail
- Preserves all data

---

## Use Cases

### When to Delete a Meeting

1. **Duplicate Meeting Created**
   - Delete the duplicate
   - Attendance records (if any) are preserved

2. **Meeting Cancelled/Postponed**
   - Delete the original meeting
   - Create a new one for the new date
   - Historical data maintained

3. **Test Meeting**
   - Delete after testing
   - If there's test attendance, it's preserved

4. **Wrong Information**
   - Delete and recreate with correct info
   - Better than editing in most cases

### When NOT to Delete

1. **Meeting Already Has Attendance**
   - Consider ending it instead
   - Soft delete preserves records

2. **Just Want to Close Registration**
   - Use "End Meeting" instead
   - More appropriate action

3. **Temporary Issue**
   - Don't delete
   - Fix the issue directly

---

## Error Messages

### Meeting Not Found
```
❌ Meeting not found
The meeting you are trying to delete does not exist or you do not have permission to delete it.
```

**Causes:**
- Meeting already deleted
- Wrong meeting ID
- No permission to access this organization's meetings

### Permission Denied
```
❌ Permission denied
You do not have permission to delete meetings. Contact your administrator.
```

**Solution:**
- Contact your organization admin
- Request `canDeleteMeetings` permission

### Connection Error
```
❌ Error deleting meeting
```

**Causes:**
- Network issue
- Server down
- Database error

**Solution:**
- Check internet connection
- Try again later
- Contact support

---

## Comparison: Delete vs End Meeting

| Feature | Delete Meeting | End Meeting |
|---------|---------------|-------------|
| **Purpose** | Remove/cancel meeting | Close attendance |
| **Status** | `cancelled` | `completed` |
| **New Attendance** | ❌ Blocked | ❌ Blocked |
| **Existing Records** | ✅ Preserved | ✅ Preserved |
| **Visibility** | Marked as cancelled | Marked as completed |
| **Reports** | Included as cancelled | Included as completed |
| **Best For** | Wrong/duplicate meetings | Normal meeting completion |

---

## Action Buttons Summary

All available meeting actions:

| Button | Icon | Color | Action | When to Use |
|--------|------|-------|--------|-------------|
| View Details | 👁️ | Blue | Show info | View meeting details |
| Copy Link | 🔗 | Primary | Copy URL | Share with attendees |
| QR Code | 📱 | Green | Show QR | Display at venue |
| View Attendance | 👥 | Warning | Show records | Review attendees |
| Activate | ▶️ | Green | Make live | Start meeting |
| End Meeting | ⏹️ | Red | Complete | Close meeting |
| **Delete** | **🗑️** | **Red** | **Cancel** | **Remove meeting** |

---

## Best Practices

### Before Deleting
1. ✅ Check if meeting has attendance
2. ✅ Consider "End Meeting" instead
3. ✅ Confirm you have the right meeting
4. ✅ Understand soft delete preserves data

### After Deleting
1. ✅ Verify meeting is marked as cancelled
2. ✅ Check attendance records are preserved
3. ✅ Create a new meeting if needed
4. ✅ Notify attendees if necessary

### Safety Tips
- ⚠️ Always read confirmation dialogs carefully
- ⚠️ Understand deletion is permanent (soft delete)
- ⚠️ Keep attendance records unless absolutely necessary
- ⚠️ Use "End Meeting" for normal completion

---

## Developer Notes

### Frontend Implementation
```javascript
// Soft delete with attendance check
async function deleteMeeting(meetingId) {
    // First try soft delete
    DELETE /api/meetings/{id}

    // If has attendance, ask for confirmation
    if (response.attendanceCount > 0) {
        // Force delete with attendance preservation
        DELETE /api/meetings/{id}?force=true
    }
}
```

### Backend API
```javascript
// Endpoint
DELETE /api/meetings/:meetingId

// Query Parameters
?force=true           // Delete even with attendance
?hardDelete=true      // Permanent delete (admin only)
?deleteAttendance=true // Also delete attendance records
```

### Event Delegation
Delete button uses event delegation:
```javascript
meetingsTable.addEventListener('click', function(e) {
    const deleteBtn = e.target.closest('.delete-meeting-btn');
    if (deleteBtn) {
        deleteMeeting(meetingId);
    }
});
```

---

## Status

🟢 **Delete Meeting Feature FULLY OPERATIONAL**

- ✅ Delete button added to all meetings
- ✅ Soft delete with attendance preservation
- ✅ Intelligent confirmation dialogs
- ✅ Permission checks
- ✅ Audit logging
- ✅ Error handling
- ✅ Success notifications

---

**Last Updated:** January 19, 2026
**Feature Version:** 1.0.0
