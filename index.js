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
   // ADD THESE FIELDS:
  customFormFields: [{
    fieldName: { type: String, required: true },
    fieldType: { 
      type: String, 
      enum: ['text', 'number', 'email', 'tel', 'select', 'checkbox', 'textarea'],
      default: 'text'
    },
    label: { type: String, required: true },
    placeholder: { type: String },
    options: [{ value: String, label: String }], // For select/dropdown
    isRequired: { type: Boolean, default: false },
    validation: {
      minLength: { type: Number },
      maxLength: { type: Number },
      pattern: { type: String } // regex pattern
    },
    order: { type: Number, default: 0 }
  }],
  
  // Enhanced time tracking settings
  timeVerification: {
    requireMinimumStay: { type: Boolean, default: false },
    minimumStayMinutes: { type: Number, default: 5 },
    enableContinuousMonitoring: { type: Boolean, default: false },
    monitoringInterval: { type: Number, default: 5 }, // minutes
    maxAllowedAbsence: { type: Number, default: 2 }, // minutes
    autoVerifyAfterStay: { type: Boolean, default: false },
    autoVerifyMinutes: { type: Number, default: 10 }
  },
  
  // Meeting links
  shareLinks: {
    adminDashboard: { type: String },
    attendeeForm: { type: String },
    qrCodeUrl: { type: String }
  },
  
  

  // PWA settings
  pwaSettings: {
    enablePWA: { type: Boolean, default: true },
    appName: { type: String, default: 'GSAMS Attendance' },
    themeColor: { type: String, default: '#2196F3' },
    backgroundColor: { type: String, default: '#ffffff' }
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

// Add this after the existing calculateDistance function (around line 353)

// Enhanced location validation with multiple checks
const validateLocation = (userLat, userLon, meetingLat, meetingLon, radius, userAccuracy) => {
  // Calculate distance
  const distance = calculateDistance(userLat, userLon, meetingLat, meetingLon);
  
  // Check if within radius
  const isWithinRadius = distance <= radius;
  
  // Calculate accuracy buffer (GPS accuracy + 10% safety margin)
  const accuracyBuffer = userAccuracy * 1.1;
  
  // Enhanced validation checks
  const validation = {
    distance,
    isWithinRadius,
    accuracy: userAccuracy,
    accuracyBuffer,
    
    // Multiple validation levels
    checks: {
      basicRadiusCheck: distance <= radius,
      accuracyAdjustedCheck: distance <= (radius + accuracyBuffer),
      strictCheck: distance <= Math.max(radius - 10, radius * 0.9), // 10m or 10% stricter
      
      // Verify coordinates are valid (not 0,0 or extreme values)
      validCoordinates: 
        userLat >= -90 && userLat <= 90 && 
        userLon >= -180 && userLon <= 180 &&
        userLat !== 0 && userLon !== 0,
      
      // Check for suspicious patterns
      notSameAsPrevious: true, // Will be set by caller
      notMockedLocation: userAccuracy < 1000, // Mocked locations often have high accuracy
      
      // Time-based validation (location should be recent)
      isRecent: true // Will be set by caller
    },
    
    // Confidence scoring based on multiple factors
    confidenceScore: calculateLocationConfidence(distance, radius, userAccuracy),
    
    // Detailed messages for debugging
    messages: []
  };
  
  // Add validation messages
  if (!validation.checks.validCoordinates) {
    validation.messages.push('Invalid coordinates detected');
  }
  
  if (userAccuracy > 100) {
    validation.messages.push(`Low location accuracy: ${userAccuracy}m`);
  }
  
  if (distance > radius) {
    validation.messages.push(`Outside meeting radius by ${(distance - radius).toFixed(2)}m`);
  }
  
  return validation;
};

// Calculate location confidence score
const calculateLocationConfidence = (distance, radius, accuracy) => {
  let score = 100;
  
  // Penalize for distance from center
  if (distance > radius * 0.5) {
    score -= 20;
  }
  if (distance > radius * 0.8) {
    score -= 30;
  }
  
  // Penalize for poor accuracy
  if (accuracy > 50) score -= 10;
  if (accuracy > 100) score -= 20;
  if (accuracy > 200) score -= 30;
  
  // Bonus for excellent accuracy
  if (accuracy < 10) score += 10;
  if (accuracy < 5) score += 15;
  
  return Math.max(0, Math.min(100, score));
};

// Detect potential location spoofing
const detectLocationSpoofing = (locationData, previousLocations = []) => {
  const warnings = [];
  
  // Check for unrealistic accuracy
  if (locationData.accuracy < 1) {
    warnings.push('Unusually high accuracy detected (potential spoofing)');
  }
  
  // Check for unrealistic speed (if available)
  if (locationData.speed && locationData.speed > 100) { // > 100 m/s = 360 km/h
    warnings.push('Unrealistic movement speed detected');
  }
  
  // Check for altitude anomalies (if available)
  if (locationData.altitude && Math.abs(locationData.altitude) > 10000) {
    warnings.push('Unrealistic altitude detected');
  }
  
  // Check for consistent coordinates (no movement)
  if (previousLocations.length >= 3) {
    const recentLocations = previousLocations.slice(-3);
    const allSame = recentLocations.every(loc => 
      Math.abs(loc.latitude - locationData.latitude) < 0.0001 &&
      Math.abs(loc.longitude - locationData.longitude) < 0.0001
    );
    
    if (allSame) {
      warnings.push('No location movement detected (potential static spoof)');
    }
  }
  
  // Check for common mock location patterns
  const commonMockCoordinates = [
    { lat: 37.4219983, lon: -122.084 }, // Google HQ
    { lat: 37.3349, lon: -122.009 }, // Apple Park
    { lat: 37.7749, lon: -122.4194 }, // San Francisco
    { lat: 40.7128, lon: -74.0060 }, // New York
    { lat: 51.5074, lon: -0.1278 }, // London
    { lat: 0, lon: 0 }, // Null Island
  ];
  
  for (const mock of commonMockCoordinates) {
    if (calculateDistance(locationData.latitude, locationData.longitude, mock.lat, mock.lon) < 100) {
      warnings.push('Location matches common mock coordinate');
      break;
    }
  }
  
  return {
    isSuspicious: warnings.length > 0,
    warnings,
    riskLevel: warnings.length > 2 ? 'high' : warnings.length > 0 ? 'medium' : 'low'
  };
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

// Add these helper functions after line 353 (after generateAttendanceExcel function)

// Generate meeting links
const generateMeetingLinks = (meetingId, publicCode) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://gsf-inky.vercel.app';
  return {
    adminDashboard: `${baseUrl}/admin/meetings/${meetingId}`,
    attendeeForm: `${baseUrl}/attend/${publicCode}`,
    qrCodeUrl: `${baseUrl}/api/meetings/${meetingId}/qrcode`,
    publicAttendanceLink: `${baseUrl}/attend/${publicCode}/form`
  };
};

// Generate PWA manifest
const generatePWAManifest = (meeting, organization) => {
  return {
    name: meeting.pwaSettings?.appName || `${organization.name} Attendance`,
    short_name: 'GSAMS',
    description: `Attendance for ${meeting.title}`,
    theme_color: meeting.pwaSettings?.themeColor || '#2196F3',
    background_color: meeting.pwaSettings?.backgroundColor || '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: `/attend/${meeting.accessCodes.publicCode}`,
    icons: [
      {
        src: '/icons/icon-72x72.png',
        sizes: '72x72',
        type: 'image/png'
      },
      {
        src: '/icons/icon-96x96.png',
        sizes: '96x96',
        type: 'image/png'
      },
      {
        src: '/icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png'
      },
      {
        src: '/icons/icon-144x144.png',
        sizes: '144x144',
        type: 'image/png'
      },
      {
        src: '/icons/icon-152x152.png',
        sizes: '152x152',
        type: 'image/png'
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icons/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ],
    shortcuts: [
      {
        name: 'Mark Attendance',
        short_name: 'Attend',
        description: 'Mark your attendance',
        url: `/attend/${meeting.accessCodes.publicCode}`,
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }]
      },
      {
        name: 'View Meeting',
        short_name: 'Meeting',
        description: 'View meeting details',
        url: `/meetings/${meeting._id}`,
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }]
      }
    ]
  };
};

// Generate service worker
const generateServiceWorker = () => {
  return `
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('gsams-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icons/icon-72x72.png',
        '/icons/icon-96x96.png',
        '/icons/icon-128x128.png',
        '/icons/icon-144x144.png',
        '/icons/icon-152x152.png',
        '/icons/icon-192x192.png',
        '/icons/icon-384x384.png',
        '/icons/icon-512x512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'Go to Meeting',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('GSAMS Attendance', options)
  );
});
`;
};

// Monitor attendance duration (for time verification)
const monitorAttendanceDuration = async (attendanceId, meetingId) => {
  try {
    const attendance = await AttendanceRecord.findById(attendanceId);
    const meeting = await Meeting.findById(meetingId);
    
    if (!attendance || !meeting) return;
    
    const now = new Date();
    const checkInTime = new Date(attendance.timeTracking.checkInTime);
    const durationMinutes = Math.round((now - checkInTime) / (1000 * 60));
    
    // Check if meets minimum stay requirement
    if (meeting.timeVerification?.requireMinimumStay) {
      const meetsMinimumStay = durationMinutes >= meeting.timeVerification.minimumStayMinutes;
      
      // Update attendance record
      attendance.timeTracking.meetsMinimumStay = meetsMinimumStay;
      
      // Auto-verify if configured
      if (meeting.timeVerification.autoVerifyAfterStay && 
          durationMinutes >= meeting.timeVerification.autoVerifyMinutes) {
        if (attendance.status === 'pending') {
          attendance.status = 'verified';
          attendance.auditTrail.push({
            action: 'AUTO_VERIFIED',
            performedBy: null,
            notes: `Automatically verified after ${durationMinutes} minutes of attendance`
          });
          
          // Increase confidence score
          attendance.verificationDetails.confidenceScore = Math.min(
            attendance.verificationDetails.confidenceScore + 15,
            100
          );
        }
      }
      
      await attendance.save();
      
      // Log monitoring event
      await AuditLog.create({
        organizationId: meeting.organizationId,
        userId: null,
        action: 'ATTENDANCE_MONITORED',
        entityType: 'attendance',
        entityId: attendance._id,
        details: {
          durationMinutes,
          meetsMinimumStay,
          minimumRequired: meeting.timeVerification.minimumStayMinutes
        },
        ipAddress: 'system',
        userAgent: 'GSAMS-Monitoring-System'
      });
    }
  } catch (error) {
    console.error('Monitoring error:', error);
  }
};

// Generate meeting report PDF (for all meetings)
const generateAllMeetingsPDF = async (meetings, organization, startDate, endDate) => {
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
      doc.fontSize(16).text('All Meetings Report', { align: 'center' });
      doc.moveDown();
      
      // Date range
      doc.fontSize(12).text(`Report Period: ${moment(startDate).format('MMMM Do YYYY')} to ${moment(endDate).format('MMMM Do YYYY')}`);
      doc.moveDown();
      
      // Summary Statistics
      doc.fontSize(14).text('Summary Statistics:', { underline: true });
      doc.moveDown(0.5);
      
      const totalMeetings = meetings.length;
      const totalAttendees = meetings.reduce((sum, meeting) => sum + (meeting.attendanceCount || 0), 0);
      const activeMeetings = meetings.filter(m => m.status === 'in_progress').length;
      const completedMeetings = meetings.filter(m => m.status === 'completed').length;
      
      doc.fontSize(12);
      doc.text(`Total Meetings: ${totalMeetings}`);
      doc.text(`Total Attendees: ${totalAttendees}`);
      doc.text(`Active Meetings: ${activeMeetings}`);
      doc.text(`Completed Meetings: ${completedMeetings}`);
      doc.moveDown();
      
      // Meetings Table
      doc.fontSize(14).text('Meetings List:', { underline: true });
      doc.moveDown(0.5);
      
      // Table Header
      doc.font('Helvetica-Bold');
      let yPos = doc.y;
      doc.text('Title', 50, yPos);
      doc.text('Date', 200, yPos);
      doc.text('Location', 280, yPos);
      doc.text('Status', 400, yPos);
      doc.text('Attendees', 480, yPos);
      doc.moveDown();
      
      // Table Rows
      doc.font('Helvetica');
      meetings.forEach((meeting, index) => {
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.text(meeting.title.substring(0, 25) + (meeting.title.length > 25 ? '...' : ''), 50, yPos);
        doc.text(moment(meeting.schedule.startTime).format('MM/DD'), 200, yPos);
        doc.text(meeting.location.name.substring(0, 15) + (meeting.location.name.length > 15 ? '...' : ''), 280, yPos);
        
        // Status with color
        const statusColors = {
          'draft': 'gray',
          'active': 'blue',
          'in_progress': 'green',
          'completed': 'black',
          'cancelled': 'red'
        };
        
        doc.fillColor(statusColors[meeting.status] || 'black');
        doc.text(meeting.status.replace('_', ' ').toUpperCase(), 400, yPos);
        doc.fillColor('black');
        
        doc.text(meeting.attendanceCount?.toString() || '0', 480, yPos);
        
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


// Add after existing meeting routes (around line 610)

// ================= NEW MEETING APIs =================

// DELETE Meeting
app.delete('/api/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Check permissions
    if (!req.user.permissions.canDeleteMeetings && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Permission denied to delete meetings' });
    }
    
    // Check if meeting has attendance records
    const attendanceCount = await AttendanceRecord.countDocuments({
      meetingId: meeting._id
    });
    
    if (attendanceCount > 0 && req.body.force !== 'true') {
      return res.status(400).json({
        error: 'Meeting has attendance records. Use force=true to delete anyway.',
        attendanceCount
      });
    }
    
    // Soft delete (mark as cancelled) or hard delete based on parameter
    if (req.body.hardDelete === 'true') {
      await Meeting.deleteOne({ _id: meeting._id });
      
      // Also delete related attendance records if specified
      if (req.body.deleteAttendance === 'true') {
        await AttendanceRecord.deleteMany({ meetingId: meeting._id });
        await SMSLog.deleteMany({ meetingId: meeting._id });
        await USSDSession.deleteMany({ meetingId: meeting._id });
      }
    } else {
      // Soft delete - mark as cancelled
      meeting.status = 'cancelled';
      meeting.updatedAt = new Date();
      await meeting.save();
    }
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: req.body.hardDelete === 'true' ? 'MEETING_HARD_DELETED' : 'MEETING_CANCELLED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: {
        title: meeting.title,
        hardDelete: req.body.hardDelete === 'true',
        deleteAttendance: req.body.deleteAttendance === 'true',
        attendanceCount
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: req.body.hardDelete === 'true' ? 'Meeting permanently deleted' : 'Meeting cancelled',
      meetingId: meeting._id
    });
    
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// Get meeting with enhanced details including links
app.get('/api/meetings/:meetingId/details', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    }).populate('createdBy', 'fullName email');
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Generate QR code
    const qrCode = await generateMeetingQRCode(meeting.accessCodes.publicCode);
    
    // Generate meeting links
    const links = generateMeetingLinks(meeting._id, meeting.accessCodes.publicCode);
    
    // Get attendance statistics
    const attendanceStats = await AttendanceRecord.aggregate([
      {
        $match: { meetingId: meeting._id }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get attendance by type
    const attendanceByType = await AttendanceRecord.aggregate([
      {
        $match: { meetingId: meeting._id }
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
      meetingId: meeting._id
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('attendeeInfo.fullName verificationType status createdAt')
    .lean();
    
    // Update meeting with links
    meeting.shareLinks = links;
    await meeting.save();
    
    // Generate PWA manifest
    const pwaManifest = generatePWAManifest(meeting, req.user.organizationId);
    
    res.json({
      ...meeting.toObject(),
      qrCode,
      links,
      statistics: {
        attendanceStats,
        attendanceByType,
        recentAttendance,
        totalAttendees: attendanceStats.reduce((sum, stat) => sum + stat.count, 0)
      },
      pwa: {
        enabled: meeting.pwaSettings?.enablePWA !== false,
        manifest: pwaManifest,
        serviceWorker: generateServiceWorker()
      }
    });
    
  } catch (error) {
    console.error('Get meeting details error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting details' });
  }
});


// Enhanced API for setting/updating meeting location with validation
app.post('/api/meetings/:meetingId/location', authenticateToken, async (req, res) => {
  try {
    const { name, latitude, longitude, address, radius } = req.body;
    
    // Validate location data
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Location coordinates are required',
        required: ['latitude', 'longitude']
      });
    }
    
    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        details: 'Latitude must be between -90 and 90, Longitude between -180 and 180'
      });
    }
    
    // Validate radius
    const validRadius = radius || 100;
    if (validRadius < 10 || validRadius > 10000) {
      return res.status(400).json({ 
        error: 'Invalid radius',
        details: 'Radius must be between 10 and 10,000 meters',
        min: 10,
        max: 10000,
        recommended: 100
      });
    }
    
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Check for other meetings at same location/time to avoid conflicts
    const conflictingMeetings = await Meeting.find({
      _id: { $ne: meeting._id },
      organizationId: req.user.organizationId._id,
      'schedule.startTime': { $lt: meeting.schedule.endTime },
      'schedule.endTime': { $gt: meeting.schedule.startTime },
      'location.latitude': { $gte: latitude - 0.001, $lte: latitude + 0.001 },
      'location.longitude': { $gte: longitude - 0.001, $lte: longitude + 0.001 }
    });
    
    if (conflictingMeetings.length > 0) {
      return res.status(409).json({
        error: 'Location conflict detected',
        details: 'Another meeting is scheduled at a nearby location around the same time',
        conflicts: conflictingMeetings.map(m => ({
          title: m.title,
          time: moment(m.schedule.startTime).format('h:mm A'),
          location: m.location.name
        }))
      });
    }
    
    // Update meeting location
    meeting.location = {
      name: name || meeting.location.name,
      latitude,
      longitude,
      address: address || meeting.location.address,
      radius: validRadius,
      // Store geohash for efficient location queries
      geohash: generateGeohash(latitude, longitude)
    };
    
    meeting.updatedAt = new Date();
    await meeting.save();
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_LOCATION_UPDATED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: {
        oldLocation: meeting.location,
        newLocation: { name, latitude, longitude, address, radius: validRadius }
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Meeting location updated successfully',
      location: meeting.location,
      validation: {
        coordinatesValid: true,
        radiusValid: true,
        noConflicts: true,
        geohash: meeting.location.geohash
      }
    });
    
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ 
      error: 'Failed to update meeting location',
      details: 'Please try again or contact support'
    });
  }
});


// ================= ENHANCED MEETING MANAGEMENT APIs =================

// Get meeting details with enhanced information (including form validation)
app.get('/api/meetings/:meetingId/full', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    })
    .populate('createdBy', 'fullName email')
    .lean();

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Get attendance count
    const attendanceCount = await AttendanceRecord.countDocuments({
      meetingId: meeting._id
    });

    // Generate QR code
    const qrCode = await generateMeetingQRCode(meeting.accessCodes.publicCode);

    // Generate meeting links
    const links = generateMeetingLinks(meeting._id, meeting.accessCodes.publicCode);

    // Check if all required sections are filled
    const validationStatus = validateMeetingCompletion(meeting);

    res.json({
      ...meeting,
      qrCode,
      links,
      attendanceCount,
      validationStatus,
      canBeActivated: validationStatus.allSectionsComplete
    });

  } catch (error) {
    console.error('Get full meeting error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting details' });
  }
});

// Validate meeting completion
const validateMeetingCompletion = (meeting) => {
  const validation = {
    allSectionsComplete: false,
    sections: {
      meetingDetails: false,
      attendanceForm: false,
      shareQRCode: false,
      advancedSettings: false
    },
    messages: []
  };

  // 1. Check Meeting Details
  if (meeting.title && 
      meeting.location.name && 
      meeting.location.latitude && 
      meeting.location.longitude &&
      meeting.schedule.startTime &&
      meeting.schedule.endTime) {
    validation.sections.meetingDetails = true;
  } else {
    validation.messages.push('Meeting details incomplete: Title, location, and schedule are required');
  }

  // 2. Check Attendance Form (if required fields are configured)
  const hasRequiredFields = meeting.attendanceConfig?.requiredFields?.length > 0 ||
                           meeting.customFormFields?.length > 0;
  validation.sections.attendanceForm = hasRequiredFields;
  if (!hasRequiredFields) {
    validation.messages.push('Attendance form incomplete: Configure at least one required field');
  }

  // 3. Check Share & QR Code (access codes should be generated)
  validation.sections.shareQRCode = meeting.accessCodes?.publicCode && 
                                    meeting.accessCodes?.smsCode && 
                                    meeting.accessCodes?.ussdCode;
  if (!validation.sections.shareQRCode) {
    validation.messages.push('Share & QR Code section incomplete: Generate access codes');
  }

  // 4. Check Advanced Settings (at least one attendance method enabled)
  const attendanceMethods = meeting.attendanceConfig?.allowedModes;
  const hasEnabledMethods = attendanceMethods && (
    attendanceMethods.smartphoneGPS ||
    attendanceMethods.sms ||
    attendanceMethods.ussd ||
    attendanceMethods.kiosk ||
    attendanceMethods.manual
  );
  validation.sections.advancedSettings = hasEnabledMethods;
  if (!hasEnabledMethods) {
    validation.messages.push('Advanced settings incomplete: Enable at least one attendance method');
  }

  // Check if all sections are complete
  validation.allSectionsComplete = Object.values(validation.sections).every(section => section === true);

  return validation;
};

// Activate meeting and generate share links
app.post('/api/meetings/:meetingId/activate', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      status: 'draft'
    });

    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or not in draft status' 
      });
    }

    // Validate all sections are complete
    const validationStatus = validateMeetingCompletion(meeting);
    if (!validationStatus.allSectionsComplete) {
      return res.status(400).json({
        error: 'Meeting cannot be activated',
        details: 'Please complete all sections before activating',
        validationStatus
      });
    }

    // Generate meeting links if not already generated
    if (!meeting.shareLinks) {
      const links = generateMeetingLinks(meeting._id, meeting.accessCodes.publicCode);
      meeting.shareLinks = links;
    }

    // Update meeting status to active
    meeting.status = 'active';
    meeting.updatedAt = new Date();
    await meeting.save();

    // Generate QR code
    const qrCode = await generateMeetingQRCode(meeting.accessCodes.publicCode);

    // Generate success modal data
    const modalData = {
      meetingId: meeting._id,
      title: meeting.title,
      shareLinks: meeting.shareLinks,
      qrCode,
      accessCodes: {
        publicCode: meeting.accessCodes.publicCode,
        smsCode: meeting.accessCodes.smsCode,
        ussdCode: meeting.accessCodes.ussdCode
      },
      timestamp: new Date().toISOString()
    };

    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_ACTIVATED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: {
        title: meeting.title,
        validationStatus
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Meeting activated successfully',
      meeting: {
        id: meeting._id,
        title: meeting.title,
        status: meeting.status
      },
      modalData,
      validationStatus
    });

  } catch (error) {
    console.error('Activate meeting error:', error);
    res.status(500).json({ error: 'Failed to activate meeting' });
  }
});

// Update meeting section by section
app.patch('/api/meetings/:meetingId/sections/:section', authenticateToken, async (req, res) => {
  try {
    const { meetingId, section } = req.params;
    const data = req.body;

    const meeting = await Meeting.findOne({
      _id: meetingId,
      organizationId: req.user.organizationId._id
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    let updateData = {};
    let validationResult = { isValid: true, message: '' };

    switch (section) {
      case 'details':
        updateData = {
          title: data.title,
          description: data.description,
          location: data.location,
          schedule: data.schedule
        };
        validationResult = validateMeetingDetails(data);
        break;

      case 'attendance-form':
        updateData = {
          attendanceConfig: {
            ...meeting.attendanceConfig,
            requiredFields: data.requiredFields || []
          },
          customFormFields: data.customFormFields || []
        };
        validationResult = validateAttendanceForm(data);
        break;

      case 'share-qrcode':
        // Generate access codes if not already generated
        if (!meeting.accessCodes?.publicCode) {
          updateData.accessCodes = {
            publicCode: generateAccessCode(),
            smsCode: `MTG-${generateAccessCode().slice(0, 4)}`,
            ussdCode: generateAccessCode().slice(0, 6)
          };
        }
        break;

      case 'advanced-settings':
        updateData = {
          attendanceConfig: {
            ...meeting.attendanceConfig,
            allowedModes: data.allowedModes,
            verificationStrictness: data.verificationStrictness,
            duplicatePrevention: data.duplicatePrevention
          },
          timeVerification: data.timeVerification,
          pwaSettings: data.pwaSettings
        };
        validationResult = validateAdvancedSettings(data);
        break;

      default:
        return res.status(400).json({ error: 'Invalid section' });
    }

    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.message
      });
    }

    // Apply updates
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        meeting[key] = updateData[key];
      }
    });

    meeting.updatedAt = new Date();
    await meeting.save();

    // Check current completion status
    const validationStatus = validateMeetingCompletion(meeting);

    res.json({
      success: true,
      message: `${section} updated successfully`,
      validationStatus,
      canBeActivated: validationStatus.allSectionsComplete,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        status: meeting.status
      }
    });

  } catch (error) {
    console.error('Update meeting section error:', error);
    res.status(500).json({ error: 'Failed to update meeting section' });
  }
});

// Validation functions
const validateMeetingDetails = (data) => {
  if (!data.title || !data.title.trim()) {
    return { isValid: false, message: 'Meeting title is required' };
  }
  if (!data.location?.name || !data.location?.latitude || !data.location?.longitude) {
    return { isValid: false, message: 'Location details are required' };
  }
  if (!data.schedule?.startTime || !data.schedule?.endTime) {
    return { isValid: false, message: 'Schedule times are required' };
  }
  if (new Date(data.schedule.startTime) >= new Date(data.schedule.endTime)) {
    return { isValid: false, message: 'End time must be after start time' };
  }
  return { isValid: true, message: 'Meeting details are valid' };
};

const validateAttendanceForm = (data) => {
  const hasRequiredFields = (data.requiredFields && data.requiredFields.length > 0) ||
                           (data.customFormFields && data.customFormFields.length > 0);
  
  if (!hasRequiredFields) {
    return { 
      isValid: false, 
      message: 'At least one field must be configured in the attendance form' 
    };
  }
  return { isValid: true, message: 'Attendance form is valid' };
};

const validateAdvancedSettings = (data) => {
  const hasEnabledMethods = data.allowedModes && (
    data.allowedModes.smartphoneGPS ||
    data.allowedModes.sms ||
    data.allowedModes.ussd ||
    data.allowedModes.kiosk ||
    data.allowedModes.manual
  );
  
  if (!hasEnabledMethods) {
    return { 
      isValid: false, 
      message: 'At least one attendance method must be enabled' 
    };
  }
  return { isValid: true, message: 'Advanced settings are valid' };
};

// Get all meetings with enhanced details for the meetings table
app.get('/api/organization/meetings/enhanced', authenticateToken, async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    
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
    
    const skip = (page - 1) * limit;
    
    const meetings = await Meeting.find(query)
      .populate('createdBy', 'fullName email')
      .sort({ 'schedule.startTime': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get attendance counts and validation status for each meeting
    const enhancedMeetings = await Promise.all(meetings.map(async (meeting) => {
      const attendanceCount = await AttendanceRecord.countDocuments({
        meetingId: meeting._id
      });
      
      const validationStatus = validateMeetingCompletion(meeting);
      
      return {
        ...meeting,
        attendanceCount,
        validationStatus,
        canBeEdited: meeting.status === 'draft' || meeting.status === 'active',
        canBeDeleted: meeting.status === 'draft' || attendanceCount === 0
      };
    }));
    
    const total = await Meeting.countDocuments(query);
    
    res.json({
      meetings: enhancedMeetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get enhanced meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});


// Update meeting with custom form
app.put('/api/meetings/:meetingId/form', authenticateToken, async (req, res) => {
  try {
    const { customFormFields, timeVerification, pwaSettings } = req.body;
    
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Update fields
    const updates = { updatedAt: new Date() };
    
    if (customFormFields) {
      updates.customFormFields = customFormFields;
    }
    
    if (timeVerification) {
      updates.timeVerification = {
        ...meeting.timeVerification,
        ...timeVerification
      };
    }
    
    if (pwaSettings) {
      updates.pwaSettings = {
        ...meeting.pwaSettings,
        ...pwaSettings
      };
    }
    
    const updatedMeeting = await Meeting.findByIdAndUpdate(
      meeting._id,
      updates,
      { new: true }
    );
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'MEETING_FORM_UPDATED',
      entityType: 'meeting',
      entityId: meeting._id,
      details: { 
        customFormFields: customFormFields?.length || 0,
        timeVerification: !!timeVerification,
        pwaSettings: !!pwaSettings
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json(updatedMeeting);
    
  } catch (error) {
    console.error('Update meeting form error:', error);
    res.status(500).json({ error: 'Failed to update meeting form' });
  }
});

// Get meeting form for attendees
app.get('/api/meetings/:publicCode/form', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      'accessCodes.publicCode': req.params.publicCode,
      status: { $in: ['active', 'in_progress'] }
    }).populate('organizationId', 'name');
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or not active' });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart || now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ 
        error: 'Attendance form not available at this time',
        availableFrom: meeting.schedule.attendanceStart,
        availableUntil: meeting.schedule.attendanceEnd
      });
    }
    
    // Prepare form data
    const formData = {
      meeting: {
        id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        organization: meeting.organizationId.name,
        location: meeting.location
      },
      requiredFields: meeting.attendanceConfig.requiredFields || [],
      customFormFields: meeting.customFormFields || [],
      allowedModes: meeting.attendanceConfig.allowedModes,
      timeVerification: meeting.timeVerification || {},
      pwaEnabled: meeting.pwaSettings?.enablePWA !== false
    };
    
    res.json(formData);
    
  } catch (error) {
    console.error('Get meeting form error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting form' });
  }
});

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

    // Validate location data
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({
        error: 'Meeting location is required',
        details: 'Please provide latitude and longitude for the meeting venue'
      });
    }


    // Validate coordinates
    if (location.latitude < -90 || location.latitude > 90 || 
        location.longitude < -180 || location.longitude > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        details: 'Latitude must be between -90 and 90, Longitude between -180 and 180'
      });
    }

      // Validate radius
    const radius = location.radius || req.user.organizationId.settings.defaultLocationRadius;
    if (radius < 10 || radius > 10000) {
      return res.status(400).json({
        error: 'Invalid radius',
        details: 'Radius must be between 10 and 10,000 meters',
        recommended: req.user.organizationId.settings.defaultLocationRadius
      });
    }
    
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
      // ADD THESE:
        customFormFields: req.body.customFormFields || [],
        timeVerification: req.body.timeVerification || {
          requireMinimumStay: false,
          minimumStayMinutes: 5,
          enableContinuousMonitoring: false,
          monitoringInterval: 5,
          maxAllowedAbsence: 2,
          autoVerifyAfterStay: false,
          autoVerifyMinutes: 10
        },
        pwaSettings: req.body.pwaSettings || {
          enablePWA: true,
          appName: 'GSAMS Attendance',
          themeColor: '#2196F3',
          backgroundColor: '#ffffff'
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
// Enhanced smartphone attendance with time verification
// Replace the existing /api/attend/smartphone endpoint (around line 650) with this enhanced version:

// Enhanced smartphone attendance with strict location verification
app.post('/api/attend/smartphone', async (req, res) => {
  try {
    const { meetingCode, attendeeInfo, locationData, deviceInfo, formData } = req.body;
    
    // Validate required location data
    if (!locationData || !locationData.latitude || !locationData.longitude) {
      return res.status(400).json({ 
        error: 'Location data is required',
        details: 'Please enable GPS/location services on your device'
      });
    }
    
    if (!locationData.accuracy) {
      return res.status(400).json({ 
        error: 'Location accuracy is required',
        details: 'Cannot verify location without accuracy information'
      });
    }
    
    // Find meeting
    const meeting = await Meeting.findOne({
      'accessCodes.publicCode': meetingCode,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or not active',
        suggestions: [
          'Check the meeting code',
          'Ensure the meeting has started',
          'Contact the meeting organizer'
        ]
      });
    }
    
    // Check if GPS attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.smartphoneGPS) {
      return res.status(403).json({ 
        error: 'GPS attendance not allowed',
        details: 'This meeting does not allow smartphone GPS attendance'
      });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart) {
      return res.status(403).json({ 
        error: 'Attendance not yet started',
        details: `Attendance starts at ${moment(meeting.schedule.attendanceStart).format('h:mm A')}`,
        availableFrom: meeting.schedule.attendanceStart
      });
    }
    
    if (now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ 
        error: 'Attendance period has ended',
        details: `Attendance ended at ${moment(meeting.schedule.attendanceEnd).format('h:mm A')}`,
        endedAt: meeting.schedule.attendanceEnd
      });
    }
    
    // STRICT LOCATION VALIDATION
    const locationValidation = validateLocation(
      locationData.latitude,
      locationData.longitude,
      meeting.location.latitude,
      meeting.location.longitude,
      meeting.location.radius,
      locationData.accuracy
    );
    
    // Check for previous locations from this device
    const previousAttendance = await AttendanceRecord.findOne({
      'deviceInfo.deviceId': deviceInfo?.deviceId,
      'meetingId': meeting._id
    }).sort({ createdAt: -1 });
    
    // Detect location spoofing
    const spoofingDetection = detectLocationSpoofing(
      locationData,
      previousAttendance ? [previousAttendance.locationData.coordinates] : []
    );
    
    // Apply strictness level from meeting config
    let locationAccepted = false;
    let rejectionReason = '';
    
    switch(meeting.attendanceConfig.verificationStrictness) {
      case 'low':
        locationAccepted = locationValidation.checks.accuracyAdjustedCheck;
        break;
      case 'medium':
        locationAccepted = locationValidation.checks.basicRadiusCheck;
        if (spoofingDetection.riskLevel === 'high') {
          locationAccepted = false;
          rejectionReason = 'Suspicious location detected';
        }
        break;
      case 'high':
        locationAccepted = locationValidation.checks.strictCheck && 
                          !spoofingDetection.isSuspicious &&
                          locationValidation.checks.validCoordinates &&
                          locationData.accuracy < 50; // Require good accuracy
        if (!locationAccepted) {
          rejectionReason = 'Strict location verification failed';
        }
        break;
      default:
        locationAccepted = locationValidation.checks.basicRadiusCheck;
    }
    
    if (!locationAccepted) {
      return res.status(403).json({ 
        error: 'Location verification failed',
        details: rejectionReason || 'Your location does not match the meeting venue',
        validation: {
          ...locationValidation,
          spoofingDetection,
          meetingLocation: {
            latitude: meeting.location.latitude,
            longitude: meeting.location.longitude,
            radius: meeting.location.radius,
            address: meeting.location.address
          },
          yourLocation: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy
          }
        },
        suggestions: [
          'Enable high-accuracy GPS mode',
          'Move closer to the meeting venue',
          'Ensure location services are enabled',
          'Try again in a different location'
        ]
      });
    }
    
    // Check for duplicates
    const duplicateChecks = [];
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameDevice && deviceInfo?.deviceId) {
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
            status: duplicate.status,
            name: duplicate.attendeeInfo.fullName
          },
          timeWindow: `${meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes} minutes`,
          message: 'You have already marked attendance for this meeting'
        });
      }
    }
    
    // Validate custom form data if present
    const additionalFields = new Map();
    if (formData && meeting.customFormFields) {
      for (const field of meeting.customFormFields) {
        if (field.isRequired && (!formData[field.fieldName] || formData[field.fieldName].trim() === '')) {
          return res.status(400).json({ 
            error: 'Required information missing',
            details: `Please provide: ${field.label}`,
            field: field.fieldName,
            label: field.label
          });
        }
        
        if (formData[field.fieldName]) {
          // Apply validation if specified
          if (field.validation) {
            const value = formData[field.fieldName].toString();
            
            if (field.validation.minLength && value.length < field.validation.minLength) {
              return res.status(400).json({
                error: 'Invalid input',
                details: `${field.label} must be at least ${field.validation.minLength} characters`,
                field: field.fieldName
              });
            }
            
            if (field.validation.maxLength && value.length > field.validation.maxLength) {
              return res.status(400).json({
                error: 'Invalid input',
                details: `${field.label} must not exceed ${field.validation.maxLength} characters`,
                field: field.fieldName
              });
            }
            
            if (field.validation.pattern) {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(value)) {
                return res.status(400).json({
                  error: 'Invalid format',
                  details: `${field.label} format is invalid`,
                  field: field.fieldName
                });
              }
            }
          }
          
          additionalFields.set(field.fieldName, formData[field.fieldName]);
        }
      }
    }
    
    // Calculate enhanced confidence score
    const baseConfidenceScore = calculateConfidenceScore('smartphone_gps', locationData, meeting);
    const locationConfidence = locationValidation.confidenceScore;
    
    // Adjust confidence based on multiple factors
    let finalConfidenceScore = (baseConfidenceScore * 0.6) + (locationConfidence * 0.4);
    
    // Penalize for spoofing warnings
    if (spoofingDetection.warnings.length > 0) {
      finalConfidenceScore -= spoofingDetection.warnings.length * 5;
    }
    
    // Ensure score is within bounds
    finalConfidenceScore = Math.max(0, Math.min(100, finalConfidenceScore));
    
    // Determine status based on confidence and verification strictness
    let status = 'pending';
    const verificationThresholds = {
      low: 50,
      medium: 70,
      high: 85
    };
    
    const threshold = verificationThresholds[meeting.attendanceConfig.verificationStrictness] || 70;
    
    if (finalConfidenceScore >= threshold && !spoofingDetection.isSuspicious) {
      status = 'verified';
    } else if (spoofingDetection.riskLevel === 'high') {
      status = 'flagged';
    }
    
    // Create enhanced attendance record
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'smartphone_gps',
      attendeeInfo: {
        ...attendeeInfo,
        additionalFields: additionalFields
      },
      locationData: {
        coordinates: locationData,
        distanceFromVenue: locationValidation.distance,
        isWithinRadius: locationValidation.isWithinRadius,
        address: locationData.address || meeting.location.address,
        validationDetails: {
          ...locationValidation,
          spoofingDetection,
          strictnessLevel: meeting.attendanceConfig.verificationStrictness
        }
      },
      deviceInfo: {
        ...deviceInfo,
        locationCapabilities: {
          hasGPS: true,
          accuracy: locationData.accuracy,
          altitude: locationData.altitude,
          heading: locationData.heading,
          speed: locationData.speed
        }
      },
      verificationDetails: {
        confidenceScore: finalConfidenceScore,
        verificationMethod: 'GPS',
        verificationTimestamp: now,
        locationVerificationScore: locationConfidence,
        spoofingRisk: spoofingDetection.riskLevel,
        requiresTimeVerification: meeting.timeVerification?.requireMinimumStay || false,
        minimumStayRequired: meeting.timeVerification?.minimumStayMinutes || 0
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: false,
        monitoringEnabled: meeting.timeVerification?.enableContinuousMonitoring || false,
        lastLocationCheck: now,
        locationHistory: [{
          timestamp: now,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          validated: true,
          validationScore: locationConfidence
        }]
      },
      status,
      auditTrail: [{
        action: 'ATTENDANCE_RECORDED',
        performedBy: null,
        notes: `GPS attendance recorded with ${finalConfidenceScore.toFixed(1)}% confidence`
      }]
    });
    
    // Update device fingerprint with enhanced data
    if (deviceInfo?.deviceId) {
      await DeviceFingerprint.findOneAndUpdate(
        { deviceId: deviceInfo.deviceId, organizationId: meeting.organizationId },
        {
          $set: {
            lastUsed: now,
            lastLocation: {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              timestamp: now
            },
            metadata: {
              userAgent: deviceInfo.userAgent,
              platform: deviceInfo.platform,
              os: deviceInfo.os,
              browser: deviceInfo.browser,
              screenResolution: deviceInfo.screenResolution,
              hasGPS: true,
              locationAccuracy: locationData.accuracy
            },
            locationHistory: {
              $push: {
                timestamp: now,
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                meetingId: meeting._id
              }
            }
          }
        },
        { upsert: true, new: true }
      );
    }
    
    // Schedule monitoring if enabled
    if (meeting.timeVerification?.enableContinuousMonitoring) {
      setTimeout(() => {
        monitorAttendanceDuration(attendanceRecord._id, meeting._id);
      }, (meeting.timeVerification.monitoringInterval || 5) * 60000);
    }
    
    // Generate enhanced response
    const response = {
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      confidenceScore: finalConfidenceScore,
      locationVerification: {
        passed: true,
        distance: locationValidation.distance.toFixed(2),
        radius: meeting.location.radius,
        accuracy: locationData.accuracy,
        confidence: locationConfidence,
        warnings: [...locationValidation.messages, ...spoofingDetection.warnings]
      },
      timeVerification: meeting.timeVerification?.requireMinimumStay ? {
        required: true,
        minimumMinutes: meeting.timeVerification.minimumStayMinutes,
        monitoringEnabled: meeting.timeVerification.enableContinuousMonitoring,
        autoVerify: meeting.timeVerification.autoVerifyAfterStay,
        autoVerifyAfterMinutes: meeting.timeVerification.autoVerifyMinutes
      } : { required: false },
      meetingDetails: {
        title: meeting.title,
        location: meeting.location.name,
        time: moment(meeting.schedule.startTime).format('h:mm A'),
        organizer: meeting.organizationId.name
      },
      nextSteps: status === 'verified' ? 
        ['You can now participate in the meeting'] :
        ['Your attendance is pending verification', 'An organizer will review your submission'],
      timestamp: now.toISOString()
    };
    
    // Add PWA response if enabled
    if (meeting.pwaSettings?.enablePWA !== false) {
      response.pwa = {
        manifestUrl: `${process.env.FRONTEND_URL || 'https://gsf-inky.vercel.app'}/api/meetings/${meeting._id}/manifest.json`,
        installable: true,
        features: ['offline', 'push-notifications', 'background-sync', 'location-tracking']
      };
    }
    
    res.status(201).json(response);
    
    // Log successful attendance
    await AuditLog.create({
      organizationId: meeting.organizationId,
      userId: null,
      action: 'GPS_ATTENDANCE_RECORDED',
      entityType: 'attendance',
      entityId: attendanceRecord._id,
      details: {
        attendeeName: attendeeInfo.fullName,
        confidenceScore: finalConfidenceScore,
        locationVerified: true,
        distance: locationValidation.distance,
        status
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
  } catch (error) {
    console.error('Smartphone attendance error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to record attendance';
    let errorDetails = 'An unexpected error occurred';
    
    if (error.name === 'ValidationError') {
      errorMessage = 'Validation error';
      errorDetails = Object.values(error.errors).map(err => err.message).join(', ');
    } else if (error.code === 11000) {
      errorMessage = 'Duplicate record';
      errorDetails = 'This attendance appears to already exist';
    }
    
    res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString(),
      support: 'If this persists, please contact the meeting organizer'
    });
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

// Add these new routes after line 1100

// ================= REAL-TIME MONITORING APIs =================

// Update location for continuous monitoring
app.post('/api/attendance/:attendanceId/location', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, meetingCode } = req.body;
    
    const attendance = await AttendanceRecord.findOne({
      _id: req.params.attendanceId
    }).populate('meetingId');
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const meeting = attendance.meetingId;
    
    // Verify meeting code
    if (meeting.accessCodes.publicCode !== meetingCode) {
      return res.status(403).json({ error: 'Invalid meeting code' });
    }
    
    const now = new Date();
    
    // Check if still within radius
    const distance = calculateDistance(
      latitude,
      longitude,
      meeting.location.latitude,
      meeting.location.longitude
    );
    
    const isWithinRadius = distance <= meeting.location.radius;
    
    // Update location history
    if (!attendance.timeTracking.locationHistory) {
      attendance.timeTracking.locationHistory = [];
    }
    
    attendance.timeTracking.locationHistory.push({
      timestamp: now,
      latitude,
      longitude,
      accuracy,
      isWithinRadius
    });
    
    attendance.timeTracking.lastLocationCheck = now;
    
    // Check for excessive absence
    if (meeting.timeVerification?.enableContinuousMonitoring) {
      const recentLocations = attendance.timeTracking.locationHistory
        .filter(loc => new Date(loc.timestamp) > new Date(now.getTime() - 10 * 60000)) // Last 10 minutes
        .filter(loc => loc.isWithinRadius);
      
      const presencePercentage = (recentLocations.length / 10) * 100; // Assuming 1 check per minute
      
      if (presencePercentage < 80) { // Less than 80% presence
        attendance.auditTrail.push({
          action: 'LOW_PRESENCE_WARNING',
          performedBy: null,
          notes: `Low presence detected: ${presencePercentage.toFixed(1)}% in last 10 minutes`
        });
      }
    }
    
    await attendance.save();
    
    res.json({
      success: true,
      isWithinRadius,
      distance,
      lastCheck: now,
      totalChecks: attendance.timeTracking.locationHistory.length
    });
    
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Get real-time attendance monitoring
app.get('/api/meetings/:meetingId/monitor', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Get active attendance records
    const activeAttendances = await AttendanceRecord.find({
      meetingId: meeting._id,
      status: { $in: ['pending', 'verified'] },
      'timeTracking.checkOutTime': { $exists: false }
    })
    .select('attendeeInfo.fullName verificationType timeTracking locationData verificationDetails')
    .lean();
    
    // Enrich with monitoring data
    const monitoredAttendances = activeAttendances.map(attendance => {
      const checkInTime = new Date(attendance.timeTracking.checkInTime);
      const now = new Date();
      const durationMinutes = Math.round((now - checkInTime) / (1000 * 60));
      
      return {
        ...attendance,
        durationMinutes,
        meetsMinimumStay: durationMinutes >= (meeting.timeVerification?.minimumStayMinutes || 0),
        lastLocationCheck: attendance.timeTracking.lastLocationCheck,
        locationChecks: attendance.timeTracking.locationHistory?.length || 0,
        isCurrentlyPresent: attendance.timeTracking.locationHistory?.slice(-1)[0]?.isWithinRadius || false
      };
    });
    
    res.json({
      meetingId: meeting._id,
      title: meeting.title,
      timeVerificationEnabled: meeting.timeVerification?.requireMinimumStay || false,
      monitoringEnabled: meeting.timeVerification?.enableContinuousMonitoring || false,
      totalActive: monitoredAttendances.length,
      attendees: monitoredAttendances
    });
    
  } catch (error) {
    console.error('Monitor error:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring data' });
  }
});

// Manually verify time-based attendance
app.post('/api/attendance/:attendanceId/verify-time', authenticateToken, async (req, res) => {
  try {
    const { notes } = req.body;
    
    const attendance = await AttendanceRecord.findOne({
      _id: req.params.attendanceId,
      organizationId: req.user.organizationId._id
    }).populate('meetingId');
    
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    
    const meeting = attendance.meetingId;
    
    // Check time verification requirements
    if (!meeting.timeVerification?.requireMinimumStay) {
      return res.status(400).json({ error: 'Time verification not required for this meeting' });
    }
    
    const checkInTime = new Date(attendance.timeTracking.checkInTime);
    const now = new Date();
    const durationMinutes = Math.round((now - checkInTime) / (1000 * 60));
    
    const meetsMinimumStay = durationMinutes >= meeting.timeVerification.minimumStayMinutes;
    
    if (!meetsMinimumStay) {
      return res.status(400).json({ 
        error: 'Minimum stay requirement not met',
        currentDuration: durationMinutes,
        requiredDuration: meeting.timeVerification.minimumStayMinutes
      });
    }
    
    // Verify attendance
    attendance.status = 'verified';
    attendance.verificationDetails.confidenceScore = Math.min(
      attendance.verificationDetails.confidenceScore + 20,
      100
    );
    attendance.verificationDetails.timeVerified = now;
    attendance.verificationDetails.timeVerifiedBy = req.user._id;
    
    attendance.auditTrail.push({
      action: 'TIME_VERIFICATION',
      performedBy: req.user._id,
      notes: `Time verification: ${durationMinutes} minutes attendance. ${notes || ''}`
    });
    
    attendance.updatedAt = now;
    await attendance.save();
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'ATTENDANCE_TIME_VERIFIED',
      entityType: 'attendance',
      entityId: attendance._id,
      details: {
        attendeeName: attendance.attendeeInfo.fullName,
        durationMinutes,
        requiredMinutes: meeting.timeVerification.minimumStayMinutes
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      attendanceId: attendance._id,
      status: attendance.status,
      durationMinutes,
      confidenceScore: attendance.verificationDetails.confidenceScore,
      message: 'Attendance time-verified successfully'
    });
    
  } catch (error) {
    console.error('Time verification error:', error);
    res.status(500).json({ error: 'Failed to verify attendance time' });
  }
});



// Add these routes after line 1250

// ================= ENHANCED EXPORT APIs =================

// Export all meetings as PDF
app.get('/api/organization/meetings/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const query = {
      organizationId: req.user.organizationId._id
    };
    
    if (startDate && endDate) {
      query['schedule.startTime'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    const meetings = await Meeting.find(query)
      .populate('createdBy', 'fullName')
      .sort({ 'schedule.startTime': -1 })
      .lean();
    
    // Get attendance counts for each meeting
    for (const meeting of meetings) {
      const attendanceCount = await AttendanceRecord.countDocuments({
        meetingId: meeting._id
      });
      meeting.attendanceCount = attendanceCount;
    }
    
    const organization = await Organization.findById(req.user.organizationId._id);
    
    // Generate PDF
    const pdfBuffer = await generateAllMeetingsPDF(
      meetings, 
      organization, 
      startDate || new Date(0), 
      endDate || new Date()
    );
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'EXPORT_ALL_MEETINGS_PDF',
      entityType: 'organization',
      entityId: organization._id,
      details: { 
        meetingCount: meetings.length,
        dateRange: { startDate, endDate }
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="all-meetings-${moment().format('YYYY-MM-DD')}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Export all meetings PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Export all meetings as Excel
app.get('/api/organization/meetings/export/excel', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    
    const query = {
      organizationId: req.user.organizationId._id
    };
    
    if (startDate && endDate) {
      query['schedule.startTime'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    const meetings = await Meeting.find(query)
      .populate('createdBy', 'fullName')
      .sort({ 'schedule.startTime': -1 })
      .lean();
    
    const organization = await Organization.findById(req.user.organizationId._id);
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('All Meetings');
    
    // Header
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = organization.name;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = 'All Meetings Report';
    worksheet.getCell('A2').font = { size: 14, bold: true };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
    // Date range
    if (startDate && endDate) {
      worksheet.mergeCells('A3:H3');
      worksheet.getCell('A3').value = `Period: ${moment(startDate).format('MMM DD, YYYY')} to ${moment(endDate).format('MMM DD, YYYY')}`;
      worksheet.getCell('A3').alignment = { horizontal: 'center' };
    }
    
    // Table header
    const headerRow = 5;
    const headers = ['Title', 'Date', 'Time', 'Location', 'Status', 'Created By', 'Attendees', 'Duration'];
    
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(headerRow, index + 1);
      cell.value = header;
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
    });
    
    // Add meetings data
    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i];
      const row = headerRow + i + 1;
      
      // Get attendance count
      const attendanceCount = await AttendanceRecord.countDocuments({
        meetingId: meeting._id
      });
      
      // Calculate duration
      const start = new Date(meeting.schedule.startTime);
      const end = new Date(meeting.schedule.endTime);
      const durationHours = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;
      
      worksheet.getCell(`A${row}`).value = meeting.title;
      worksheet.getCell(`B${row}`).value = moment(meeting.schedule.startTime).format('YYYY-MM-DD');
      worksheet.getCell(`C${row}`).value = moment(meeting.schedule.startTime).format('HH:mm');
      worksheet.getCell(`D${row}`).value = meeting.location.name;
      worksheet.getCell(`E${row}`).value = meeting.status.toUpperCase();
      worksheet.getCell(`F${row}`).value = meeting.createdBy?.fullName || 'Unknown';
      worksheet.getCell(`G${row}`).value = attendanceCount;
      worksheet.getCell(`H${row}`).value = durationHours;
      
      // Color code status
      const statusCell = worksheet.getCell(`E${row}`);
      const statusColors = {
        'draft': 'FFFFCC',
        'active': 'CCFFCC',
        'in_progress': '00FF00',
        'completed': 'CCCCCC',
        'cancelled': 'FFCCCC'
      };
      
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusColors[meeting.status] || 'FFFFFF' }
      };
      
      // Add borders
      for (let j = 1; j <= headers.length; j++) {
        const cell = worksheet.getCell(row, j);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
    
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
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'EXPORT_ALL_MEETINGS_EXCEL',
      entityType: 'organization',
      entityId: organization._id,
      details: { meetingCount: meetings.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="all-meetings-${moment().format('YYYY-MM-DD')}.xlsx"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Export all meetings Excel error:', error);
    res.status(500).json({ error: 'Failed to generate Excel' });
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

// Add this middleware function after other middleware (around line 400)
const trackAttendanceJoin = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    try {
      // Check if this is an attendance endpoint
      if (req.path.includes('/api/attend/') && res.statusCode === 201) {
        const response = JSON.parse(data);
        
        // Emit socket event or log to real-time system
        if (response.attendanceId) {
          // In a real implementation, you would emit to WebSocket/Socket.io
          console.log(`New attendance: ${response.attendanceId}`);
          
          // You could also update a Redis cache for real-time dashboards
        }
      }
    } catch (error) {
      // Don't break the response if tracking fails
      console.error('Attendance tracking error:', error);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Apply the middleware to attendance routes
app.use('/api/attend', trackAttendanceJoin);

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

// API for location analytics and verification reports
app.get('/api/meetings/:meetingId/location-analytics', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Get all attendance records with GPS data
    const attendanceRecords = await AttendanceRecord.find({
      meetingId: meeting._id,
      verificationType: 'smartphone_gps'
    }).select('locationData verificationDetails status createdAt');
    
    // Calculate location analytics
    const analytics = {
      totalGPSAttendance: attendanceRecords.length,
      byAccuracy: {
        excellent: attendanceRecords.filter(r => r.locationData.coordinates?.accuracy < 10).length,
        good: attendanceRecords.filter(r => r.locationData.coordinates?.accuracy >= 10 && r.locationData.coordinates?.accuracy < 50).length,
        fair: attendanceRecords.filter(r => r.locationData.coordinates?.accuracy >= 50 && r.locationData.coordinates?.accuracy < 100).length,
        poor: attendanceRecords.filter(r => r.locationData.coordinates?.accuracy >= 100).length
      },
      byDistance: {
        within50m: attendanceRecords.filter(r => r.locationData.distanceFromVenue <= 50).length,
        within100m: attendanceRecords.filter(r => r.locationData.distanceFromVenue > 50 && r.locationData.distanceFromVenue <= 100).length,
        beyond100m: attendanceRecords.filter(r => r.locationData.distanceFromVenue > 100).length
      },
      confidenceDistribution: {
        high: attendanceRecords.filter(r => r.verificationDetails.confidenceScore >= 80).length,
        medium: attendanceRecords.filter(r => r.verificationDetails.confidenceScore >= 50 && r.verificationDetails.confidenceScore < 80).length,
        low: attendanceRecords.filter(r => r.verificationDetails.confidenceScore < 50).length
      },
      flaggedLocations: attendanceRecords.filter(r => 
        r.locationData.validationDetails?.spoofingDetection?.isSuspicious
      ).length,
      averageDistance: attendanceRecords.reduce((sum, r) => sum + (r.locationData.distanceFromVenue || 0), 0) / attendanceRecords.length,
      averageAccuracy: attendanceRecords.reduce((sum, r) => sum + (r.locationData.coordinates?.accuracy || 0), 0) / attendanceRecords.length,
      averageConfidence: attendanceRecords.reduce((sum, r) => sum + (r.verificationDetails.confidenceScore || 0), 0) / attendanceRecords.length
    };
    
    // Get location clusters (simplified)
    const locationClusters = {};
    attendanceRecords.forEach(record => {
      if (record.locationData.coordinates) {
        const lat = record.locationData.coordinates.latitude.toFixed(4);
        const lon = record.locationData.coordinates.longitude.toFixed(4);
        const key = `${lat},${lon}`;
        
        if (!locationClusters[key]) {
          locationClusters[key] = {
            coordinates: { latitude: parseFloat(lat), longitude: parseFloat(lon) },
            count: 0,
            attendees: []
          };
        }
        
        locationClusters[key].count++;
        locationClusters[key].attendees.push({
          name: record.attendeeInfo?.fullName,
          distance: record.locationData.distanceFromVenue,
          accuracy: record.locationData.coordinates.accuracy,
          confidence: record.verificationDetails.confidenceScore
        });
      }
    });
    
    res.json({
      meeting: {
        id: meeting._id,
        title: meeting.title,
        location: meeting.location,
        verificationStrictness: meeting.attendanceConfig.verificationStrictness
      },
      analytics,
      locationClusters: Object.values(locationClusters),
      summary: {
        locationVerificationSuccessRate: (attendanceRecords.filter(r => r.status !== 'rejected').length / attendanceRecords.length * 100).toFixed(1),
        averageLocationQuality: analytics.averageAccuracy < 20 ? 'Excellent' : 
                              analytics.averageAccuracy < 50 ? 'Good' : 
                              analytics.averageAccuracy < 100 ? 'Fair' : 'Poor',
        recommendations: analytics.flaggedLocations > 0 ? 
          ['Review flagged locations for potential spoofing'] :
          ['Location verification is working well']
      }
    });
    
  } catch (error) {
    console.error('Location analytics error:', error);
    res.status(500).json({ error: 'Failed to generate location analytics' });
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

// Add these routes after line 1350

// ================= PWA SUPPORT APIs =================

// Get PWA manifest for meeting
app.get('/api/meetings/:meetingId/manifest.json', async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId)
      .populate('organizationId', 'name');
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Check if PWA is enabled
    if (meeting.pwaSettings?.enablePWA === false) {
      return res.status(404).json({ error: 'PWA not enabled for this meeting' });
    }
    
    const manifest = generatePWAManifest(meeting, meeting.organizationId);
    
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);
    
  } catch (error) {
    console.error('Manifest error:', error);
    res.status(500).json({ error: 'Failed to generate manifest' });
  }
});

// Get service worker
app.get('/api/pwa/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(generateServiceWorker());
});

// Get PWA icons (placeholder - in production, serve actual icon files)
app.get('/api/pwa/icons/:size', (req, res) => {
  const sizes = {
    '72': 72,
    '96': 96,
    '128': 128,
    '144': 144,
    '152': 152,
    '192': 192,
    '384': 384,
    '512': 512
  };
  
  const size = sizes[req.params.size];
  if (!size) {
    return res.status(404).json({ error: 'Invalid icon size' });
  }
  
  // In production, you would serve actual icon files
  // This is a placeholder response
  res.json({
    message: 'Icon placeholder',
    size,
    url: `https://via.placeholder.com/${size}x${size}/2196F3/FFFFFF?text=GSAMS`
  });
});

// Register device for push notifications
app.post('/api/pwa/register-device', async (req, res) => {
  try {
    const { meetingId, deviceId, pushSubscription, userAgent } = req.body;
    
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Store device registration (you might want to create a separate collection for this)
    await DeviceFingerprint.findOneAndUpdate(
      { deviceId, organizationId: meeting.organizationId },
      {
        $set: {
          pushSubscription,
          lastUsed: new Date(),
          metadata: { userAgent }
        }
      },
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      message: 'Device registered for push notifications'
    });
    
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Send push notification (admin endpoint)
app.post('/api/pwa/send-notification', authenticateToken, async (req, res) => {
  try {
    const { meetingId, title, message, type } = req.body;
    
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // In a real implementation, you would:
    // 1. Get all registered devices for this meeting
    // 2. Send push notifications via Firebase Cloud Messaging or similar
    // 3. Log the notification
    
    // For now, we'll just log it
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      action: 'PWA_NOTIFICATION_SENT',
      entityType: 'meeting',
      entityId: meeting._id,
      details: { title, message, type },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Notification queued for sending'
    });
    
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Add this route for pre-attendance location testing
app.post('/api/location/test', async (req, res) => {
  try {
    const { meetingCode, latitude, longitude, accuracy } = req.body;
    
    if (!meetingCode || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['meetingCode', 'latitude', 'longitude']
      });
    }
    
    // Find meeting
    const meeting = await Meeting.findOne({
      'accessCodes.publicCode': meetingCode,
      status: { $in: ['draft', 'active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        suggestions: ['Check the meeting code', 'Contact the meeting organizer']
      });
    }
    
    // Test location validation
    const locationValidation = validateLocation(
      latitude,
      longitude,
      meeting.location.latitude,
      meeting.location.longitude,
      meeting.location.radius,
      accuracy || 100 // Default accuracy if not provided
    );
    
    // Detect potential spoofing
    const spoofingDetection = detectLocationSpoofing({
      latitude,
      longitude,
      accuracy: accuracy || 100
    });
    
    // Calculate if location would be accepted
    let wouldBeAccepted = false;
    switch(meeting.attendanceConfig.verificationStrictness) {
      case 'low':
        wouldBeAccepted = locationValidation.checks.accuracyAdjustedCheck;
        break;
      case 'medium':
        wouldBeAccepted = locationValidation.checks.basicRadiusCheck;
        if (spoofingDetection.riskLevel === 'high') wouldBeAccepted = false;
        break;
      case 'high':
        wouldBeAccepted = locationValidation.checks.strictCheck && 
                          !spoofingDetection.isSuspicious &&
                          locationValidation.checks.validCoordinates;
        break;
      default:
        wouldBeAccepted = locationValidation.checks.basicRadiusCheck;
    }
    
    res.json({
      success: true,
      meeting: {
        title: meeting.title,
        location: meeting.location.name,
        address: meeting.location.address,
        coordinates: {
          latitude: meeting.location.latitude,
          longitude: meeting.location.longitude
        },
        radius: meeting.location.radius,
        strictness: meeting.attendanceConfig.verificationStrictness
      },
      yourLocation: {
        latitude,
        longitude,
        accuracy: accuracy || 100
      },
      validation: {
        wouldBeAccepted,
        distance: locationValidation.distance,
        withinRadius: locationValidation.isWithinRadius,
        confidenceScore: locationValidation.confidenceScore,
        checks: locationValidation.checks,
        spoofingDetection,
        messages: locationValidation.messages
      },
      recommendations: wouldBeAccepted ? 
        ['Your location is acceptable for attendance'] :
        [
          'Move closer to the meeting venue',
          'Enable high-accuracy GPS mode',
          'Ensure location services are enabled',
          'Contact organizer if you believe this is an error'
        ]
    });
    
  } catch (error) {
    console.error('Location test error:', error);
    res.status(500).json({ 
      error: 'Location test failed',
      details: 'Unable to verify location at this time'
    });
  }
});

// Add this route for real-time attendance monitoring

// Get live attendance feed (SSE - Server-Sent Events)
app.get('/api/meetings/:meetingId/live', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id
    });
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial data
    const initialData = {
      type: 'INIT',
      meeting: {
        id: meeting._id,
        title: meeting.title,
        status: meeting.status
      },
      timestamp: new Date().toISOString()
    };
    
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);
    
    // Set up interval to send updates
    const intervalId = setInterval(async () => {
      try {
        // Get latest attendance
        const recentAttendance = await AttendanceRecord.find({
          meetingId: meeting._id,
          createdAt: { $gte: new Date(Date.now() - 5 * 60000) } // Last 5 minutes
        })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('attendeeInfo.fullName verificationType status createdAt')
        .lean();
        
        // Get statistics
        const totalAttendees = await AttendanceRecord.countDocuments({
          meetingId: meeting._id
        });
        
        const activeAttendees = await AttendanceRecord.countDocuments({
          meetingId: meeting._id,
          status: { $in: ['pending', 'verified'] },
          'timeTracking.checkOutTime': { $exists: false }
        });
        
        const updateData = {
          type: 'UPDATE',
          recentAttendance,
          statistics: {
            totalAttendees,
            activeAttendees,
            timestamp: new Date().toISOString()
          }
        };
        
        res.write(`data: ${JSON.stringify(updateData)}\n\n`);
      } catch (error) {
        console.error('Live feed error:', error);
      }
    }, 10000); // Update every 10 seconds
    
    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(intervalId);
      console.log('Client disconnected from live feed');
    });
    
  } catch (error) {
    console.error('Live feed setup error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to setup live feed' });
    }
  }
});

// Add this helper function for geohash generation
const generateGeohash = (latitude, longitude, precision = 9) => {
  // Simple geohash implementation (in production, use a proper geohash library)
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let bits = 0;
  let bit = 0;
  
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  
  while (hash.length < precision) {
    if (bits % 2 === 0) {
      // Even bit: bisect longitude
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude < lonMid) {
        bit = bit << 1;
        lonMax = lonMid;
      } else {
        bit = (bit << 1) | 1;
        lonMin = lonMid;
      }
    } else {
      // Odd bit: bisect latitude
      const latMid = (latMin + latMax) / 2;
      if (latitude < latMid) {
        bit = bit << 1;
        latMax = latMid;
      } else {
        bit = (bit << 1) | 1;
        latMin = latMid;
      }
    }
    
    bits++;
    
    if (bits % 5 === 0) {
      hash += base32[bit];
      bit = 0;
    }
  }
  
  return hash;
};

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