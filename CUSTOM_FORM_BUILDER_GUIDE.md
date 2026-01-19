# Custom Form Builder - Complete Guide

## Overview
The GSAMS dashboard now includes a **multi-step meeting creation wizard** with a powerful **custom form builder**. This allows you to create custom attendance forms that attendees must fill when joining meetings.

## ✅ What's Fixed & Added

### 1. Fixed: Meeting Creation Button
- ✅ Meeting creation button now works properly
- ✅ No more errors when clicking "Create New Meeting"
- ✅ Proper form validation and error handling
- ✅ Loading states to prevent double submission

### 2. New: Multi-Step Meeting Creation Wizard

#### Step 1: Basic Information
- Meeting title and description
- Start and end date/time
- Location name with GPS coordinates
- Allowed radius for check-in
- Attendance modes (GPS, SMS, USSD)

#### Step 2: Custom Form Builder
- Configure required default fields
- Add unlimited custom fields
- Multiple field types supported
- Set fields as required or optional

#### Step 3: Review & Create
- Review all meeting details
- See all custom fields configured
- Create meeting with one click

## 📝 Custom Form Builder Features

### Default Required Fields
These fields are available by default and can be toggled on/off:

1. **Full Name** ✓ (Always required - cannot be disabled)
2. **Email Address** ✓ (Optional - can toggle)
3. **Phone Number** ✓ (Optional - can toggle)
4. **ID Number** (Optional - can toggle)

### Custom Field Types

You can add custom fields with the following types:

| Field Type | Description | Example Use Case |
|------------|-------------|------------------|
| **Text** | Short text input | Department, Job Title, Badge Number |
| **Email** | Email validation | Alternative email, Manager email |
| **Number** | Numeric input | Employee ID, Age, Years of service |
| **Phone** | Phone number | Emergency contact, Office extension |
| **Long Text** | Multi-line text | Comments, Reasons, Special requirements |
| **Dropdown** | Select from options | Department, Location, Shift |

### Custom Field Configuration

For each custom field, you can set:
- ✅ **Label** - The field name shown to users
- ✅ **Type** - The input type (text, email, number, etc.)
- ✅ **Required** - Whether the field is mandatory
- ✅ **Options** - For dropdown fields (comma-separated values)

## 🎯 How to Use

### Creating a Meeting with Custom Form

1. **Open Meeting Creation**
   - Click "New Meeting" button (Dashboard or Meetings section)
   - Multi-step wizard opens

2. **Step 1: Fill Basic Information**
   ```
   - Meeting Title: "Monthly Team Meeting"
   - Description: "Regular team sync and updates"
   - Start Time: 2026-01-20 09:00
   - End Time: 2026-01-20 10:00
   - Location Name: "Conference Room A"
   - Latitude: 6.5244 (example for Lagos)
   - Longitude: 3.3792
   - Radius: 100 meters
   - Attendance Modes: ✓ GPS, ✓ SMS, ✓ USSD
   ```
   - Click "Next"

3. **Step 2: Configure Custom Form**

   **A. Select Default Required Fields:**
   ```
   ✓ Full Name (always checked)
   ✓ Email Address
   ✓ Phone Number
   □ ID Number (optional)
   ```

   **B. Add Custom Fields:**

   Click "Add Custom Field" button for each field you want:

   **Example 1: Department Field**
   ```
   - Label: Department
   - Type: Dropdown
   - Required: Yes
   - Options: Sales, Marketing, IT, HR, Finance
   ```

   **Example 2: Employee ID**
   ```
   - Label: Employee ID
   - Type: Number
   - Required: Yes
   ```

   **Example 3: Comments**
   ```
   - Label: Special Requirements
   - Type: Long Text
   - Required: No
   ```

   - Click "Next"

4. **Step 3: Review & Create**
   - Review all meeting details
   - Check custom fields configuration
   - Click "Create Meeting"
   - Meeting created successfully! ✅

### Example Custom Form Configurations

#### Example 1: Corporate Event
```
Default Fields:
✓ Full Name
✓ Email
✓ Phone

Custom Fields:
1. Department (Dropdown - Required)
   Options: Sales, Marketing, IT, HR, Operations
2. Job Title (Text - Optional)
3. Dietary Restrictions (Long Text - Optional)
4. T-Shirt Size (Dropdown - Optional)
   Options: S, M, L, XL, XXL
```

#### Example 2: Training Session
```
Default Fields:
✓ Full Name
✓ Email
✓ ID Number

Custom Fields:
1. Organization (Text - Required)
2. Experience Level (Dropdown - Required)
   Options: Beginner, Intermediate, Advanced
3. Specific Topics of Interest (Long Text - Optional)
```

#### Example 3: Conference Registration
```
Default Fields:
✓ Full Name
✓ Email
✓ Phone

Custom Fields:
1. Company Name (Text - Required)
2. Job Title (Text - Required)
3. Industry (Dropdown - Required)
   Options: Technology, Finance, Healthcare, Education, Other
4. Years of Experience (Number - Optional)
5. LinkedIn Profile (Text - Optional)
6. Accommodation Needed (Dropdown - Required)
   Options: Yes, No
```

## 📱 How Attendees See the Form

When attendees click the meeting link or scan the QR code:

1. They land on the attendance page
2. They see the meeting title and details
3. They fill the custom form with:
   - Default required fields (Full Name, Email, etc.)
   - Any custom fields you added
4. Their GPS location is captured (if GPS mode is enabled)
5. They submit attendance
6. Confirmation shown ✅

### Example Attendance Form (from Attendee's View)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 📍 Monthly Team Meeting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Full Name *
[___________________________]

Email Address *
[___________________________]

Phone Number *
[___________________________]

Department * (Dropdown)
[Select Department ▼]
  - Sales
  - Marketing
  - IT
  - HR
  - Finance

Employee ID *
[___________________________]

Special Requirements (Optional)
[                           ]
[                           ]
[                           ]

[📍 GPS Location Detected]
Latitude: 6.5244
Longitude: 3.3792
Distance: 45 meters from venue

[✓ Mark Attendance]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🔧 Technical Details

### Data Structure

Custom fields are saved in the meeting document as:

```json
{
  "title": "Monthly Team Meeting",
  "schedule": {
    "startTime": "2026-01-20T09:00:00Z",
    "endTime": "2026-01-20T10:00:00Z"
  },
  "requiredFields": ["fullName", "email", "phone"],
  "customFormFields": [
    {
      "name": "department",
      "label": "Department",
      "type": "select",
      "required": true,
      "options": ["Sales", "Marketing", "IT", "HR", "Finance"]
    },
    {
      "name": "employee_id",
      "label": "Employee ID",
      "type": "number",
      "required": true
    },
    {
      "name": "special_requirements",
      "label": "Special Requirements",
      "type": "textarea",
      "required": false
    }
  ]
}
```

### Attendance Record

When attendee submits, their responses are saved as:

```json
{
  "attendeeInfo": {
    "fullName": "John Doe",
    "email": "john.doe@company.com",
    "phone": "+1234567890"
  },
  "formData": {
    "department": "IT",
    "employee_id": "12345",
    "special_requirements": "Vegetarian meal required"
  },
  "locationData": {
    "latitude": 6.5244,
    "longitude": 3.3792,
    "accuracy": 10
  },
  "verificationType": "smartphone_gps",
  "verificationStatus": "verified"
}
```

## 🎨 UI/UX Improvements

### Visual Progress Indicator
- Step circles show current progress
- Completed steps marked with checkmark ✓
- Active step highlighted in blue
- Clear step titles

### Form Validation
- Required field indicators (*)
- Real-time validation
- Error messages for invalid inputs
- Coordinate range validation (-90 to 90 for lat, -180 to 180 for lon)

### User-Friendly Features
- Tooltips and examples
- Placeholder text for guidance
- Dropdown options for easy selection
- Remove button for custom fields
- Navigation buttons (Previous/Next/Create)

## 📊 Benefits

### For Administrators
✅ Collect exactly the data you need
✅ No coding required - visual form builder
✅ Unlimited custom fields
✅ Flexible field types
✅ Required/optional field control
✅ Reusable templates

### For Attendees
✅ Clear, simple form
✅ Mobile-friendly interface
✅ Quick submission process
✅ Instant confirmation
✅ One-click attendance marking

### For Data Analysis
✅ Structured data collection
✅ Easy export to Excel/PDF
✅ Custom field reporting
✅ Filterable attendance records
✅ Comprehensive analytics

## 🚀 Advanced Use Cases

### 1. Employee Check-In System
```
Custom Fields:
- Employee ID (Number - Required)
- Department (Dropdown - Required)
- Manager Name (Text - Optional)
- Work Station Number (Number - Optional)
```

### 2. Event Registration
```
Custom Fields:
- Company Name (Text - Required)
- Dietary Restrictions (Long Text - Optional)
- Session Preference (Dropdown - Required)
- T-Shirt Size (Dropdown - Optional)
```

### 3. Visitor Management
```
Custom Fields:
- Visitor Type (Dropdown - Required): Guest, Contractor, Vendor
- Host Employee Name (Text - Required)
- Purpose of Visit (Long Text - Required)
- Vehicle Registration (Text - Optional)
```

### 4. Training Attendance
```
Custom Fields:
- Organization (Text - Required)
- Certification Number (Text - Optional)
- Experience Level (Dropdown - Required)
- Special Accommodations (Long Text - Optional)
```

## 🐛 Troubleshooting

### Issue: Create Meeting button not working
**Solution:** The button now works! Make sure:
- You've filled all required fields (marked with *)
- Start time is before end time
- Latitude is between -90 and 90
- Longitude is between -180 and 180

### Issue: Can't see custom fields in attendance form
**Solution:** Make sure:
- You added custom fields in Step 2
- You clicked "Next" after adding fields
- Meeting was created successfully

### Issue: Attendees can't submit form
**Solution:** Check:
- Required custom fields have values
- Dropdown fields have valid options
- GPS is enabled for GPS-mode meetings

## 📱 Mobile Support

All features work perfectly on mobile:
- ✅ Touch-friendly buttons
- ✅ Responsive design
- ✅ Mobile keyboard optimization
- ✅ GPS location on mobile devices
- ✅ Easy form filling

## 🎉 Summary

The new **Custom Form Builder** gives you complete control over attendance data collection:

1. **3-Step Wizard** - Easy meeting creation
2. **Unlimited Custom Fields** - Collect any data
3. **Multiple Field Types** - Text, number, dropdown, etc.
4. **Required/Optional** - Full control
5. **Visual Review** - See before creating
6. **Fixed Bugs** - Create button works perfectly!

Start creating meetings with custom forms now! 🚀
