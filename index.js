// index.js - GSAMS Backend System
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const geolib = require('geolib');
const NodeGeocoder = require('node-geocoder');
const twilio = require('twilio');
// const redis = require('redis');
const { promisify } = require('util');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Redis client for rate limiting
// const redisClient = redis.createClient({
//   url: process.env.REDIS_URL || 'redis://localhost:6379'
// });
// redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(limiter);
app.use(express.urlencoded({ extended: true }));


const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173',
      'https://yourfrontenddomain.com',
      'https://gsf-inky.vercel.app',
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.log('Blocked CORS request from origin:', origin);
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Admin-Username',
    'Admin-Password'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'Content-Disposition'
  ],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// MongoDB Connection
// MongoDB Connection - FIXED VERSION
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://prezent:prezent@prezent.pw70dzq.mongodb.net/prezent')
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Database Models
const Schema = mongoose.Schema;

// Organization Schema
const OrganizationSchema = new Schema({
  name: { type: String, required: true },
  domain: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  settings: {
    defaultLocationRadius: { type: Number, default: 100 }, // meters
    defaultTimeWindow: { type: Number, default: 30 }, // minutes
    allowSMS: { type: Boolean, default: true },
    allowUSSD: { type: Boolean, default: true },
    allowGPS: { type: Boolean, default: true },
    allowKiosk: { type: Boolean, default: true },
    allowManual: { type: Boolean, default: true }
  }
});

// Admin User Schema
const AdminUserSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  phone: { type: String },
  role: { 
    type: String, 
    enum: ['super_admin', 'admin', 'viewer'], 
    default: 'admin' 
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  permissions: {
    canCreateMeetings: { type: Boolean, default: true },
    canEditMeetings: { type: Boolean, default: true },
    canDeleteMeetings: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: true },
    canManageAdmins: { type: Boolean, default: false },
    canApproveAttendance: { type: Boolean, default: true }
  }
});

// Meeting Schema
const MeetingSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  title: { type: String, required: true },
  description: { type: String },
  location: {
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String },
    radius: { type: Number, default: 100 } // meters
  },
  schedule: {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    attendanceStart: { type: Date }, // When attendance can start
    attendanceEnd: { type: Date }, // When attendance ends
    bufferBefore: { type: Number, default: 30 }, // minutes before start
    bufferAfter: { type: Number, default: 30 } // minutes after end
  },
  attendanceConfig: {
    allowedModes: {
      smartphoneGPS: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      ussd: { type: Boolean, default: true },
      kiosk: { type: Boolean, default: true },
      manual: { type: Boolean, default: true }
    },
    requiredFields: [{
      field: { type: String, enum: ['fullName', 'phone', 'email', 'idNumber'], required: true },
      isRequired: { type: Boolean, default: true }
    }],
    verificationStrictness: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'medium' 
    },
    duplicatePrevention: {
      preventSameDevice: { type: Boolean, default: true },
      preventSamePhone: { type: Boolean, default: true },
      preventSameNameTime: { type: Boolean, default: true },
      timeWindowMinutes: { type: Number, default: 5 }
    },
    timeRequirement: {
      minimumMinutes: { type: Number, default: 15 }, // Min time to be considered present
      enableTimeTrack: { type: Boolean, default: false },
      maxAbsenceMinutes: { type: Number, default: 5 }
    }
  },
  accessCodes: {
    publicCode: { type: String, unique: true }, // For QR codes
    smsCode: { type: String }, // For SMS attendance
    ussdCode: { type: String } // For USSD attendance
  },
  status: { 
    type: String, 
    enum: ['draft', 'active', 'in_progress', 'completed', 'cancelled'], 
    default: 'draft' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Attendance Record Schema
const AttendanceRecordSchema = new Schema({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  verificationType: { 
    type: String, 
    enum: ['smartphone_gps', 'sms', 'ussd', 'kiosk', 'manual'],
    required: true 
  },
  attendeeInfo: {
    fullName: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    idNumber: { type: String },
    additionalFields: { type: Map, of: String }
  },
  locationData: {
    // For GPS verification
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number }, // in meters
      altitude: { type: Number },
      altitudeAccuracy: { type: Number },
      heading: { type: Number },
      speed: { type: Number }
    },
    // For indirect verification
    verifiedByAdminLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number }
    },
    distanceFromVenue: { type: Number }, // in meters
    address: { type: String },
    isWithinRadius: { type: Boolean }
  },
  deviceInfo: {
    userAgent: { type: String },
    deviceId: { type: String },
    platform: { type: String },
    ipAddress: { type: String }
  },
  verificationDetails: {
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    verificationMethod: { type: String },
    verifiedByAdminId: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    verificationTimestamp: { type: Date },
    manualVerificationReason: { type: String }
  },
  timeTracking: {
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date },
    totalDuration: { type: Number }, // in minutes
    meetsTimeRequirement: { type: Boolean, default: false }
  },
  status: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected', 'flagged'], 
    default: 'pending' 
  },
  auditTrail: [{
    action: { type: String },
    performedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Device Fingerprint Schema
const DeviceFingerprintSchema = new Schema({
  deviceId: { type: String, required: true, unique: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  lastUsed: { type: Date, default: Date.now },
  metadata: {
    userAgent: { type: String },
    platform: { type: String },
    os: { type: String },
    browser: { type: String },
    screenResolution: { type: String }
  },
  isBlacklisted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// SMS Log Schema
const SMSLogSchema = new Schema({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting' },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  fromNumber: { type: String, required: true },
  toNumber: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'received', 'failed'], default: 'received' },
  attendanceRecordId: { type: Schema.Types.ObjectId, ref: 'AttendanceRecord' }
});

// USSD Session Schema
const USSDSessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting' },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  phoneNumber: { type: String, required: true },
  currentStep: { type: String, default: 'welcome' },
  data: {
    meetingCode: { type: String },
    fullName: { type: String },
    phone: { type: String },
    idNumber: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

// Audit Log Schema
const AuditLogSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  action: { type: String, required: true },
  entityType: { type: String },
  entityId: { type: Schema.Types.ObjectId },
  details: { type: Map, of: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// Create Models
const Organization = mongoose.model('Organization', OrganizationSchema);
const AdminUser = mongoose.model('AdminUser', AdminUserSchema);
const Meeting = mongoose.model('Meeting', MeetingSchema);
const AttendanceRecord = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
const DeviceFingerprint = mongoose.model('DeviceFingerprint', DeviceFingerprintSchema);
const SMSLog = mongoose.model('SMSLog', SMSLogSchema);
const USSDSession = mongoose.model('USSDSession', USSDSessionSchema);
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

// Helper Functions
const generateAccessCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

const calculateConfidenceScore = (verificationType, locationData, meetingConfig) => {
  let score = 0;
  
  switch(verificationType) {
    case 'smartphone_gps':
      score = 90;
      if (locationData.accuracy < 10) score += 5;
      if (locationData.accuracy < 5) score += 5;
      break;
    case 'manual':
      score = 95; // High confidence for admin verification
      break;
    case 'kiosk':
      score = 85;
      break;
    case 'sms':
    case 'ussd':
      score = 75;
      if (locationData.isWithinRadius) score += 10;
      break;
  }
  
  // Adjust based on time proximity to meeting
  const now = new Date();
  const meetingStart = meetingConfig.schedule.startTime;
  const diffHours = Math.abs(now - meetingStart) / (1000 * 60 * 60);
  
  if (diffHours < 1) score += 5;
  if (diffHours > 3) score -= 10;
  
  return Math.min(Math.max(score, 0), 100);
};

const generateAttendancePDF = async (meeting, records, organization) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      // Header
      doc.fontSize(20).text(organization.name, { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text('Attendance Report', { align: 'center' });
      doc.moveDown();
      
      // Meeting Details
      doc.fontSize(12).text(`Meeting: ${meeting.title}`);
      doc.text(`Date: ${moment(meeting.schedule.startTime).format('MMMM Do YYYY, h:mm a')}`);
      doc.text(`Location: ${meeting.location.name}`);
      doc.text(`Address: ${meeting.location.address}`);
      doc.moveDown();
      
      // Summary
      const totalAttendees = records.length;
      const verifiedAttendees = records.filter(r => r.status === 'verified').length;
      const gpsAttendees = records.filter(r => r.verificationType === 'smartphone_gps').length;
      const smsAttendees = records.filter(r => r.verificationType === 'sms').length;
      const ussdAttendees = records.filter(r => r.verificationType === 'ussd').length;
      const kioskAttendees = records.filter(r => r.verificationType === 'kiosk').length;
      const manualAttendees = records.filter(r => r.verificationType === 'manual').length;
      
      doc.fontSize(14).text('Attendance Summary:');
      doc.fontSize(12);
      doc.text(`Total Attendees: ${totalAttendees}`);
      doc.text(`Verified: ${verifiedAttendees}`);
      doc.text(`GPS: ${gpsAttendees} | SMS: ${smsAttendees} | USSD: ${ussdAttendees}`);
      doc.text(`Kiosk: ${kioskAttendees} | Manual: ${manualAttendees}`);
      doc.moveDown();
      
      // Attendee Table
      doc.fontSize(14).text('Attendee List:');
      doc.moveDown(0.5);
      
      // Table Header
      doc.font('Helvetica-Bold');
      doc.text('Name', 50, doc.y);
      doc.text('Phone', 200, doc.y);
      doc.text('Method', 300, doc.y);
      doc.text('Time', 370, doc.y);
      doc.text('Status', 450, doc.y);
      doc.moveDown();
      
      // Table Rows
      doc.font('Helvetica');
      let yPos = doc.y;
      records.forEach((record, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.text(record.attendeeInfo.fullName || '-', 50, yPos);
        doc.text(record.attendeeInfo.phone || '-', 200, yPos);
        doc.text(record.verificationType.replace('_', ' ').toUpperCase(), 300, yPos);
        doc.text(moment(record.timeTracking.checkInTime).format('HH:mm'), 370, yPos);
        
        // Status with color coding
        doc.fillColor(record.status === 'verified' ? 'green' : 
                     record.status === 'pending' ? 'orange' : 'red');
        doc.text(record.status.toUpperCase(), 450, yPos);
        doc.fillColor('black');
        
        yPos += 20;
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 10;
      });
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(10).text(`Report generated on ${moment().format('MMMM Do YYYY, h:mm:ss a')}`, { align: 'center' });
      doc.text(`Total pages: ${doc.bufferedPageRange().count}`, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const generateAttendanceExcel = async (meeting, records, organization) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance');
  
  // Organization Header
  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = organization.name;
  worksheet.getCell('A1').font = { size: 16, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  
  worksheet.mergeCells('A2:F2');
  worksheet.getCell('A2').value = 'Attendance Report';
  worksheet.getCell('A2').font = { size: 14, bold: true };
  worksheet.getCell('A2').alignment = { horizontal: 'center' };
  
  // Meeting Details
  worksheet.mergeCells('A4:F4');
  worksheet.getCell('A4').value = `Meeting: ${meeting.title}`;
  
  worksheet.mergeCells('A5:F5');
  worksheet.getCell('A5').value = `Date: ${moment(meeting.schedule.startTime).format('MMMM Do YYYY, h:mm a')}`;
  
  worksheet.mergeCells('A6:F6');
  worksheet.getCell('A6').value = `Location: ${meeting.location.name} - ${meeting.location.address}`;
  
  // Summary
  const summaryRow = 8;
  worksheet.getCell(`A${summaryRow}`).value = 'Summary';
  worksheet.getCell(`A${summaryRow}`).font = { bold: true };
  
  const totalAttendees = records.length;
  const verifiedAttendees = records.filter(r => r.status === 'verified').length;
  const gpsAttendees = records.filter(r => r.verificationType === 'smartphone_gps').length;
  const smsAttendees = records.filter(r => r.verificationType === 'sms').length;
  const ussdAttendees = records.filter(r => r.verificationType === 'ussd').length;
  const kioskAttendees = records.filter(r => r.verificationType === 'kiosk').length;
  const manualAttendees = records.filter(r => r.verificationType === 'manual').length;
  
  worksheet.addRow(['Total Attendees', totalAttendees]);
  worksheet.addRow(['Verified Attendees', verifiedAttendees]);
  worksheet.addRow(['GPS Attendance', gpsAttendees]);
  worksheet.addRow(['SMS Attendance', smsAttendees]);
  worksheet.addRow(['USSD Attendance', ussdAttendees]);
  worksheet.addRow(['Kiosk Attendance', kioskAttendees]);
  worksheet.addRow(['Manual Attendance', manualAttendees]);
  
  // Attendee List Header
  const headerRow = summaryRow + 10;
  worksheet.getCell(`A${headerRow}`).value = 'Full Name';
  worksheet.getCell(`B${headerRow}`).value = 'Phone';
  worksheet.getCell(`C${headerRow}`).value = 'Email';
  worksheet.getCell(`D${headerRow}`).value = 'ID Number';
  worksheet.getCell(`E${headerRow}`).value = 'Verification Method';
  worksheet.getCell(`F${headerRow}`).value = 'Check-in Time';
  worksheet.getCell(`G${headerRow}`).value = 'Check-out Time';
  worksheet.getCell(`H${headerRow}`).value = 'Duration (min)';
  worksheet.getCell(`I${headerRow}`).value = 'Status';
  worksheet.getCell(`J${headerRow}`).value = 'Confidence Score';
  worksheet.getCell(`K${headerRow}`).value = 'Location';
  worksheet.getCell(`L${headerRow}`).value = 'Distance from Venue (m)';
  
  // Style header
  for (let i = 1; i <= 12; i++) {
    const cell = worksheet.getCell(headerRow, i);
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }
  
  // Add attendance records
  records.forEach((record, index) => {
    const row = headerRow + index + 1;
    
    worksheet.getCell(`A${row}`).value = record.attendeeInfo.fullName;
    worksheet.getCell(`B${row}`).value = record.attendeeInfo.phone;
    worksheet.getCell(`C${row}`).value = record.attendeeInfo.email;
    worksheet.getCell(`D${row}`).value = record.attendeeInfo.idNumber;
    worksheet.getCell(`E${row}`).value = record.verificationType.replace('_', ' ').toUpperCase();
    worksheet.getCell(`F${row}`).value = moment(record.timeTracking.checkInTime).format('YYYY-MM-DD HH:mm:ss');
    worksheet.getCell(`G${row}`).value = record.timeTracking.checkOutTime ? 
      moment(record.timeTracking.checkOutTime).format('YYYY-MM-DD HH:mm:ss') : '';
    worksheet.getCell(`H${row}`).value = record.timeTracking.totalDuration || '';
    worksheet.getCell(`I${row}`).value = record.status.toUpperCase();
    worksheet.getCell(`J${row}`).value = record.verificationDetails.confidenceScore;
    worksheet.getCell(`K${row}`).value = record.locationData.address || 
      `${record.locationData.coordinates?.latitude}, ${record.locationData.coordinates?.longitude}`;
    worksheet.getCell(`L${row}`).value = record.locationData.distanceFromVenue || '';
    
    // Color code status
    const statusCell = worksheet.getCell(`I${row}`);
    if (record.status === 'verified') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC6EFCE' }
      };
    } else if (record.status === 'pending') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFEB9C' }
      };
    } else {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' }
      };
    }
    
    // Add borders
    for (let i = 1; i <= 12; i++) {
      const cell = worksheet.getCell(row, i);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  });
  
  // Auto fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, cell => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = Math.min(maxLength + 2, 30);
  });
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = await AdminUser.findById(decoded.userId).populate('organizationId');
    
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ error: 'User account is inactive or not found' });
    }
    
    // Log the action
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'API_ACCESS',
      entityType: 'route',
      entityId: null,
      details: { route: req.path, method: req.method },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Check if user is super admin
const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Check organization access
const checkOrganizationAccess = async (req, res, next) => {
  const organizationId = req.params.organizationId || req.body.organizationId;
  
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' });
  }
  
  if (req.user.organizationId._id.toString() !== organizationId.toString()) {
    return res.status(403).json({ error: 'Access to this organization denied' });
  }
  
  next();
};

// Generate QR Code for meeting
const generateMeetingQRCode = async (meetingCode) => {
  const url = `${process.env.FRONTEND_URL || 'https://gsf-inky.vercel.app'}/attend/${meetingCode}`;
  try {
    const qrCode = await QRCode.toDataURL(url);
    return qrCode;
  } catch (error) {
    console.error('QR Code generation error:', error);
    return null;
  }
};

// Routes

// 1. Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, organizationName } = req.body;
    
    // Check if user already exists
    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create organization (first user becomes super admin)
    const organization = await Organization.create({
      name: organizationName,
      domain: email.split('@')[1]
    });
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create super admin user
    const user = await AdminUser.create({
      organizationId: organization._id,
      email,
      password: hashedPassword,
      fullName,
      phone,
      role: 'super_admin',
      permissions: {
        canCreateMeetings: true,
        canEditMeetings: true,
        canDeleteMeetings: true,
        canViewReports: true,
        canManageAdmins: true,
        canApproveAttendance: true
      }
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role, organizationId: organization._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    // Log the registration
    await AuditLog.create({
      organizationId: organization._id,
      userId: user._id,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user._id,
      details: { email, role: 'super_admin' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: {
          id: organization._id,
          name: organization.name
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await AdminUser.findOne({ email }).populate('organizationId');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role, organizationId: user.organizationId._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    // Log the login
    await AuditLog.create({
      organizationId: user.organizationId._id,
      userId: user._id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user._id,
      details: { email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        organization: {
          id: user.organizationId._id,
          name: user.organizationId.name
        },
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 2. Organization Routes
app.get('/api/organization', authenticateToken, async (req, res) => {
  try {
    const organization = await Organization.findById(req.user.organizationId._id);
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

app.put('/api/organization/settings', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    const organization = await Organization.findByIdAndUpdate(
      req.user.organizationId._id,
      { $set: { settings } },
      { new: true }
    );
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      entityType: 'organization',
      entityId: organization._id,
      details: { settings },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 3. Meeting Routes
app.post('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      schedule,
      attendanceConfig
    } = req.body;
    
    // Generate unique codes
    const publicCode = generateAccessCode();
    const smsCode = `MTG-${generateAccessCode().slice(0, 4)}`;
    const ussdCode = generateAccessCode().slice(0, 6);
    
    const meeting = await Meeting.create({
      organizationId: req.user.organizationId._id,
      createdBy: req.user._id,
      title,
      description,
      location: {
        ...location,
        radius: location.radius || req.user.organizationId.settings.defaultLocationRadius
      },
      schedule: {
        ...schedule,
        attendanceStart: schedule.attendanceStart || 
          new Date(new Date(schedule.startTime).getTime() - (schedule.bufferBefore || 30) * 60000),
        attendanceEnd: schedule.attendanceEnd || 
          new Date(new Date(schedule.endTime).getTime() + (schedule.bufferAfter || 30) * 60000)
      },
      attendanceConfig: attendanceConfig || {
        allowedModes: req.user.organizationId.settings,
        requiredFields: [{ field: 'fullName', isRequired: true }],
        verificationStrictness: 'medium',
        duplicatePrevention: {
          preventSameDevice: true,
          preventSamePhone: true,
          preventSameNameTime: true,
          timeWindowMinutes: 5
        },
        timeRequirement: {
          minimumMinutes: 15,
          enableTimeTrack: false,
          maxAbsenceMinutes: 5
        }
      },
      accessCodes: {
        publicCode,
        smsCode,
        ussdCode
      },
      status: 'draft'
    });
    
    // Generate QR code
    const qrCode = await generateMeetingQRCode(publicCode);
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_CREATED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: { title, publicCode },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      ...meeting.toObject(),
      qrCode
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

app.get('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const query = {
      organizationId: req.user.organizationId._id
    };
    
    if (status) query.status = status;
    if (startDate && endDate) {
      query['schedule.startTime'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const meetings = await Meeting.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ 'schedule.startTime': -1 });
    
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

app.get('/api/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    }).populate('createdBy', 'fullName email');
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Generate QR code if needed
    const qrCode = await generateMeetingQRCode(meeting.accessCodes.publicCode);
    
    res.json({
      ...meeting.toObject(),
      qrCode
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

app.put('/api/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      {
        _id: req.params.meetingId,
        organizationId: req.user.organizationId._id
      },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_UPDATED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: { updates: req.body },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

app.post('/api/meetings/:meetingId/start', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      {
        _id: req.params.meetingId,
        organizationId: req.user.organizationId._id,
        status: { $in: ['draft', 'active'] }
      },
      { status: 'in_progress', updatedAt: new Date() },
      { new: true }
    );
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or cannot be started' });
    }
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_STARTED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start meeting' });
  }
});

app.post('/api/meetings/:meetingId/end', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      {
        _id: req.params.meetingId,
        organizationId: req.user.organizationId._id,
        status: 'in_progress'
      },
      { status: 'completed', updatedAt: new Date() },
      { new: true }
    );
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or cannot be ended' });
    }
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_ENDED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ error: 'Failed to end meeting' });
  }
});

// 4. Attendance Routes

// Smartphone GPS Attendance
app.post('/api/attend/smartphone', async (req, res) => {
  try {
    const { meetingCode, attendeeInfo, locationData, deviceInfo } = req.body;
    
    // Find meeting
    const meeting = await Meeting.findOne({
      'accessCodes.publicCode': meetingCode,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or not active' });
    }
    
    // Check if GPS attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.smartphoneGPS) {
      return res.status(403).json({ error: 'GPS attendance not allowed for this meeting' });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart || now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ error: 'Attendance outside allowed time window' });
    }
    
    // Validate location
    const distance = calculateDistance(
      locationData.latitude,
      locationData.longitude,
      meeting.location.latitude,
      meeting.location.longitude
    );
    
    const isWithinRadius = distance <= meeting.location.radius;
    
    if (!isWithinRadius) {
      return res.status(403).json({ 
        error: 'Location not within meeting radius',
        details: {
          distance,
          allowedRadius: meeting.location.radius,
          requiredLocation: {
            latitude: meeting.location.latitude,
            longitude: meeting.location.longitude
          }
        }
      });
    }
    
    // Check for duplicates
    const duplicateChecks = [];
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameDevice && deviceInfo.deviceId) {
      duplicateChecks.push({
        'deviceInfo.deviceId': deviceInfo.deviceId,
        'meetingId': meeting._id,
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSamePhone && attendeeInfo.phone) {
      duplicateChecks.push({
        'attendeeInfo.phone': attendeeInfo.phone,
        'meetingId': meeting._id,
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameNameTime && attendeeInfo.fullName) {
      duplicateChecks.push({
        'attendeeInfo.fullName': attendeeInfo.fullName,
        'meetingId': meeting._id,
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (duplicateChecks.length > 0) {
      const duplicate = await AttendanceRecord.findOne({
        $or: duplicateChecks,
        status: { $in: ['pending', 'verified'] }
      });
      
      if (duplicate) {
        return res.status(409).json({ 
          error: 'Duplicate attendance detected',
          existingRecord: {
            id: duplicate._id,
            checkInTime: duplicate.timeTracking.checkInTime,
            status: duplicate.status
          }
        });
      }
    }
    
    // Calculate confidence score
    const confidenceScore = calculateConfidenceScore('smartphone_gps', locationData, meeting);
    
    // Create attendance record
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'smartphone_gps',
      attendeeInfo,
      locationData: {
        coordinates: locationData,
        distanceFromVenue: distance,
        isWithinRadius: true,
        address: locationData.address
      },
      deviceInfo,
      verificationDetails: {
        confidenceScore,
        verificationMethod: 'GPS',
        verificationTimestamp: now
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: false // Will be updated if time tracking is enabled
      },
      status: confidenceScore >= 70 ? 'verified' : 'pending'
    });
    
    // Update device fingerprint
    if (deviceInfo.deviceId) {
      await DeviceFingerprint.findOneAndUpdate(
        { deviceId: deviceInfo.deviceId, organizationId: meeting.organizationId },
        {
          $set: {
            lastUsed: now,
            metadata: {
              userAgent: deviceInfo.userAgent,
              platform: deviceInfo.platform,
              os: deviceInfo.os,
              browser: deviceInfo.browser,
              screenResolution: deviceInfo.screenResolution
            }
          }
        },
        { upsert: true, new: true }
      );
    }
    
    res.status(201).json({
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      confidenceScore,
      message: 'Attendance recorded successfully'
    });
    
  } catch (error) {
    console.error('Smartphone attendance error:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// SMS Attendance
app.post('/api/webhooks/sms', async (req, res) => {
  try {
    const { From, To, Body } = req.body;
    
    // Parse SMS message
    const message = Body.trim();
    const parts = message.split(' ');
    
    if (parts.length < 3 || parts[0].toUpperCase() !== 'ATTEND') {
      return res.status(400).json({ error: 'Invalid SMS format. Use: ATTEND <MEETING_CODE> <FULL_NAME> [ID]' });
    }
    
    const meetingCode = parts[1];
    const fullName = parts.slice(2).join(' ');
    
    // Find meeting
    const meeting = await Meeting.findOne({
      'accessCodes.smsCode': meetingCode,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or not active' });
    }
    
    // Check if SMS attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.sms) {
      return res.status(403).json({ error: 'SMS attendance not allowed for this meeting' });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart || now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ error: 'Attendance outside allowed time window' });
    }
    
    // Check for duplicates
    const duplicate = await AttendanceRecord.findOne({
      meetingId: meeting._id,
      'attendeeInfo.phone': From,
      status: { $in: ['pending', 'verified'] },
      createdAt: {
        $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
      }
    });
    
    if (duplicate) {
      return res.status(409).json({ error: 'Duplicate attendance detected' });
    }
    
    // Get admin location for this time window
    const adminAttendance = await AttendanceRecord.findOne({
      meetingId: meeting._id,
      verificationType: 'manual',
      'verificationDetails.verifiedByAdminId': { $exists: true },
      createdAt: {
        $gte: new Date(now.getTime() - 15 * 60000) // Last 15 minutes
      }
    }).sort({ createdAt: -1 });
    
    let adminLocation = null;
    let isWithinRadius = false;
    
    if (adminAttendance && adminAttendance.locationData.verifiedByAdminLocation) {
      adminLocation = adminAttendance.locationData.verifiedByAdminLocation;
      const distance = calculateDistance(
        adminLocation.latitude,
        adminLocation.longitude,
        meeting.location.latitude,
        meeting.location.longitude
      );
      isWithinRadius = distance <= meeting.location.radius;
    }
    
    // Calculate confidence score
    const confidenceScore = calculateConfidenceScore('sms', { isWithinRadius }, meeting);
    
    // Create SMS log
    const smsLog = await SMSLog.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      fromNumber: From,
      toNumber: To,
      message: Body,
      status: 'received'
    });
    
    // Create attendance record
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'sms',
      attendeeInfo: {
        fullName,
        phone: From
      },
      locationData: {
        verifiedByAdminLocation: adminLocation,
        distanceFromVenue: adminLocation ? 
          calculateDistance(
            adminLocation.latitude,
            adminLocation.longitude,
            meeting.location.latitude,
            meeting.location.longitude
          ) : null,
        isWithinRadius,
        address: meeting.location.address
      },
      verificationDetails: {
        confidenceScore,
        verificationMethod: 'SMS',
        verificationTimestamp: now
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: false
      },
      status: confidenceScore >= 60 ? 'pending' : 'flagged'
    });
    
    // Update SMS log with attendance record
    smsLog.attendanceRecordId = attendanceRecord._id;
    await smsLog.save();
    
    // Send confirmation SMS
    if (process.env.TWILIO_ACCOUNT_SID) {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      await client.messages.create({
        body: `Attendance received for ${meeting.title}. Your attendance ID: ${attendanceRecord._id}`,
        from: To,
        to: From
      });
    }
    
    res.json({
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      message: 'SMS attendance recorded'
    });
    
  } catch (error) {
    console.error('SMS webhook error:', error);
    res.status(500).json({ error: 'Failed to process SMS' });
  }
});

// USSD Attendance
// USSD Attendance
app.post('/api/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text, networkCode } = req.body;
    
    let response = "";
    let ussdResponseType = "Continue"; // "Continue" or "End"
    
    // Find or create USSD session
    let ussdSession = await USSDSession.findOne({ sessionId });
    
    if (!ussdSession) {
      // New session
      ussdSession = await USSDSession.create({
        sessionId,
        organizationId: null, // Will be set when meeting code is entered
        phoneNumber,
        currentStep: 'welcome',
        data: {}
      });
      
      response = "Welcome to GeoSecure Attendance\n";
      response += "Enter Meeting Code:";
    } else {
      // Existing session - process input
      const input = text.split('*').pop(); // Get last input
      
      switch(ussdSession.currentStep) {
        case 'welcome':
          // Meeting code input
          ussdSession.data.meetingCode = input;
          
          // Find meeting
          const foundMeeting1 = await Meeting.findOne({
            'accessCodes.ussdCode': input,
            status: { $in: ['active', 'in_progress'] }
          });
          
          if (!foundMeeting1) {
            response = "Invalid meeting code or meeting not active\n";
            ussdResponseType = "End";
            ussdSession.isActive = false;
          } else {
            ussdSession.meetingId = foundMeeting1._id;
            ussdSession.organizationId = foundMeeting1.organizationId;
            ussdSession.currentStep = 'name';
            response = "Enter your full name:";
          }
          break;
          
        case 'name':
          ussdSession.data.fullName = input;
          ussdSession.currentStep = 'phone';
          response = "Enter your phone number (if different from calling number):";
          break;
          
        case 'phone':
          ussdSession.data.phone = input || phoneNumber;
          ussdSession.currentStep = 'id';
          response = "Enter your ID number (optional):\nPress # to skip";
          break;
          
        case 'id':
          if (input !== '#') {
            ussdSession.data.idNumber = input;
          }
          
          // Process attendance
          const foundMeeting2 = await Meeting.findById(ussdSession.meetingId);
          
          if (!foundMeeting2) {
            response = "Meeting not found\n";
            ussdResponseType = "End";
            ussdSession.isActive = false;
            break;
          }
          
          // Check if USSD attendance is allowed
          if (!foundMeeting2.attendanceConfig.allowedModes.ussd) {
            response = "USSD attendance not allowed for this meeting\n";
            ussdResponseType = "End";
            ussdSession.isActive = false;
            break;
          }
          
          // Check time window
          const now = new Date();
          if (now < foundMeeting2.schedule.attendanceStart || now > foundMeeting2.schedule.attendanceEnd) {
            response = "Attendance outside allowed time window\n";
            ussdResponseType = "End";
            ussdSession.isActive = false;
            break;
          }
          
          // Check for duplicates
          const duplicate = await AttendanceRecord.findOne({
            meetingId: foundMeeting2._id,
            'attendeeInfo.phone': ussdSession.data.phone,
            status: { $in: ['pending', 'verified'] },
            createdAt: {
              $gte: new Date(now.getTime() - foundMeeting2.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
            }
          });
          
          if (duplicate) {
            response = "Duplicate attendance detected\n";
            ussdResponseType = "End";
            ussdSession.isActive = false;
            break;
          }
          
          // Get admin location
          const adminAttendance = await AttendanceRecord.findOne({
            meetingId: foundMeeting2._id,
            verificationType: 'manual',
            'verificationDetails.verifiedByAdminId': { $exists: true },
            createdAt: {
              $gte: new Date(now.getTime() - 15 * 60000)
            }
          }).sort({ createdAt: -1 });
          
          let adminLocation = null;
          let isWithinRadius = false;
          
          if (adminAttendance && adminAttendance.locationData.verifiedByAdminLocation) {
            adminLocation = adminAttendance.locationData.verifiedByAdminLocation;
            const distance = calculateDistance(
              adminLocation.latitude,
              adminLocation.longitude,
              foundMeeting2.location.latitude,
              foundMeeting2.location.longitude
            );
            isWithinRadius = distance <= foundMeeting2.location.radius;
          }
          
          // Calculate confidence score
          const confidenceScore = calculateConfidenceScore('ussd', { isWithinRadius }, foundMeeting2);
          
          // Create attendance record
          const attendanceRecord = await AttendanceRecord.create({
            meetingId: foundMeeting2._id,
            organizationId: foundMeeting2.organizationId,
            verificationType: 'ussd',
            attendeeInfo: {
              fullName: ussdSession.data.fullName,
              phone: ussdSession.data.phone,
              idNumber: ussdSession.data.idNumber
            },
            locationData: {
              verifiedByAdminLocation: adminLocation,
              distanceFromVenue: adminLocation ? 
                calculateDistance(
                  adminLocation.latitude,
                  adminLocation.longitude,
                  foundMeeting2.location.latitude,
                  foundMeeting2.location.longitude
                ) : null,
              isWithinRadius,
              address: foundMeeting2.location.address
            },
            verificationDetails: {
              confidenceScore,
              verificationMethod: 'USSD',
              verificationTimestamp: now
            },
            timeTracking: {
              checkInTime: now,
              meetsTimeRequirement: false
            },
            status: confidenceScore >= 60 ? 'pending' : 'flagged'
          });
          
          response = `Attendance recorded successfully!\n`;
          response += `Name: ${ussdSession.data.fullName}\n`;
          response += `Meeting: ${foundMeeting2.title}\n`;
          response += `Status: ${attendanceRecord.status === 'verified' ? 'Verified' : 'Pending Verification'}\n`;
          response += `Thank you!`;
          
          ussdResponseType = "End";
          ussdSession.isActive = false;
          break;
      }
      
      ussdSession.lastActivity = new Date();
      await ussdSession.save();
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(`${ussdResponseType} ${response}`);
    
  } catch (error) {
    console.error('USSD error:', error);
    res.set('Content-Type', 'text/plain');
    res.send('End An error occurred. Please try again.');
  }
});

// Kiosk Attendance
app.post('/api/attend/kiosk', authenticateToken, async (req, res) => {
  try {
    const { meetingId, attendeeInfo, adminLocation } = req.body;
    
    // Find meeting
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organizationId: req.user.organizationId._id,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or not active' });
    }
    
    // Check if kiosk attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.kiosk) {
      return res.status(403).json({ error: 'Kiosk attendance not allowed for this meeting' });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart || now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ error: 'Attendance outside allowed time window' });
    }
    
    // Validate admin location
    const distance = calculateDistance(
      adminLocation.latitude,
      adminLocation.longitude,
      meeting.location.latitude,
      meeting.location.longitude
    );
    
    const isWithinRadius = distance <= meeting.location.radius;
    
    if (!isWithinRadius) {
      return res.status(403).json({ 
        error: 'Admin device not within meeting radius',
        distance,
        allowedRadius: meeting.location.radius
      });
    }
    
    // Check for duplicates
    const duplicateChecks = [];
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSamePhone && attendeeInfo.phone) {
      duplicateChecks.push({
        'attendeeInfo.phone': attendeeInfo.phone,
        'meetingId': meeting._id,
        status: { $in: ['pending', 'verified'] },
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameNameTime && attendeeInfo.fullName) {
      duplicateChecks.push({
        'attendeeInfo.fullName': attendeeInfo.fullName,
        'meetingId': meeting._id,
        status: { $in: ['pending', 'verified'] },
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (duplicateChecks.length > 0) {
      const duplicate = await AttendanceRecord.findOne({
        $or: duplicateChecks
      });
      
      if (duplicate) {
        return res.status(409).json({ 
          error: 'Duplicate attendance detected',
          existingRecord: {
            id: duplicate._id,
            checkInTime: duplicate.timeTracking.checkInTime,
            status: duplicate.status
          }
        });
      }
    }
    
    // Calculate confidence score
    const confidenceScore = calculateConfidenceScore('kiosk', { isWithinRadius }, meeting);
    
    // Create attendance record
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'kiosk',
      attendeeInfo,
      locationData: {
        verifiedByAdminLocation: adminLocation,
        distanceFromVenue: distance,
        isWithinRadius: true,
        address: meeting.location.address
      },
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        deviceId: `kiosk-${req.user._id}`
      },
      verificationDetails: {
        confidenceScore,
        verificationMethod: 'Kiosk',
        verificationTimestamp: now,
        verifiedByAdminId: req.user._id
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: false
      },
      status: confidenceScore >= 80 ? 'verified' : 'pending'
    });
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'KIOSK_ATTENDANCE_RECORDED',
      entityType: 'attendance',
      entityId: attendanceRecord._id,
      details: { attendeeName: attendeeInfo.fullName },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      confidenceScore,
      message: 'Kiosk attendance recorded successfully'
    });
    
  } catch (error) {
    console.error('Kiosk attendance error:', error);
    res.status(500).json({ error: 'Failed to record kiosk attendance' });
  }
});

// Manual Attendance (Admin-assisted)
app.post('/api/attend/manual', authenticateToken, async (req, res) => {
  try {
    const { meetingId, attendeeInfo, adminLocation, verificationReason } = req.body;
    
    // Find meeting
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organizationId: req.user.organizationId._id,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or not active' });
    }
    
    // Check if manual attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.manual) {
      return res.status(403).json({ error: 'Manual attendance not allowed for this meeting' });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart || now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ error: 'Attendance outside allowed time window' });
    }
    
    // Validate admin location
    const distance = calculateDistance(
      adminLocation.latitude,
      adminLocation.longitude,
      meeting.location.latitude,
      meeting.location.longitude
    );
    
    const isWithinRadius = distance <= meeting.location.radius;
    
    if (!isWithinRadius) {
      return res.status(403).json({ 
        error: 'Admin device not within meeting radius',
        distance,
        allowedRadius: meeting.location.radius
      });
    }
    
    // Check for duplicates
    const duplicateChecks = [];
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSamePhone && attendeeInfo.phone) {
      duplicateChecks.push({
        'attendeeInfo.phone': attendeeInfo.phone,
        'meetingId': meeting._id,
        status: { $in: ['pending', 'verified'] },
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameNameTime && attendeeInfo.fullName) {
      duplicateChecks.push({
        'attendeeInfo.fullName': attendeeInfo.fullName,
        'meetingId': meeting._id,
        status: { $in: ['pending', 'verified'] },
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (duplicateChecks.length > 0) {
      const duplicate = await AttendanceRecord.findOne({
        $or: duplicateChecks
      });
      
      if (duplicate) {
        return res.status(409).json({ 
          error: 'Duplicate attendance detected',
          existingRecord: {
            id: duplicate._id,
            checkInTime: duplicate.timeTracking.checkInTime,
            status: duplicate.status
          }
        });
      }
    }
    
    // Create attendance record with high confidence for manual verification
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'manual',
      attendeeInfo,
      locationData: {
        verifiedByAdminLocation: adminLocation,
        distanceFromVenue: distance,
        isWithinRadius: true,
        address: meeting.location.address
      },
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        deviceId: `admin-${req.user._id}`
      },
      verificationDetails: {
        confidenceScore: 95, // High confidence for admin verification
        verificationMethod: 'Manual',
        verificationTimestamp: now,
        verifiedByAdminId: req.user._id,
        manualVerificationReason: verificationReason
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: false
      },
      status: 'verified',
      auditTrail: [{
        action: 'MANUAL_VERIFICATION',
        performedBy: req.user._id,
        notes: `Manually verified by admin: ${verificationReason}`
      }]
    });
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MANUAL_ATTENDANCE_RECORDED',
      entityType: 'attendance',
      entityId: attendanceRecord._id,
      details: { 
        attendeeName: attendeeInfo.fullName,
        verificationReason 
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      confidenceScore: 95,
      message: 'Manual attendance recorded successfully'
    });
    
  } catch (error) {
    console.error('Manual attendance error:', error);
    res.status(500).json({ error: 'Failed to record manual attendance' });
  }
});

// 5. Attendance Management Routes
app.get('/api/meetings/:meetingId/attendance', authenticateToken, async (req, res) => {
  try {
    const { status, verificationType, startDate, endDate } = req.query;
    
    // Verify meeting belongs to organization
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const query = {
      meetingId: meeting._id,
      organizationId: req.user.organizationId._id
    };
    
    if (status) query.status = status;
    if (verificationType) query.verificationType = verificationType;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendance = await AttendanceRecord.find(query)
      .sort({ createdAt: -1 })
      .populate('verificationDetails.verifiedByAdminId', 'fullName email');
    
    // Get summary statistics
    const total = attendance.length;
    const verified = attendance.filter(a => a.status === 'verified').length;
    const pending = attendance.filter(a => a.status === 'pending').length;
    const flagged = attendance.filter(a => a.status === 'flagged').length;
    const rejected = attendance.filter(a => a.status === 'rejected').length;
    
    const byType = {
      smartphone_gps: attendance.filter(a => a.verificationType === 'smartphone_gps').length,
      sms: attendance.filter(a => a.verificationType === 'sms').length,
      ussd: attendance.filter(a => a.verificationType === 'ussd').length,
      kiosk: attendance.filter(a => a.verificationType === 'kiosk').length,
      manual: attendance.filter(a => a.verificationType === 'manual').length
    };
    
    res.json({
      meeting: {
        id: meeting._id,
        title: meeting.title,
        location: meeting.location
      },
      summary: {
        total,
        verified,
        pending,
        flagged,
        rejected,
        byType
      },
      attendance
    });
    
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

app.put('/api/attendance/:attendanceId/status', authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const attendance = await AttendanceRecord.findOne({
      _id: req.params.attendanceId,
      organizationId: req.user.organizationId._id
    });
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const oldStatus = attendance.status;
    
    attendance.status = status;
    attendance.auditTrail.push({
      action: 'STATUS_CHANGE',
      performedBy: req.user._id,
      notes: `Changed from ${oldStatus} to ${status}. ${notes || ''}`
    });
    attendance.updatedAt = new Date();
    
    await attendance.save();
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'ATTENDANCE_STATUS_UPDATED',
      entityType: 'attendance',
      entityId: attendance._id,
      details: { 
        oldStatus, 
        newStatus: status,
        notes 
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      attendance: {
        id: attendance._id,
        status: attendance.status,
        attendeeName: attendance.attendeeInfo.fullName
      }
    });
    
  } catch (error) {
    console.error('Update attendance status error:', error);
    res.status(500).json({ error: 'Failed to update attendance status' });
  }
});

// Check-out for time tracking
app.post('/api/attendance/:attendanceId/checkout', async (req, res) => {
  try {
    const { meetingCode, deviceInfo } = req.body;
    
    const attendance = await AttendanceRecord.findOne({
      _id: req.params.attendanceId,
      'verificationType': 'smartphone_gps'
    }).populate('meetingId');
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const meeting = attendance.meetingId;
    
    // Verify meeting code
    if (meeting.accessCodes.publicCode !== meetingCode) {
      return res.status(403).json({ error: 'Invalid meeting code' });
    }
    
    // Verify device matches
    if (deviceInfo.deviceId && attendance.deviceInfo.deviceId !== deviceInfo.deviceId) {
      return res.status(403).json({ error: 'Device mismatch' });
    }
    
    const now = new Date();
    const checkInTime = new Date(attendance.timeTracking.checkInTime);
    const duration = Math.round((now - checkInTime) / (1000 * 60)); // minutes
    
    attendance.timeTracking.checkOutTime = now;
    attendance.timeTracking.totalDuration = duration;
    
    // Check if meets time requirement
    const minMinutes = meeting.attendanceConfig.timeRequirement.minimumMinutes;
    attendance.timeTracking.meetsTimeRequirement = duration >= minMinutes;
    
    // Update confidence score based on time spent
    if (attendance.timeTracking.meetsTimeRequirement) {
      attendance.verificationDetails.confidenceScore = Math.min(
        attendance.verificationDetails.confidenceScore + 10,
        100
      );
      
      if (attendance.status === 'pending' && attendance.verificationDetails.confidenceScore >= 70) {
        attendance.status = 'verified';
      }
    }
    
    attendance.auditTrail.push({
      action: 'CHECKOUT',
      performedBy: null, // Self checkout
      notes: `Checked out after ${duration} minutes`
    });
    
    attendance.updatedAt = now;
    await attendance.save();
    
    res.json({
      success: true,
      duration,
      meetsTimeRequirement: attendance.timeTracking.meetsTimeRequirement,
      confidenceScore: attendance.verificationDetails.confidenceScore,
      status: attendance.status
    });
    
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to process checkout' });
  }
});

// 6. Export Routes
app.get('/api/meetings/:meetingId/export/pdf', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const organization = await Organization.findById(req.user.organizationId._id);
    
    // Get all attendance records
    const attendance = await AttendanceRecord.find({
      meetingId: meeting._id,
      organizationId: req.user.organizationId._id
    }).sort({ 'attendeeInfo.fullName': 1 });
    
    // Generate PDF
    const pdfBuffer = await generateAttendancePDF(meeting, attendance, organization);
    
    // Log the export
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'EXPORT_PDF',
      entityType: 'meeting',
      entityId: meeting._id,
      details: { recordCount: attendance.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${meeting.title}-${moment().format('YYYY-MM-DD')}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.get('/api/meetings/:meetingId/export/excel', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const organization = await Organization.findById(req.user.organizationId._id);
    
    // Get all attendance records
    const attendance = await AttendanceRecord.find({
      meetingId: meeting._id,
      organizationId: req.user.organizationId._id
    }).sort({ 'attendeeInfo.fullName': 1 });
    
    // Generate Excel
    const excelBuffer = await generateAttendanceExcel(meeting, attendance, organization);
    
    // Log the export
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'EXPORT_EXCEL',
      entityType: 'meeting',
      entityId: meeting._id,
      details: { recordCount: attendance.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${meeting.title}-${moment().format('YYYY-MM-DD')}.xlsx"`);
    res.send(excelBuffer);
    
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to generate Excel' });
  }
});

// 7. Admin Management Routes
app.get('/api/admins', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const admins = await AdminUser.find({
      organizationId: req.user.organizationId._id
    }).select('-password');
    
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

app.post('/api/admins', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { email, password, fullName, phone, role, permissions } = req.body;
    
    // Check if user already exists
    const existingUser = await AdminUser.findOne({ 
      email,
      organizationId: req.user.organizationId._id 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Admin already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await AdminUser.create({
      organizationId: req.user.organizationId._id,
      email,
      password: hashedPassword,
      fullName,
      phone,
      role: role || 'admin',
      permissions: permissions || {
        canCreateMeetings: true,
        canEditMeetings: true,
        canDeleteMeetings: false,
        canViewReports: true,
        canManageAdmins: false,
        canApproveAttendance: true
      }
    });
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'ADMIN_CREATED',
      entityType: 'user',
      entityId: admin._id,
      details: { email, role: admin.role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      id: admin._id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      permissions: admin.permissions
    });
    
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

app.put('/api/admins/:adminId', authenticateToken, isSuperAdmin, async (req, res) => {
  try {
    const { role, permissions, isActive } = req.body;
    
    const admin = await AdminUser.findOneAndUpdate(
      {
        _id: req.params.adminId,
        organizationId: req.user.organizationId._id,
        role: { $ne: 'super_admin' } // Cannot modify super admin
      },
      { 
        role,
        permissions,
        isActive,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found or cannot be modified' });
    }
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'ADMIN_UPDATED',
      entityType: 'user',
      entityId: admin._id,
      details: { role, isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(admin);
    
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// 8. Dashboard & Analytics Routes
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get total meetings
    const totalMeetings = await Meeting.countDocuments({
      organizationId: req.user.organizationId._id
    });
    
    // Get active meetings
    const activeMeetings = await Meeting.countDocuments({
      organizationId: req.user.organizationId._id,
      status: 'in_progress'
    });
    
    // Get upcoming meetings
    const upcomingMeetings = await Meeting.countDocuments({
      organizationId: req.user.organizationId._id,
      'schedule.startTime': { $gt: now },
      status: { $in: ['draft', 'active'] }
    });
    
    // Get total attendance records
    const totalAttendance = await AttendanceRecord.countDocuments({
      organizationId: req.user.organizationId._id,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Get today's attendance
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));
    
    const todayAttendance = await AttendanceRecord.countDocuments({
      organizationId: req.user.organizationId._id,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });
    
    // Get attendance by type
    const attendanceByType = await AttendanceRecord.aggregate([
      {
        $match: {
          organizationId: req.user.organizationId._id,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$verificationType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get recent attendance
    const recentAttendance = await AttendanceRecord.find({
      organizationId: req.user.organizationId._id
    })
    .populate('meetingId', 'title')
    .sort({ createdAt: -1 })
    .limit(10)
    .select('attendeeInfo.fullName verificationType status createdAt');
    
    res.json({
      summary: {
        totalMeetings,
        activeMeetings,
        upcomingMeetings,
        totalAttendance,
        todayAttendance
      },
      byType: attendanceByType,
      recentAttendance
    });
    
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// 9. Audit Log Routes
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, action, userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const query = {
      organizationId: req.user.organizationId._id
    };
    
    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (action) query.action = action;
    if (userId) query.userId = userId;
    
    const logs = await AuditLog.find(query)
      .populate('userId', 'fullName email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await AuditLog.countDocuments(query);
    
    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// 10. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      // redis: redisClient.connected ? 'connected' : 'disconnected'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const startServer = async () => {
  try {
    // await redisClient.connect();
    
    app.listen(PORT, () => {
      console.log(`GSAMS Backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Export for testing
module.exports = app;