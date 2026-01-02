// index.js - GSAMS (Geo-Secure Attendance Management System)
// Streamlined Production Backend

// ================= IMPORTS =================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const geolib = require('geolib');
const http = require('http');

// ================= INITIALIZE APP =================
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// ================= RATE LIMITING =================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ================= MIDDLEWARE =================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS Configuration
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// ================= DATABASE CONNECTION =================
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://prezent:prezent@prezent.pw70dzq.mongodb.net/prezent', {
  
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ================= DATABASE SCHEMAS =================
const Schema = mongoose.Schema;

// Organization Schema
const OrganizationSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  domain: { 
    type: String, 
    unique: true,
    lowercase: true,
    trim: true
  },
  logo: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },
  address: { type: String },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  settings: {
    defaultLocationRadius: { 
      type: Number, 
      default: 100,
      min: 10,
      max: 10000
    },
    defaultTimeWindow: { 
      type: Number, 
      default: 30,
      min: 1,
      max: 1440
    },
    allowSMS: { 
      type: Boolean, 
      default: true 
    },
    allowUSSD: { 
      type: Boolean, 
      default: true 
    },
    allowGPS: { 
      type: Boolean, 
      default: true 
    },
    allowKiosk: { 
      type: Boolean, 
      default: true 
    },
    allowManual: { 
      type: Boolean, 
      default: true 
    },
    timezone: { 
      type: String, 
      default: 'UTC' 
    },
    autoApproveConfidence: { 
      type: Number, 
      default: 80,
      min: 0,
      max: 100
    }
  },
  subscription: {
    plan: { 
      type: String, 
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    maxMeetings: { 
      type: Number, 
      default: 10 
    },
    maxAttendees: { 
      type: Number, 
      default: 1000 
    },
    features: {
      analytics: { type: Boolean, default: true },
      export: { type: Boolean, default: true },
      customForms: { type: Boolean, default: true },
      apiAccess: { type: Boolean, default: false }
    },
    expiresAt: { type: Date }
  }
});

// Admin User Schema
const AdminUserSchema = new Schema({
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true,
    index: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  fullName: { 
    type: String, 
    required: true,
    trim: true
  },
  phone: { 
    type: String,
    trim: true
  },
  avatar: { type: String },
  role: { 
    type: String, 
    enum: ['super_admin', 'admin', 'viewer', 'moderator'], 
    default: 'admin',
    index: true
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  lastLogin: { 
    type: Date 
  },
  lastActivity: { 
    type: Date,
    default: Date.now
  },
  loginAttempts: { 
    type: Number, 
    default: 0 
  },
  lockUntil: { 
    type: Date 
  },
  twoFactorEnabled: { 
    type: Boolean, 
    default: false 
  },
  twoFactorSecret: { 
    type: String 
  },
  resetPasswordToken: { 
    type: String 
  },
  resetPasswordExpires: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  permissions: {
    canCreateMeetings: { 
      type: Boolean, 
      default: true 
    },
    canEditMeetings: { 
      type: Boolean, 
      default: true 
    },
    canDeleteMeetings: { 
      type: Boolean, 
      default: false 
    },
    canViewReports: { 
      type: Boolean, 
      default: true 
    },
    canManageAdmins: { 
      type: Boolean, 
      default: false 
    },
    canApproveAttendance: { 
      type: Boolean, 
      default: true 
    },
    canExportData: { 
      type: Boolean, 
      default: true 
    },
    canAccessAnalytics: { 
      type: Boolean, 
      default: true 
    },
    canManageOrganization: { 
      type: Boolean, 
      default: false 
    }
  }
});

// Meeting Schema
const MeetingSchema = new Schema({
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true,
    index: true
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'AdminUser', 
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    index: true
  },
  description: { 
    type: String,
    trim: true
  },
  category: { 
    type: String,
    enum: ['training', 'conference', 'workshop', 'seminar', 'meeting', 'event', 'other'],
    default: 'meeting'
  },
  tags: [{ 
    type: String,
    trim: true
  }],
  location: {
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    latitude: { 
      type: Number, 
      required: true,
      min: -90,
      max: 90
    },
    longitude: { 
      type: Number, 
      required: true,
      min: -180,
      max: 180
    },
    address: { 
      type: String,
      trim: true
    },
    radius: { 
      type: Number, 
      default: 100,
      min: 10,
      max: 10000
    },
    geohash: { 
      type: String,
      index: true
    },
    floor: { 
      type: String 
    },
    room: { 
      type: String 
    }
  },
  schedule: {
    startTime: { 
      type: Date, 
      required: true,
      index: true
    },
    endTime: { 
      type: Date, 
      required: true 
    },
    attendanceStart: { 
      type: Date 
    },
    attendanceEnd: { 
      type: Date 
    },
    bufferBefore: { 
      type: Number, 
      default: 30,
      min: 0,
      max: 1440
    },
    bufferAfter: { 
      type: Number, 
      default: 30,
      min: 0,
      max: 1440
    },
    recurrence: {
      type: { 
        type: String, 
        enum: ['none', 'daily', 'weekly', 'monthly', 'custom'] 
      },
      interval: { 
        type: Number, 
        default: 1 
      },
      endDate: { 
        type: Date 
      },
      occurrences: { 
        type: Number 
      },
      daysOfWeek: [{ 
        type: Number,
        min: 0,
        max: 6
      }]
    }
  },
  attendanceConfig: {
    allowedModes: {
      smartphoneGPS: { 
        type: Boolean, 
        default: true 
      },
      sms: { 
        type: Boolean, 
        default: true 
      },
      ussd: { 
        type: Boolean, 
        default: true 
      },
      kiosk: { 
        type: Boolean, 
        default: true 
      },
      manual: { 
        type: Boolean, 
        default: true 
      }
    },
    requiredFields: [{
      field: { 
        type: String, 
        enum: ['fullName', 'phone', 'email', 'idNumber', 'organization', 'department'], 
        required: true 
      },
      isRequired: { 
        type: Boolean, 
        default: true 
      }
    }],
    verificationStrictness: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'strict'], 
      default: 'medium' 
    },
    duplicatePrevention: {
      preventSameDevice: { 
        type: Boolean, 
        default: true 
      },
      preventSamePhone: { 
        type: Boolean, 
        default: true 
      },
      preventSameNameTime: { 
        type: Boolean, 
        default: true 
      },
      preventSameIP: { 
        type: Boolean, 
        default: false 
      },
      timeWindowMinutes: { 
        type: Number, 
        default: 5,
        min: 1,
        max: 1440
      }
    },
    timeRequirement: {
      minimumMinutes: { 
        type: Number, 
        default: 15,
        min: 1,
        max: 1440
      },
      enableTimeTrack: { 
        type: Boolean, 
        default: false 
      },
      maxAbsenceMinutes: { 
        type: Number, 
        default: 5,
        min: 1,
        max: 1440
      }
    },
    autoApprove: {
      enabled: { 
        type: Boolean, 
        default: false 
      },
      confidenceThreshold: { 
        type: Number, 
        default: 80,
        min: 0,
        max: 100
      },
      afterMinutes: { 
        type: Number, 
        default: 5,
        min: 1,
        max: 1440
      }
    }
  },
  accessCodes: {
    publicCode: { 
      type: String, 
      unique: true,
      index: true
    },
    smsCode: { 
      type: String,
      index: true
    },
    ussdCode: { 
      type: String,
      index: true
    },
    adminCode: { 
      type: String 
    }
  },
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'active', 'in_progress', 'completed', 'cancelled', 'archived'], 
    default: 'draft',
    index: true
  },
  customFormFields: [{
    fieldName: { 
      type: String, 
      required: true,
      trim: true
    },
    fieldType: { 
      type: String, 
      enum: ['text', 'number', 'email', 'tel', 'select', 'checkbox', 'textarea', 'date', 'time'],
      default: 'text'
    },
    label: { 
      type: String, 
      required: true,
      trim: true
    },
    placeholder: { 
      type: String,
      trim: true
    },
    options: [{ 
      value: String, 
      label: String 
    }],
    isRequired: { 
      type: Boolean, 
      default: false 
    },
    validation: {
      minLength: { 
        type: Number,
        min: 1
      },
      maxLength: { 
        type: Number,
        min: 1
      },
      pattern: { 
        type: String 
      },
      minValue: { 
        type: Number 
      },
      maxValue: { 
        type: Number 
      }
    },
    order: { 
      type: Number, 
      default: 0 
    },
    visibility: {
      adminOnly: { 
        type: Boolean, 
        default: false 
      },
      showInReports: { 
        type: Boolean, 
        default: true 
      },
      showInExports: { 
        type: Boolean, 
        default: true 
      }
    }
  }],
  timeVerification: {
    requireMinimumStay: { 
      type: Boolean, 
      default: false 
    },
    minimumStayMinutes: { 
      type: Number, 
      default: 5,
      min: 1,
      max: 1440
    },
    enableContinuousMonitoring: { 
      type: Boolean, 
      default: false 
    },
    monitoringInterval: { 
      type: Number, 
      default: 5,
      min: 1,
      max: 60
    },
    maxAllowedAbsence: { 
      type: Number, 
      default: 2,
      min: 1,
      max: 1440
    },
    autoVerifyAfterStay: { 
      type: Boolean, 
      default: false 
    },
    autoVerifyMinutes: { 
      type: Number, 
      default: 10,
      min: 1,
      max: 1440
    }
  },
  shareLinks: {
    adminDashboard: { 
      type: String 
    },
    attendeeForm: { 
      type: String 
    },
    qrCodeUrl: { 
      type: String 
    },
    publicAttendanceLink: { 
      type: String 
    },
    embedCode: { 
      type: String 
    }
  },
  notifications: {
    sendReminders: { 
      type: Boolean, 
      default: true 
    },
    reminderMinutes: { 
      type: Number, 
      default: 60,
      min: 1,
      max: 10080
    },
    sendStartAlert: { 
      type: Boolean, 
      default: true 
    },
    sendSummary: { 
      type: Boolean, 
      default: true 
    },
    summaryRecipients: [{ 
      type: String 
    }]
  },
  attendanceCount: { 
    type: Number, 
    default: 0 
  },
  verifiedCount: { 
    type: Number, 
    default: 0 
  },
  pendingCount: { 
    type: Number, 
    default: 0 
  },
  maxAttendees: { 
    type: Number,
    min: 1
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  requiresApproval: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  deletedAt: { 
    type: Date 
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field for duration
MeetingSchema.virtual('duration').get(function() {
  if (this.schedule.startTime && this.schedule.endTime) {
    return (this.schedule.endTime - this.schedule.startTime) / (1000 * 60 * 60); // hours
  }
  return 0;
});

// Virtual field for isUpcoming
MeetingSchema.virtual('isUpcoming').get(function() {
  return this.status === 'scheduled' && this.schedule.startTime > new Date();
});

// Virtual field for isActiveNow
MeetingSchema.virtual('isActiveNow').get(function() {
  const now = new Date();
  return this.status === 'in_progress' || 
         (this.status === 'active' && 
          this.schedule.startTime <= now && 
          this.schedule.endTime >= now);
});

// Attendance Record Schema
const AttendanceRecordSchema = new Schema({
  meetingId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Meeting', 
    required: true,
    index: true
  },
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true,
    index: true
  },
  verificationType: { 
    type: String, 
    enum: ['smartphone_gps', 'sms', 'ussd', 'kiosk', 'manual', 'qr_scan', 'nfc', 'biometric'],
    required: true,
    index: true
  },
  attendeeInfo: {
    fullName: { 
      type: String, 
      required: true,
      trim: true,
      index: true
    },
    phone: { 
      type: String,
      trim: true,
      index: true
    },
    email: { 
      type: String,
      lowercase: true,
      trim: true,
      index: true
    },
    idNumber: { 
      type: String,
      trim: true,
      index: true
    },
    organization: { 
      type: String,
      trim: true
    },
    department: { 
      type: String,
      trim: true
    },
    position: { 
      type: String,
      trim: true
    },
    additionalFields: { 
      type: Map, 
      of: String 
    }
  },
  locationData: {
    coordinates: {
      latitude: { 
        type: Number,
        min: -90,
        max: 90
      },
      longitude: { 
        type: Number,
        min: -180,
        max: 180
      },
      accuracy: { 
        type: Number,
        min: 0
      },
      altitude: { 
        type: Number 
      },
      altitudeAccuracy: { 
        type: Number 
      },
      heading: { 
        type: Number,
        min: 0,
        max: 360
      },
      speed: { 
        type: Number,
        min: 0
      },
      timestamp: { 
        type: Date 
      },
      source: { 
        type: String,
        enum: ['gps', 'network', 'passive', 'fused']
      }
    },
    verifiedByAdminLocation: {
      latitude: { 
        type: Number,
        min: -90,
        max: 90
      },
      longitude: { 
        type: Number,
        min: -180,
        max: 180
      },
      accuracy: { 
        type: Number,
        min: 0
      },
      adminId: { 
        type: Schema.Types.ObjectId, 
        ref: 'AdminUser' 
      }
    },
    distanceFromVenue: { 
      type: Number,
      min: 0
    },
    address: { 
      type: String,
      trim: true
    },
    isWithinRadius: { 
      type: Boolean,
      default: false,
      index: true
    },
    validationDetails: {
      confidenceScore: { 
        type: Number,
        min: 0,
        max: 100
      },
      spoofingDetection: {
        isSuspicious: { 
          type: Boolean, 
          default: false 
        },
        warnings: [{ 
          type: String 
        }],
        riskLevel: { 
          type: String, 
          enum: ['low', 'medium', 'high'] 
        }
      },
      strictnessLevel: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'strict'] 
      }
    }
  },
  deviceInfo: {
    userAgent: { 
      type: String,
      trim: true
    },
    deviceId: { 
      type: String,
      index: true
    },
    platform: { 
      type: String 
    },
    os: { 
      type: String 
    },
    browser: { 
      type: String 
    },
    browserVersion: { 
      type: String 
    },
    screenResolution: { 
      type: String 
    },
    ipAddress: { 
      type: String,
      index: true
    },
    isMobile: { 
      type: Boolean 
    },
    isTablet: { 
      type: Boolean 
    },
    isDesktop: { 
      type: Boolean 
    },
    locationCapabilities: {
      hasGPS: { 
        type: Boolean, 
        default: false 
      },
      hasNetwork: { 
        type: Boolean, 
        default: false 
      },
      hasPassive: { 
        type: Boolean, 
        default: false 
      }
    }
  },
  verificationDetails: {
    confidenceScore: { 
      type: Number, 
      min: 0, 
      max: 100, 
      default: 0,
      index: true
    },
    verificationMethod: { 
      type: String 
    },
    verifiedByAdminId: { 
      type: Schema.Types.ObjectId, 
      ref: 'AdminUser',
      index: true
    },
    verificationTimestamp: { 
      type: Date 
    },
    manualVerificationReason: { 
      type: String 
    },
    timeVerified: { 
      type: Date 
    },
    timeVerifiedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'AdminUser' 
    },
    requiresTimeVerification: { 
      type: Boolean, 
      default: false 
    },
    minimumStayRequired: { 
      type: Number, 
      default: 0 
    },
    autoVerified: { 
      type: Boolean, 
      default: false 
    },
    autoVerifiedAt: { 
      type: Date 
    }
  },
  timeTracking: {
    checkInTime: { 
      type: Date, 
      required: true,
      index: true
    },
    checkOutTime: { 
      type: Date,
      index: true
    },
    totalDuration: { 
      type: Number,
      min: 0
    },
    meetsTimeRequirement: { 
      type: Boolean, 
      default: false 
    },
    meetsMinimumStay: { 
      type: Boolean, 
      default: false 
    }
  },
  status: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected', 'flagged', 'needs_review', 'auto_verified'], 
    default: 'pending',
    index: true
  },
  flags: [{
    type: { 
      type: String, 
      enum: ['duplicate', 'suspicious_location', 'time_shortage', 'manual_review', 'system'] 
    },
    reason: { 
      type: String 
    },
    flaggedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'AdminUser' 
    },
    flaggedAt: { 
      type: Date, 
      default: Date.now 
    },
    resolved: { 
      type: Boolean, 
      default: false 
    },
    resolvedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'AdminUser' 
    },
    resolvedAt: { 
      type: Date 
    },
    resolutionNotes: { 
      type: String 
    }
  }],
  auditTrail: [{
    action: { 
      type: String, 
      required: true 
    },
    performedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'AdminUser' 
    },
    performedByName: { 
      type: String 
    },
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
    notes: { 
      type: String 
    },
    changes: { 
      type: Map, 
      of: Schema.Types.Mixed 
    },
    ipAddress: { 
      type: String 
    },
    userAgent: { 
      type: String 
    }
  }],
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  deletedAt: { 
    type: Date 
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
AttendanceRecordSchema.index({ meetingId: 1, status: 1 });
AttendanceRecordSchema.index({ organizationId: 1, createdAt: -1 });
AttendanceRecordSchema.index({ 'attendeeInfo.phone': 1, meetingId: 1 });
AttendanceRecordSchema.index({ 'deviceInfo.deviceId': 1, meetingId: 1 });
AttendanceRecordSchema.index({ checkInTime: -1 });
AttendanceRecordSchema.index({ 'locationData.isWithinRadius': 1 });

// Audit Log Schema
const AuditLogSchema = new Schema({
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true,
    index: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'AdminUser',
    index: true
  },
  userEmail: { 
    type: String,
    index: true
  },
  userRole: { 
    type: String,
    index: true
  },
  action: { 
    type: String, 
    required: true,
    index: true
  },
  entityType: { 
    type: String,
    index: true
  },
  entityId: { 
    type: Schema.Types.ObjectId,
    index: true
  },
  entityName: { 
    type: String 
  },
  details: { 
    type: Map, 
    of: Schema.Types.Mixed 
  },
  ipAddress: { 
    type: String,
    index: true
  },
  userAgent: { 
    type: String 
  },
  location: {
    country: { 
      type: String 
    },
    region: { 
      type: String 
    },
    city: { 
      type: String 
    },
    timezone: { 
      type: String 
    }
  },
  severity: { 
    type: String, 
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },
  source: { 
    type: String,
    enum: ['api', 'web', 'mobile', 'system', 'cron'],
    default: 'api'
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  acknowledged: { 
    type: Boolean, 
    default: false 
  },
  acknowledgedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'AdminUser' 
  },
  acknowledgedAt: { 
    type: Date 
  },
  metadata: { 
    type: Map, 
    of: Schema.Types.Mixed 
  }
});

// Notification Schema
const NotificationSchema = new Schema({
  organizationId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true,
    index: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'AdminUser',
    index: true
  },
  meetingId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Meeting',
    index: true
  },
  type: { 
    type: String, 
    enum: ['attendance', 'meeting', 'system', 'alert', 'reminder'],
    required: true,
    index: true
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  data: { 
    type: Map, 
    of: Schema.Types.Mixed 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  read: { 
    type: Boolean, 
    default: false,
    index: true
  },
  readAt: { 
    type: Date 
  },
  actionUrl: { 
    type: String 
  },
  actionLabel: { 
    type: String 
  },
  expiresAt: { 
    type: Date 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// ================= CREATE MODELS =================
const Organization = mongoose.model('Organization', OrganizationSchema);
const AdminUser = mongoose.model('AdminUser', AdminUserSchema);
const Meeting = mongoose.model('Meeting', MeetingSchema);
const AttendanceRecord = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// ================= HELPER FUNCTIONS =================

/**
 * Generate unique access codes
 */
const generateAccessCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Calculate distance between two coordinates in meters
 * Uses Haversine formula
 */
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

/**
 * Enhanced location validation with multiple checks
 */
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
      strictCheck: distance <= Math.max(radius - 10, radius * 0.9),
      
      // Verify coordinates are valid
      validCoordinates: 
        userLat >= -90 && userLat <= 90 && 
        userLon >= -180 && userLon <= 180 &&
        userLat !== 0 && userLon !== 0,
      
      // Check for suspicious patterns
      notSameAsPrevious: true,
      notMockedLocation: userAccuracy < 1000,
      
      // Time-based validation
      isRecent: true
    },
    
    // Confidence scoring
    confidenceScore: calculateLocationConfidence(distance, radius, userAccuracy),
    
    // Detailed messages
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

/**
 * Calculate location confidence score
 */
const calculateLocationConfidence = (distance, radius, accuracy) => {
  let score = 100;
  
  // Penalize for distance from center
  if (distance > radius * 0.5) score -= 20;
  if (distance > radius * 0.8) score -= 30;
  
  // Penalize for poor accuracy
  if (accuracy > 50) score -= 10;
  if (accuracy > 100) score -= 20;
  if (accuracy > 200) score -= 30;
  
  // Bonus for excellent accuracy
  if (accuracy < 10) score += 10;
  if (accuracy < 5) score += 15;
  
  return Math.max(0, Math.min(100, score));
};

/**
 * Detect potential location spoofing
 */
const detectLocationSpoofing = (locationData, previousLocations = []) => {
  const warnings = [];
  
  // Check for unrealistic accuracy
  if (locationData.accuracy < 1) {
    warnings.push('Unusually high accuracy detected');
  }
  
  // Check for unrealistic speed
  if (locationData.speed && locationData.speed > 100) {
    warnings.push('Unrealistic movement speed detected');
  }
  
  // Check for altitude anomalies
  if (locationData.altitude && Math.abs(locationData.altitude) > 10000) {
    warnings.push('Unrealistic altitude detected');
  }
  
  // Check for consistent coordinates
  if (previousLocations.length >= 3) {
    const recentLocations = previousLocations.slice(-3);
    const allSame = recentLocations.every(loc => 
      Math.abs(loc.latitude - locationData.latitude) < 0.0001 &&
      Math.abs(loc.longitude - locationData.longitude) < 0.0001
    );
    
    if (allSame) {
      warnings.push('No location movement detected');
    }
  }
  
  // Check for common mock location patterns
  const commonMockCoordinates = [
    { lat: 37.4219983, lon: -122.084 },
    { lat: 37.3349, lon: -122.009 },
    { lat: 37.7749, lon: -122.4194 },
    { lat: 40.7128, lon: -74.0060 },
    { lat: 51.5074, lon: -0.1278 },
    { lat: 0, lon: 0 },
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

/**
 * Calculate overall confidence score
 */
const calculateConfidenceScore = (verificationType, locationData, meetingConfig) => {
  let score = 0;
  
  switch(verificationType) {
    case 'smartphone_gps':
      score = 90;
      if (locationData.accuracy < 10) score += 5;
      if (locationData.accuracy < 5) score += 5;
      break;
    case 'manual':
      score = 95;
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

/**
 * Generate meeting QR code
 */
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

/**
 * Generate meeting links
 */
const generateMeetingLinks = (meetingId, publicCode) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://gsf-inky.vercel.app';
  return {
    adminDashboard: `${baseUrl}/admin/meetings/${meetingId}`,
    attendeeForm: `${baseUrl}/attend/${publicCode}`,
    qrCodeUrl: `${baseUrl}/api/meetings/${meetingId}/qrcode`,
    publicAttendanceLink: `${baseUrl}/attend/${publicCode}/form`
  };
};

/**
 * Generate geohash for location
 */
const generateGeohash = (latitude, longitude, precision = 9) => {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let bits = 0;
  let bit = 0;
  
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;
  
  while (hash.length < precision) {
    if (bits % 2 === 0) {
      const lonMid = (lonMin + lonMax) / 2;
      if (longitude < lonMid) {
        bit = bit << 1;
        lonMax = lonMid;
      } else {
        bit = (bit << 1) | 1;
        lonMin = lonMid;
      }
    } else {
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

/**
 * Send notification to admin
 */
const sendNotification = async (userId, title, message, data = {}, type = 'system') => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      data,
      type,
      organizationId: data.organizationId
    });
    
    return notification;
  } catch (error) {
    console.error('Notification error:', error);
  }
};

/**
 * Generate attendance PDF
 */
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

/**
 * Generate attendance Excel
 */
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
  const headers = [
    'Full Name', 'Phone', 'Email', 'ID Number', 'Verification Method',
    'Check-in Time', 'Check-out Time', 'Duration (min)', 'Status',
    'Confidence Score', 'Location', 'Distance from Venue (m)'
  ];
  
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
  
  // Add attendance records
  records.forEach((record, index) => {
    const row = headerRow + index + 1;
    
    const rowData = [
      record.attendeeInfo.fullName,
      record.attendeeInfo.phone,
      record.attendeeInfo.email,
      record.attendeeInfo.idNumber,
      record.verificationType.replace('_', ' ').toUpperCase(),
      moment(record.timeTracking.checkInTime).format('YYYY-MM-DD HH:mm:ss'),
      record.timeTracking.checkOutTime ? 
        moment(record.timeTracking.checkOutTime).format('YYYY-MM-DD HH:mm:ss') : '',
      record.timeTracking.totalDuration || '',
      record.status.toUpperCase(),
      record.verificationDetails.confidenceScore,
      record.locationData.address || 
        `${record.locationData.coordinates?.latitude}, ${record.locationData.coordinates?.longitude}`,
      record.locationData.distanceFromVenue || ''
    ];
    
    rowData.forEach((value, colIndex) => {
      worksheet.getCell(row, colIndex + 1).value = value;
    });
    
    // Color code status
    const statusCell = worksheet.getCell(row, 9);
    const statusColors = {
      'verified': 'FFC6EFCE',
      'pending': 'FFFFEB9C',
      'rejected': 'FFFFC7CE',
      'flagged': 'FFFFE699',
      'auto_verified': 'FFD9EAD3'
    };
    
    statusCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: statusColors[record.status] || 'FFFFFFFF' }
    };
    
    // Add borders
    for (let i = 1; i <= headers.length; i++) {
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

// ================= AUTHENTICATION MIDDLEWARE =================

/**
 * Verify JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.user = await AdminUser.findById(decoded.userId)
      .populate('organizationId')
      .select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret');
    
    if (!req.user) {
      return res.status(401).json({ 
        error: 'User account not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!req.user.isActive) {
      return res.status(401).json({ 
        error: 'User account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    
    // Update last activity
    req.user.lastActivity = new Date();
    await req.user.save();
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Check if user is super admin
 */
const isSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }
  next();
};

/**
 * Check permissions middleware
 */
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') {
      return next();
    }
    
    if (!req.user.permissions[permission]) {
      return res.status(403).json({ 
        error: `Permission denied: ${permission}`,
        code: 'PERMISSION_DENIED'
      });
    }
    
    next();
  };
};

// ================= ROUTES =================

// ================= AUTHENTICATION ROUTES =================

/**
 * @route POST /api/auth/register
 * @desc Register new organization and super admin
 * @access Public
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, organizationName, contactEmail, contactPhone, address } = req.body;
    
    // Validation
    if (!email || !password || !fullName || !organizationName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'fullName', 'organizationName']
      });
    }
    
    // Check if user already exists
    const existingUser = await AdminUser.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }
    
    // Create organization
    const organization = await Organization.create({
      name: organizationName,
      domain: email.split('@')[1],
      contactEmail: contactEmail || email,
      contactPhone,
      address
    });
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
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
        canApproveAttendance: true,
        canExportData: true,
        canAccessAnalytics: true,
        canManageOrganization: true
      }
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role, 
        organizationId: organization._id,
        email: user.email
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );
    
    // Create audit log
    await AuditLog.create({
      organizationId: organization._id,
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_REGISTERED',
      entityType: 'organization',
      entityId: organization._id,
      entityName: organization.name,
      details: {
        email,
        organizationName,
        plan: 'free'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    // Send welcome notification
    await sendNotification(
      user._id,
      'Welcome to GSAMS!',
      `Your organization "${organizationName}" has been successfully registered.`,
      {
        organizationId: organization._id,
        organizationName
      },
      'system'
    );
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions
      },
      organization: {
        id: organization._id,
        name: organization.name,
        domain: organization.domain,
        settings: organization.settings,
        subscription: organization.subscription
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Organization or user already exists',
        code: 'DUPLICATE_ENTRY'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Registration failed',
      code: 'REGISTRATION_FAILED'
    });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // Find user
    const user = await AdminUser.findOne({ email })
      .populate('organizationId')
      .select('+password +loginAttempts +lockUntil');
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const lockMinutes = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      return res.status(423).json({ 
        error: `Account is locked. Try again in ${lockMinutes} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockMinutes
      });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ 
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Increment login attempts
      user.loginAttempts += 1;
      
      // Lock account after 5 failed attempts for 15 minutes
      if (user.loginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
        user.loginAttempts = 0;
      }
      
      await user.save();
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        attemptsRemaining: 5 - user.loginAttempts
      });
    }
    
    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    user.lastActivity = new Date();
    await user.save();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role, 
        organizationId: user.organizationId._id,
        email: user.email
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );
    
    // Create audit log
    await AuditLog.create({
      organizationId: user.organizationId._id,
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user._id,
      entityName: user.fullName,
      details: {
        loginMethod: 'email',
        ipAddress: req.ip
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        permissions: user.permissions,
        lastLogin: user.lastLogin
      },
      organization: {
        id: user.organizationId._id,
        name: user.organizationId.name,
        domain: user.organizationId.domain,
        settings: user.organizationId.settings,
        subscription: user.organizationId.subscription
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      code: 'LOGIN_FAILED'
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await AdminUser.findById(req.user._id)
      .populate('organizationId')
      .select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret');
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        lastActivity: user.lastActivity,
        permissions: user.permissions,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      organization: {
        id: user.organizationId._id,
        name: user.organizationId.name,
        domain: user.organizationId.domain,
        contactEmail: user.organizationId.contactEmail,
        contactPhone: user.organizationId.contactPhone,
        address: user.organizationId.address,
        settings: user.organizationId.settings,
        subscription: user.organizationId.subscription,
        createdAt: user.organizationId.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to get profile',
      code: 'PROFILE_FETCH_FAILED'
    });
  }
});

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, phone, avatar } = req.body;
    
    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (avatar !== undefined) updates.avatar = avatar;
    
    const user = await AdminUser.findByIdAndUpdate(
      req.user._id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret');
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'PROFILE_UPDATED',
      entityType: 'user',
      entityId: user._id,
      entityName: user.fullName,
      details: updates,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
});

/**
 * @route POST /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'New password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    const user = await AdminUser.findById(req.user._id).select('+password');
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Current password is incorrect',
        code: 'INCORRECT_PASSWORD'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.updatedAt = new Date();
    await user.save();
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'user',
      entityId: user._id,
      entityName: user.fullName,
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      error: 'Failed to change password',
      code: 'PASSWORD_CHANGE_FAILED'
    });
  }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required',
        code: 'EMAIL_REQUIRED'
      });
    }
    
    const user = await AdminUser.findOne({ email });
    if (!user) {
      // Don't reveal that user doesn't exist
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();
    
    // In production, send email with reset link
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    console.log('Password reset URL:', resetUrl); // For development
    
    // Create audit log
    await AuditLog.create({
      organizationId: user.organizationId,
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'user',
      entityId: user._id,
      entityName: user.fullName,
      details: { resetToken: resetTokenHash },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      error: 'Failed to process password reset request',
      code: 'PASSWORD_RESET_FAILED'
    });
  }
});

/**
 * @route POST /api/auth/reset-password/:token
 * @desc Reset password with token
 * @access Public
 */
app.post('/api/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // Hash the token
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid reset token
    const user = await AdminUser.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.updatedAt = new Date();
    await user.save();
    
    // Create audit log
    await AuditLog.create({
      organizationId: user.organizationId,
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'user',
      entityId: user._id,
      entityName: user.fullName,
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      error: 'Failed to reset password',
      code: 'PASSWORD_RESET_FAILED'
    });
  }
});

// ================= ORGANIZATION ROUTES =================

/**
 * @route GET /api/organization
 * @desc Get organization details
 * @access Private
 */
app.get('/api/organization', authenticateToken, async (req, res) => {
  try {
    const organization = await Organization.findById(req.user.organizationId._id);
    
    res.json({
      success: true,
      organization
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch organization',
      code: 'ORGANIZATION_FETCH_FAILED'
    });
  }
});

/**
 * @route PUT /api/organization
 * @desc Update organization details
 * @access Private (Super Admin or canManageOrganization permission)
 */
app.put('/api/organization', authenticateToken, checkPermission('canManageOrganization'), async (req, res) => {
  try {
    const { name, contactEmail, contactPhone, address, settings } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail;
    if (contactPhone !== undefined) updates.contactPhone = contactPhone;
    if (address !== undefined) updates.address = address;
    if (settings !== undefined) updates.settings = { ...req.user.organizationId.settings, ...settings };
    
    const organization = await Organization.findByIdAndUpdate(
      req.user.organizationId._id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    // Create audit log
    await AuditLog.create({
      organizationId: organization._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'ORGANIZATION_UPDATED',
      entityType: 'organization',
      entityId: organization._id,
      entityName: organization.name,
      details: updates,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      organization
    });
  } catch (error) {
    console.error('Update organization error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update organization',
      code: 'ORGANIZATION_UPDATE_FAILED'
    });
  }
});

/**
 * @route GET /api/organization/stats
 * @desc Get organization statistics
 * @access Private
 */
app.get('/api/organization/stats', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get counts using aggregation
    const stats = await Promise.all([
      // Total meetings
      Meeting.countDocuments({ 
        organizationId: req.user.organizationId._id,
        deletedAt: null 
      }),
      
      // Active meetings
      Meeting.countDocuments({ 
        organizationId: req.user.organizationId._id,
        status: 'in_progress',
        deletedAt: null 
      }),
      
      // Upcoming meetings
      Meeting.countDocuments({ 
        organizationId: req.user.organizationId._id,
        status: { $in: ['draft', 'scheduled', 'active'] },
        'schedule.startTime': { $gt: now },
        deletedAt: null 
      }),
      
      // Total attendance (last 30 days)
      AttendanceRecord.countDocuments({ 
        organizationId: req.user.organizationId._id,
        createdAt: { $gte: thirtyDaysAgo },
        deletedAt: null 
      }),
      
      // Today's attendance
      AttendanceRecord.countDocuments({ 
        organizationId: req.user.organizationId._id,
        createdAt: { 
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999))
        },
        deletedAt: null 
      }),
      
      // Attendance by type
      AttendanceRecord.aggregate([
        {
          $match: {
            organizationId: req.user.organizationId._id,
            createdAt: { $gte: thirtyDaysAgo },
            deletedAt: null
          }
        },
        {
          $group: {
            _id: '$verificationType',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Recent activity
      AuditLog.find({
        organizationId: req.user.organizationId._id
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'fullName email')
      .lean()
    ]);
    
    const [totalMeetings, activeMeetings, upcomingMeetings, totalAttendance, todayAttendance, byType, recentActivity] = stats;
    
    res.json({
      success: true,
      stats: {
        totalMeetings,
        activeMeetings,
        upcomingMeetings,
        totalAttendance,
        todayAttendance,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentActivity
      }
    });
  } catch (error) {
    console.error('Get organization stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch organization statistics',
      code: 'STATS_FETCH_FAILED'
    });
  }
});

// ================= MEETING ROUTES =================

/**
 * @route POST /api/meetings
 * @desc Create a new meeting
 * @access Private (canCreateMeetings permission)
 */
app.post('/api/meetings', authenticateToken, checkPermission('canCreateMeetings'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      tags,
      location,
      schedule,
      attendanceConfig,
      customFormFields,
      timeVerification,
      notifications,
      maxAttendees,
      isPrivate,
      requiresApproval
    } = req.body;

    // Validation
    if (!title || !location || !schedule || !schedule.startTime || !schedule.endTime) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'location', 'schedule.startTime', 'schedule.endTime'],
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate location
    if (!location.latitude || !location.longitude) {
      return res.status(400).json({ 
        error: 'Location coordinates are required',
        code: 'LOCATION_COORDINATES_REQUIRED'
      });
    }

    if (location.latitude < -90 || location.latitude > 90 || 
        location.longitude < -180 || location.longitude > 180) {
      return res.status(400).json({ 
        error: 'Invalid coordinates',
        code: 'INVALID_COORDINATES'
      });
    }

    // Validate radius
    const radius = location.radius || req.user.organizationId.settings.defaultLocationRadius;
    if (radius < 10 || radius > 10000) {
      return res.status(400).json({ 
        error: 'Radius must be between 10 and 10,000 meters',
        code: 'INVALID_RADIUS'
      });
    }

    // Validate time
    const startTime = new Date(schedule.startTime);
    const endTime = new Date(schedule.endTime);
    
    if (startTime >= endTime) {
      return res.status(400).json({ 
        error: 'Start time must be before end time',
        code: 'INVALID_TIME_RANGE'
      });
    }

    // Check for overlapping meetings at same location
    const overlappingMeetings = await Meeting.find({
      organizationId: req.user.organizationId._id,
      status: { $in: ['scheduled', 'active', 'in_progress'] },
      'schedule.startTime': { $lt: endTime },
      'schedule.endTime': { $gt: startTime },
      'location.latitude': { $gte: location.latitude - 0.001, $lte: location.latitude + 0.001 },
      'location.longitude': { $gte: location.longitude - 0.001, $lte: location.longitude + 0.001 },
      deletedAt: null
    });

    if (overlappingMeetings.length > 0) {
      return res.status(409).json({
        error: 'Location conflict detected',
        details: 'Another meeting is scheduled at a nearby location around the same time',
        conflicts: overlappingMeetings.map(m => ({
          id: m._id,
          title: m.title,
          time: moment(m.schedule.startTime).format('h:mm A'),
          location: m.location.name
        })),
        code: 'LOCATION_CONFLICT'
      });
    }

    // Check organization limits
    const meetingCount = await Meeting.countDocuments({
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });

    const maxMeetings = req.user.organizationId.subscription?.maxMeetings || 10;
    if (meetingCount >= maxMeetings) {
      return res.status(403).json({
        error: 'Meeting limit reached',
        details: `Maximum ${maxMeetings} meetings allowed on your plan`,
        current: meetingCount,
        max: maxMeetings,
        code: 'MEETING_LIMIT_REACHED'
      });
    }

    // Generate unique codes
    let publicCode, smsCode, ussdCode;
    let codesAreUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!codesAreUnique && attempts < maxAttempts) {
      publicCode = generateAccessCode(8);
      smsCode = `MTG-${generateAccessCode(4)}`;
      ussdCode = generateAccessCode(6);

      // Check if codes are unique
      const existingCodes = await Meeting.find({
        $or: [
          { 'accessCodes.publicCode': publicCode },
          { 'accessCodes.smsCode': smsCode },
          { 'accessCodes.ussdCode': ussdCode }
        ]
      });

      if (existingCodes.length === 0) {
        codesAreUnique = true;
      }
      attempts++;
    }

    if (!codesAreUnique) {
      return res.status(500).json({
        error: 'Failed to generate unique access codes',
        code: 'CODE_GENERATION_FAILED'
      });
    }

    // Generate geohash
    const geohash = generateGeohash(location.latitude, location.longitude);

    // Create meeting
    const meetingData = {
      organizationId: req.user.organizationId._id,
      createdBy: req.user._id,
      title,
      description,
      category: category || 'meeting',
      tags: tags || [],
      location: {
        ...location,
        radius,
        geohash
      },
      schedule: {
        startTime,
        endTime,
        attendanceStart: schedule.attendanceStart || 
          new Date(startTime.getTime() - (schedule.bufferBefore || 30) * 60000),
        attendanceEnd: schedule.attendanceEnd || 
          new Date(endTime.getTime() + (schedule.bufferAfter || 30) * 60000),
        bufferBefore: schedule.bufferBefore || 30,
        bufferAfter: schedule.bufferAfter || 30,
        recurrence: schedule.recurrence || { type: 'none' }
      },
      attendanceConfig: {
        allowedModes: {
          smartphoneGPS: attendanceConfig?.allowedModes?.smartphoneGPS ?? req.user.organizationId.settings.allowGPS,
          sms: attendanceConfig?.allowedModes?.sms ?? req.user.organizationId.settings.allowSMS,
          ussd: attendanceConfig?.allowedModes?.ussd ?? req.user.organizationId.settings.allowUSSD,
          kiosk: attendanceConfig?.allowedModes?.kiosk ?? req.user.organizationId.settings.allowKiosk,
          manual: attendanceConfig?.allowedModes?.manual ?? req.user.organizationId.settings.allowManual
        },
        requiredFields: attendanceConfig?.requiredFields || [{ field: 'fullName', isRequired: true }],
        verificationStrictness: attendanceConfig?.verificationStrictness || 'medium',
        duplicatePrevention: {
          preventSameDevice: attendanceConfig?.duplicatePrevention?.preventSameDevice ?? true,
          preventSamePhone: attendanceConfig?.duplicatePrevention?.preventSamePhone ?? true,
          preventSameNameTime: attendanceConfig?.duplicatePrevention?.preventSameNameTime ?? true,
          preventSameIP: attendanceConfig?.duplicatePrevention?.preventSameIP ?? false,
          timeWindowMinutes: attendanceConfig?.duplicatePrevention?.timeWindowMinutes || 5
        },
        timeRequirement: {
          minimumMinutes: attendanceConfig?.timeRequirement?.minimumMinutes || 15,
          enableTimeTrack: attendanceConfig?.timeRequirement?.enableTimeTrack || false,
          maxAbsenceMinutes: attendanceConfig?.timeRequirement?.maxAbsenceMinutes || 5
        },
        autoApprove: {
          enabled: attendanceConfig?.autoApprove?.enabled || false,
          confidenceThreshold: attendanceConfig?.autoApprove?.confidenceThreshold || 80,
          afterMinutes: attendanceConfig?.autoApprove?.afterMinutes || 5
        }
      },
      accessCodes: {
        publicCode,
        smsCode,
        ussdCode,
        adminCode: generateAccessCode(10)
      },
      customFormFields: customFormFields || [],
      timeVerification: timeVerification || {
        requireMinimumStay: false,
        minimumStayMinutes: 5,
        enableContinuousMonitoring: false,
        monitoringInterval: 5,
        maxAllowedAbsence: 2,
        autoVerifyAfterStay: false,
        autoVerifyMinutes: 10
      },
      notifications: notifications || {
        sendReminders: true,
        reminderMinutes: 60,
        sendStartAlert: true,
        sendSummary: true,
        summaryRecipients: [req.user.email]
      },
      maxAttendees: maxAttendees || null,
      isPrivate: isPrivate || false,
      requiresApproval: requiresApproval || false,
      status: 'draft'
    };

    const meeting = await Meeting.create(meetingData);

    // Generate QR code
    const qrCode = await generateMeetingQRCode(publicCode);
    
    // Generate meeting links
    const links = generateMeetingLinks(meeting._id, publicCode);
    
    // Update meeting with links
    meeting.shareLinks = links;
    await meeting.save();

    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'MEETING_CREATED',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: {
        title,
        publicCode,
        location: meeting.location.name,
        startTime: meeting.schedule.startTime,
        attendeesExpected: maxAttendees
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });

    // Send notification to organization admins
    const admins = await AdminUser.find({
      organizationId: req.user.organizationId._id,
      isActive: true,
      'permissions.canViewReports': true
    });

    for (const admin of admins) {
      if (admin._id.toString() !== req.user._id.toString()) {
        await sendNotification(
          admin._id,
          'New Meeting Created',
          `${req.user.fullName} created a new meeting: "${meeting.title}"`,
          {
            meetingId: meeting._id,
            meetingTitle: meeting.title,
            createdBy: req.user.fullName,
            startTime: meeting.schedule.startTime,
            organizationId: req.user.organizationId._id
          },
          'meeting'
        );
      }
    }

    res.status(201).json({
      success: true,
      meeting: {
        ...meeting.toObject(),
        qrCode,
        links,
        createdBy: {
          id: req.user._id,
          fullName: req.user.fullName,
          email: req.user.email
        }
      }
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'Duplicate access code detected',
        code: 'DUPLICATE_CODE'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create meeting',
      code: 'MEETING_CREATION_FAILED'
    });
  }
});

/**
 * @route GET /api/meetings
 * @desc Get all meetings for organization
 * @access Private
 */
app.get('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      startDate, 
      endDate, 
      category, 
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'schedule.startTime',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {
      organizationId: req.user.organizationId._id,
      deletedAt: null
    };
    
    // Apply filters
    if (status) {
      if (status === 'upcoming') {
        query.status = { $in: ['draft', 'scheduled', 'active'] };
        query['schedule.startTime'] = { $gt: new Date() };
      } else if (status === 'past') {
        query['schedule.endTime'] = { $lt: new Date() };
      } else if (status === 'active_now') {
        const now = new Date();
        query.$or = [
          { status: 'in_progress' },
          { 
            status: 'active',
            'schedule.startTime': { $lte: now },
            'schedule.endTime': { $gte: now }
          }
        ];
      } else {
        query.status = status;
      }
    }
    
    if (startDate && endDate) {
      query['schedule.startTime'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get meetings with pagination
    const meetings = await Meeting.find(query)
      .populate('createdBy', 'fullName email avatar')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get total count
    const total = await Meeting.countDocuments(query);
    
    // Enrich with attendance counts
    for (const meeting of meetings) {
      const attendanceCounts = await AttendanceRecord.aggregate([
        {
          $match: { 
            meetingId: meeting._id,
            deletedAt: null
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      meeting.attendanceSummary = {
        total: attendanceCounts.reduce((sum, item) => sum + item.count, 0),
        verified: attendanceCounts.find(item => item._id === 'verified')?.count || 0,
        pending: attendanceCounts.find(item => item._id === 'pending')?.count || 0,
        flagged: attendanceCounts.find(item => item._id === 'flagged')?.count || 0
      };
      
      // Add virtual fields
      meeting.isUpcoming = meeting.status === 'scheduled' && new Date(meeting.schedule.startTime) > new Date();
      meeting.isActiveNow = meeting.status === 'in_progress' || 
        (meeting.status === 'active' && 
         new Date(meeting.schedule.startTime) <= new Date() && 
         new Date(meeting.schedule.endTime) >= new Date());
    }
    
    res.json({
      success: true,
      meetings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch meetings',
      code: 'MEETINGS_FETCH_FAILED'
    });
  }
});

/**
 * @route GET /api/meetings/:meetingId
 * @desc Get meeting details
 * @access Private
 */
app.get('/api/meetings/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    })
    .populate('createdBy', 'fullName email avatar')
    .lean();
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    // Get attendance statistics
    const attendanceStats = await AttendanceRecord.aggregate([
      {
        $match: { 
          meetingId: meeting._id,
          deletedAt: null
        }
      },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$verificationType',
                count: { $sum: 1 }
              }
            }
          ],
          recent: [
            {
              $sort: { createdAt: -1 }
            },
            {
              $limit: 10
            },
            {
              $project: {
                'attendeeInfo.fullName': 1,
                'attendeeInfo.phone': 1,
                verificationType: 1,
                status: 1,
                createdAt: 1
              }
            }
          ]
        }
      }
    ]);
    
    // Generate QR code
    const qrCode = await generateMeetingQRCode(meeting.accessCodes.publicCode);
    
    // Generate meeting links
    const links = generateMeetingLinks(meeting._id, meeting.accessCodes.publicCode);
    
    res.json({
      success: true,
      meeting: {
        ...meeting,
        qrCode,
        links,
        statistics: {
          attendanceByStatus: attendanceStats[0].byStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          attendanceByType: attendanceStats[0].byType.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
          recentAttendance: attendanceStats[0].recent,
          totalAttendees: attendanceStats[0].byStatus.reduce((sum, item) => sum + item.count, 0)
        }
      }
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch meeting',
      code: 'MEETING_FETCH_FAILED'
    });
  }
});

/**
 * @route PUT /api/meetings/:meetingId
 * @desc Update meeting
 * @access Private (canEditMeetings permission)
 */
app.put('/api/meetings/:meetingId', authenticateToken, checkPermission('canEditMeetings'), async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    // Check if meeting can be edited
    if (meeting.status === 'completed' || meeting.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'Cannot edit completed or cancelled meetings',
        code: 'MEETING_NOT_EDITABLE'
      });
    }
    
    const oldMeeting = { ...meeting.toObject() };
    
    // Update fields
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'organizationId' && key !== 'createdBy' && key !== 'accessCodes') {
        if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
          meeting[key] = { ...meeting[key], ...updates[key] };
        } else {
          meeting[key] = updates[key];
        }
      }
    });
    
    meeting.updatedAt = new Date();
    await meeting.save();
    
    // Create audit log
    const changes = {};
    Object.keys(updates).forEach(key => {
      if (oldMeeting[key] !== meeting[key]) {
        changes[key] = {
          old: oldMeeting[key],
          new: meeting[key]
        };
      }
    });
    
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'MEETING_UPDATED',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: changes,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      meeting,
      changes
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update meeting',
      code: 'MEETING_UPDATE_FAILED'
    });
  }
});

/**
 * @route DELETE /api/meetings/:meetingId
 * @desc Delete meeting
 * @access Private (canDeleteMeetings permission)
 */
app.delete('/api/meetings/:meetingId', authenticateToken, checkPermission('canDeleteMeetings'), async (req, res) => {
  try {
    const { hardDelete, deleteAttendance } = req.query;
    
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    // Check if meeting has attendance records
    const attendanceCount = await AttendanceRecord.countDocuments({
      meetingId: meeting._id,
      deletedAt: null
    });
    
    if (attendanceCount > 0 && hardDelete !== 'true') {
      return res.status(400).json({
        error: 'Meeting has attendance records. Use hardDelete=true to delete anyway.',
        attendanceCount,
        code: 'MEETING_HAS_ATTENDANCE'
      });
    }
    
    if (hardDelete === 'true') {
      // Hard delete - permanently remove
      await Meeting.deleteOne({ _id: meeting._id });
      
      if (deleteAttendance === 'true') {
        await AttendanceRecord.deleteMany({ meetingId: meeting._id });
      } else {
        // Soft delete related records
        await AttendanceRecord.updateMany(
          { meetingId: meeting._id },
          { deletedAt: new Date() }
        );
      }
    } else {
      // Soft delete - mark as deleted
      meeting.deletedAt = new Date();
      meeting.status = 'cancelled';
      await meeting.save();
    }
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: hardDelete === 'true' ? 'MEETING_DELETED_PERMANENTLY' : 'MEETING_DELETED',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: {
        title: meeting.title,
        hardDelete: hardDelete === 'true',
        deleteAttendance: deleteAttendance === 'true',
        attendanceCount
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'warning'
    });
    
    res.json({
      success: true,
      message: hardDelete === 'true' ? 'Meeting permanently deleted' : 'Meeting deleted',
      meetingId: meeting._id,
      hardDelete: hardDelete === 'true'
    });
    
  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ 
      error: 'Failed to delete meeting',
      code: 'MEETING_DELETE_FAILED'
    });
  }
});

/**
 * @route POST /api/meetings/:meetingId/start
 * @desc Start a meeting
 * @access Private (canEditMeetings permission)
 */
app.post('/api/meetings/:meetingId/start', authenticateToken, checkPermission('canEditMeetings'), async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null,
      status: { $in: ['draft', 'scheduled', 'active'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or cannot be started',
        code: 'MEETING_NOT_STARTABLE'
      });
    }
    
    // Check if meeting is in the future
    if (new Date(meeting.schedule.startTime) > new Date()) {
      return res.status(400).json({ 
        error: 'Meeting start time is in the future',
        code: 'MEETING_NOT_STARTED_YET'
      });
    }
    
    const oldStatus = meeting.status;
    meeting.status = 'in_progress';
    meeting.updatedAt = new Date();
    await meeting.save();
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'MEETING_STARTED',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: {
        oldStatus,
        newStatus: meeting.status,
        startedBy: req.user.fullName
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    // Send notifications
    const admins = await AdminUser.find({
      organizationId: req.user.organizationId._id,
      isActive: true,
      'permissions.canViewReports': true
    });
    
    for (const admin of admins) {
      await sendNotification(
        admin._id,
        'Meeting Started',
        `Meeting "${meeting.title}" has been started by ${req.user.fullName}`,
        {
          meetingId: meeting._id,
          meetingTitle: meeting.title,
          startedBy: req.user.fullName,
          startTime: meeting.schedule.startTime,
          organizationId: req.user.organizationId._id
        },
        'meeting'
      );
    }
    
    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        status: meeting.status,
        oldStatus
      }
    });
  } catch (error) {
    console.error('Start meeting error:', error);
    res.status(500).json({ 
      error: 'Failed to start meeting',
      code: 'MEETING_START_FAILED'
    });
  }
});

/**
 * @route POST /api/meetings/:meetingId/end
 * @desc End a meeting
 * @access Private (canEditMeetings permission)
 */
app.post('/api/meetings/:meetingId/end', authenticateToken, checkPermission('canEditMeetings'), async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null,
      status: 'in_progress'
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or not in progress',
        code: 'MEETING_NOT_IN_PROGRESS'
      });
    }
    
    const oldStatus = meeting.status;
    meeting.status = 'completed';
    meeting.updatedAt = new Date();
    await meeting.save();
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'MEETING_ENDED',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: {
        oldStatus,
        newStatus: meeting.status,
        endedBy: req.user.fullName,
        duration: meeting.duration
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    // Send notifications
    const admins = await AdminUser.find({
      organizationId: req.user.organizationId._id,
      isActive: true,
      'permissions.canViewReports': true
    });
    
    for (const admin of admins) {
      await sendNotification(
        admin._id,
        'Meeting Ended',
        `Meeting "${meeting.title}" has been ended by ${req.user.fullName}. Total duration: ${meeting.duration.toFixed(1)} hours`,
        {
          meetingId: meeting._id,
          meetingTitle: meeting.title,
          endedBy: req.user.fullName,
          endTime: meeting.schedule.endTime,
          duration: meeting.duration,
          organizationId: req.user.organizationId._id
        },
        'meeting'
      );
    }
    
    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        status: meeting.status,
        oldStatus,
        duration: meeting.duration
      }
    });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ 
      error: 'Failed to end meeting',
      code: 'MEETING_END_FAILED'
    });
  }
});

/**
 * @route GET /api/meetings/:publicCode/form
 * @desc Get meeting form for attendees
 * @access Public (with meeting code)
 */
app.get('/api/meetings/:publicCode/form', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      'accessCodes.publicCode': req.params.publicCode,
      deletedAt: null,
      status: { $in: ['active', 'in_progress'] }
    }).populate('organizationId', 'name logo');
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or not active',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart) {
      return res.status(403).json({ 
        error: 'Attendance not yet started',
        details: `Attendance starts at ${moment(meeting.schedule.attendanceStart).format('h:mm A')}`,
        availableFrom: meeting.schedule.attendanceStart,
        code: 'ATTENDANCE_NOT_STARTED'
      });
    }
    
    if (now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ 
        error: 'Attendance period has ended',
        details: `Attendance ended at ${moment(meeting.schedule.attendanceEnd).format('h:mm A')}`,
        endedAt: meeting.schedule.attendanceEnd,
        code: 'ATTENDANCE_ENDED'
      });
    }
    
    // Check if meeting is private and requires approval
    if (meeting.isPrivate) {
      return res.status(403).json({
        error: 'This is a private meeting',
        code: 'PRIVATE_MEETING'
      });
    }
    
    // Check max attendees
    if (meeting.maxAttendees) {
      const currentAttendance = await AttendanceRecord.countDocuments({
        meetingId: meeting._id,
        deletedAt: null,
        status: { $in: ['pending', 'verified'] }
      });
      
      if (currentAttendance >= meeting.maxAttendees) {
        return res.status(403).json({
          error: 'Meeting is full',
          details: `Maximum ${meeting.maxAttendees} attendees allowed`,
          current: currentAttendance,
          max: meeting.maxAttendees,
          code: 'MEETING_FULL'
        });
      }
    }
    
    // Prepare form data
    const formData = {
      meeting: {
        id: meeting._id,
        title: meeting.title,
        description: meeting.description,
        category: meeting.category,
        organization: {
          id: meeting.organizationId._id,
          name: meeting.organizationId.name,
          logo: meeting.organizationId.logo
        },
        location: meeting.location,
        schedule: meeting.schedule,
        requiresApproval: meeting.requiresApproval
      },
      attendanceConfig: {
        allowedModes: meeting.attendanceConfig.allowedModes,
        requiredFields: meeting.attendanceConfig.requiredFields,
        verificationStrictness: meeting.attendanceConfig.verificationStrictness,
        autoApprove: meeting.attendanceConfig.autoApprove
      },
      customFormFields: meeting.customFormFields,
      timeVerification: meeting.timeVerification,
      maxAttendees: meeting.maxAttendees,
      currentAttendance: meeting.attendanceCount
    };
    
    res.json({
      success: true,
      ...formData
    });
  } catch (error) {
    console.error('Get meeting form error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch meeting form',
      code: 'FORM_FETCH_FAILED'
    });
  }
});

/**
 * @route GET /api/meetings/:meetingId/qrcode
 * @desc Get meeting QR code
 * @access Private
 */
app.get('/api/meetings/:meetingId/qrcode', authenticateToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    const qrCode = await generateMeetingQRCode(meeting.accessCodes.publicCode);
    
    if (!qrCode) {
      return res.status(500).json({ 
        error: 'Failed to generate QR code',
        code: 'QR_CODE_GENERATION_FAILED'
      });
    }
    
    res.json({
      success: true,
      qrCode,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        publicCode: meeting.accessCodes.publicCode,
        url: `${process.env.FRONTEND_URL || 'https://gsf-inky.vercel.app'}/attend/${meeting.accessCodes.publicCode}`
      }
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ 
      error: 'Failed to generate QR code',
      code: 'QR_CODE_FETCH_FAILED'
    });
  }
});

// ================= ATTENDANCE ROUTES =================

/**
 * @route POST /api/attend/smartphone
 * @desc Record smartphone GPS attendance
 * @access Public (with meeting code)
 */
app.post('/api/attend/smartphone', async (req, res) => {
  try {
    const { meetingCode, attendeeInfo, locationData, deviceInfo, formData } = req.body;
    
    // Validation
    if (!meetingCode || !attendeeInfo || !attendeeInfo.fullName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['meetingCode', 'attendeeInfo.fullName'],
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    if (!locationData || !locationData.latitude || !locationData.longitude) {
      return res.status(400).json({ 
        error: 'Location data is required for GPS attendance',
        code: 'LOCATION_DATA_REQUIRED'
      });
    }
    
    // Find meeting
    const meeting = await Meeting.findOne({
      'accessCodes.publicCode': meetingCode,
      deletedAt: null,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or not active',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    // Check if GPS attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.smartphoneGPS) {
      return res.status(403).json({ 
        error: 'GPS attendance not allowed for this meeting',
        code: 'GPS_ATTENDANCE_NOT_ALLOWED'
      });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart) {
      return res.status(403).json({ 
        error: 'Attendance not yet started',
        details: `Attendance starts at ${moment(meeting.schedule.attendanceStart).format('h:mm A')}`,
        code: 'ATTENDANCE_NOT_STARTED'
      });
    }
    
    if (now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ 
        error: 'Attendance period has ended',
        details: `Attendance ended at ${moment(meeting.schedule.attendanceEnd).format('h:mm A')}`,
        code: 'ATTENDANCE_ENDED'
      });
    }
    
    // Check max attendees
    if (meeting.maxAttendees) {
      const currentAttendance = await AttendanceRecord.countDocuments({
        meetingId: meeting._id,
        deletedAt: null,
        status: { $in: ['pending', 'verified'] }
      });
      
      if (currentAttendance >= meeting.maxAttendees) {
        return res.status(403).json({
          error: 'Meeting is full',
          details: `Maximum ${meeting.maxAttendees} attendees allowed`,
          code: 'MEETING_FULL'
        });
      }
    }
    
    // Validate location
    const locationValidation = validateLocation(
      locationData.latitude,
      locationData.longitude,
      meeting.location.latitude,
      meeting.location.longitude,
      meeting.location.radius,
      locationData.accuracy || 100
    );
    
    // Check for duplicates
    const duplicateChecks = [];
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameDevice && deviceInfo?.deviceId) {
      duplicateChecks.push({
        'deviceInfo.deviceId': deviceInfo.deviceId,
        meetingId: meeting._id,
        deletedAt: null,
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSamePhone && attendeeInfo.phone) {
      duplicateChecks.push({
        'attendeeInfo.phone': attendeeInfo.phone,
        meetingId: meeting._id,
        deletedAt: null,
        createdAt: {
          $gte: new Date(now.getTime() - meeting.attendanceConfig.duplicatePrevention.timeWindowMinutes * 60000)
        }
      });
    }
    
    if (meeting.attendanceConfig.duplicatePrevention.preventSameNameTime && attendeeInfo.fullName) {
      duplicateChecks.push({
        'attendeeInfo.fullName': attendeeInfo.fullName,
        meetingId: meeting._id,
        deletedAt: null,
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
          },
          code: 'DUPLICATE_ATTENDANCE'
        });
      }
    }
    
    // Validate custom form fields
    const additionalFields = new Map();
    if (formData && meeting.customFormFields) {
      for (const field of meeting.customFormFields) {
        if (field.isRequired && (!formData[field.fieldName] || formData[field.fieldName].toString().trim() === '')) {
          return res.status(400).json({ 
            error: 'Required information missing',
            details: `Please provide: ${field.label}`,
            field: field.fieldName,
            code: 'REQUIRED_FIELD_MISSING'
          });
        }
        
        if (formData[field.fieldName]) {
          const value = formData[field.fieldName].toString().trim();
          
          // Apply validation
          if (field.validation) {
            if (field.validation.minLength && value.length < field.validation.minLength) {
              return res.status(400).json({
                error: 'Invalid input',
                details: `${field.label} must be at least ${field.validation.minLength} characters`,
                code: 'FIELD_VALIDATION_FAILED'
              });
            }
            
            if (field.validation.maxLength && value.length > field.validation.maxLength) {
              return res.status(400).json({
                error: 'Invalid input',
                details: `${field.label} must not exceed ${field.validation.maxLength} characters`,
                code: 'FIELD_VALIDATION_FAILED'
              });
            }
            
            if (field.validation.pattern) {
              const regex = new RegExp(field.validation.pattern);
              if (!regex.test(value)) {
                return res.status(400).json({
                  error: 'Invalid format',
                  details: `${field.label} format is invalid`,
                  code: 'FIELD_VALIDATION_FAILED'
                });
              }
            }
          }
          
          additionalFields.set(field.fieldName, value);
        }
      }
    }
    
    // Calculate confidence score
    const confidenceScore = calculateConfidenceScore('smartphone_gps', locationValidation, meeting);
    
    // Determine status
    let status = 'pending';
    if (meeting.attendanceConfig.autoApprove.enabled && confidenceScore >= meeting.attendanceConfig.autoApprove.confidenceThreshold) {
      status = 'verified';
    }
    
    // Create attendance record
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'smartphone_gps',
      attendeeInfo: {
        ...attendeeInfo,
        additionalFields
      },
      locationData: {
        coordinates: locationData,
        distanceFromVenue: locationValidation.distance,
        isWithinRadius: locationValidation.isWithinRadius,
        address: locationData.address || meeting.location.address,
        validationDetails: locationValidation
      },
      deviceInfo: deviceInfo || {},
      verificationDetails: {
        confidenceScore,
        verificationMethod: 'GPS',
        verificationTimestamp: now,
        autoVerified: status === 'verified',
        autoVerifiedAt: status === 'verified' ? now : null
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: false
      },
      status,
      auditTrail: [{
        action: 'ATTENDANCE_RECORDED',
        performedBy: null,
        notes: `GPS attendance recorded with ${confidenceScore}% confidence`
      }]
    });
    
    // Update meeting counts
    await Meeting.findByIdAndUpdate(meeting._id, {
      $inc: { 
        attendanceCount: 1,
        ...(status === 'verified' ? { verifiedCount: 1 } : { pendingCount: 1 })
      }
    });
    
    // Create audit log
    await AuditLog.create({
      organizationId: meeting.organizationId,
      userId: null,
      userEmail: 'attendee',
      userRole: 'attendee',
      action: 'ATTENDANCE_RECORDED',
      entityType: 'attendance',
      entityId: attendanceRecord._id,
      entityName: attendeeInfo.fullName,
      details: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        verificationType: 'smartphone_gps',
        confidenceScore,
        status,
        locationValidated: locationValidation.isWithinRadius
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    // Send notification to admins
    const admins = await AdminUser.find({
      organizationId: meeting.organizationId,
      isActive: true,
      'permissions.canApproveAttendance': true
    });
    
    for (const admin of admins) {
      await sendNotification(
        admin._id,
        'New Attendance Recorded',
        `${attendeeInfo.fullName} marked attendance for "${meeting.title}"`,
        {
          attendanceId: attendanceRecord._id,
          meetingId: meeting._id,
          meetingTitle: meeting.title,
          attendeeName: attendeeInfo.fullName,
          verificationType: 'smartphone_gps',
          status,
          confidenceScore,
          organizationId: meeting.organizationId
        },
        'attendance'
      );
    }
    
    res.status(201).json({
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      confidenceScore,
      locationValidation: {
        passed: locationValidation.isWithinRadius,
        distance: locationValidation.distance,
        radius: meeting.location.radius,
        accuracy: locationData.accuracy
      },
      meetingDetails: {
        title: meeting.title,
        location: meeting.location.name,
        time: moment(meeting.schedule.startTime).format('h:mm A')
      },
      nextSteps: status === 'verified' ? 
        ['You can now participate in the meeting'] :
        ['Your attendance is pending verification'],
      timestamp: now
    });
  } catch (error) {
    console.error('Smartphone attendance error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to record attendance',
      code: 'ATTENDANCE_RECORDING_FAILED'
    });
  }
});

/**
 * @route POST /api/attend/manual
 * @desc Record manual attendance
 * @access Private (canApproveAttendance permission)
 */
app.post('/api/attend/manual', authenticateToken, checkPermission('canApproveAttendance'), async (req, res) => {
  try {
    const { meetingId, attendeeInfo, formData } = req.body;
    
    // Validation
    if (!meetingId || !attendeeInfo || !attendeeInfo.fullName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['meetingId', 'attendeeInfo.fullName'],
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Find meeting
    const meeting = await Meeting.findOne({
      _id: meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found or not active',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    // Check if manual attendance is allowed
    if (!meeting.attendanceConfig.allowedModes.manual) {
      return res.status(403).json({ 
        error: 'Manual attendance not allowed for this meeting',
        code: 'MANUAL_ATTENDANCE_NOT_ALLOWED'
      });
    }
    
    // Check time window
    const now = new Date();
    if (now < meeting.schedule.attendanceStart) {
      return res.status(403).json({ 
        error: 'Attendance not yet started',
        details: `Attendance starts at ${moment(meeting.schedule.attendanceStart).format('h:mm A')}`,
        code: 'ATTENDANCE_NOT_STARTED'
      });
    }
    
    if (now > meeting.schedule.attendanceEnd) {
      return res.status(403).json({ 
        error: 'Attendance period has ended',
        details: `Attendance ended at ${moment(meeting.schedule.attendanceEnd).format('h:mm A')}`,
        code: 'ATTENDANCE_ENDED'
      });
    }
    
    // Check max attendees
    if (meeting.maxAttendees) {
      const currentAttendance = await AttendanceRecord.countDocuments({
        meetingId: meeting._id,
        deletedAt: null,
        status: { $in: ['pending', 'verified'] }
      });
      
      if (currentAttendance >= meeting.maxAttendees) {
        return res.status(403).json({
          error: 'Meeting is full',
          details: `Maximum ${meeting.maxAttendees} attendees allowed`,
          code: 'MEETING_FULL'
        });
      }
    }
    
    // Validate custom form fields
    const additionalFields = new Map();
    if (formData && meeting.customFormFields) {
      for (const field of meeting.customFormFields) {
        if (field.isRequired && (!formData[field.fieldName] || formData[field.fieldName].toString().trim() === '')) {
          return res.status(400).json({ 
            error: 'Required information missing',
            details: `Please provide: ${field.label}`,
            field: field.fieldName,
            code: 'REQUIRED_FIELD_MISSING'
          });
        }
        
        if (formData[field.fieldName]) {
          additionalFields.set(field.fieldName, formData[field.fieldName].toString().trim());
        }
      }
    }
    
    // Create attendance record
    const attendanceRecord = await AttendanceRecord.create({
      meetingId: meeting._id,
      organizationId: meeting.organizationId,
      verificationType: 'manual',
      attendeeInfo: {
        ...attendeeInfo,
        additionalFields
      },
      verificationDetails: {
        confidenceScore: 95,
        verificationMethod: 'Manual',
        verificationTimestamp: now,
        verifiedByAdminId: req.user._id,
        manualVerificationReason: 'Manually recorded by admin'
      },
      timeTracking: {
        checkInTime: now,
        meetsTimeRequirement: true
      },
      status: 'verified',
      auditTrail: [{
        action: 'MANUAL_ATTENDANCE_RECORDED',
        performedBy: req.user._id,
        performedByName: req.user.fullName,
        notes: 'Attendance manually recorded by admin'
      }]
    });
    
    // Update meeting counts
    await Meeting.findByIdAndUpdate(meeting._id, {
      $inc: { 
        attendanceCount: 1,
        verifiedCount: 1
      }
    });
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'MANUAL_ATTENDANCE_RECORDED',
      entityType: 'attendance',
      entityId: attendanceRecord._id,
      entityName: attendeeInfo.fullName,
      details: {
        meetingId: meeting._id,
        meetingTitle: meeting.title,
        attendeeName: attendeeInfo.fullName,
        recordedBy: req.user.fullName
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.status(201).json({
      success: true,
      attendanceId: attendanceRecord._id,
      status: attendanceRecord.status,
      attendeeName: attendeeInfo.fullName,
      recordedBy: req.user.fullName,
      timestamp: now
    });
  } catch (error) {
    console.error('Manual attendance error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to record manual attendance',
      code: 'MANUAL_ATTENDANCE_FAILED'
    });
  }
});

// ================= ATTENDANCE MANAGEMENT ROUTES =================

/**
 * @route GET /api/meetings/:meetingId/attendance
 * @desc Get attendance records for a meeting
 * @access Private
 */
app.get('/api/meetings/:meetingId/attendance', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      verificationType, 
      search, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Verify meeting belongs to organization
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    const query = {
      meetingId: meeting._id,
      deletedAt: null
    };
    
    // Apply filters
    if (status) query.status = status;
    if (verificationType) query.verificationType = verificationType;
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (search) {
      query.$or = [
        { 'attendeeInfo.fullName': { $regex: search, $options: 'i' } },
        { 'attendeeInfo.phone': { $regex: search, $options: 'i' } },
        { 'attendeeInfo.email': { $regex: search, $options: 'i' } },
        { 'attendeeInfo.idNumber': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get attendance records
    const attendance = await AttendanceRecord.find(query)
      .populate('verificationDetails.verifiedByAdminId', 'fullName email')
      .populate('verificationDetails.timeVerifiedBy', 'fullName email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Get total count
    const total = await AttendanceRecord.countDocuments(query);
    
    // Get summary statistics
    const summary = await AttendanceRecord.aggregate([
      {
        $match: { 
          meetingId: meeting._id,
          deletedAt: null
        }
      },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$verificationType',
                count: { $sum: 1 }
              }
            }
          ],
          byHour: [
            {
              $group: {
                _id: { $hour: '$timeTracking.checkInTime' },
                count: { $sum: 1 }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ]
        }
      }
    ]);
    
    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        title: meeting.title,
        location: meeting.location
      },
      attendance,
      summary: {
        byStatus: summary[0].byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byType: summary[0].byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byHour: summary[0].byHour,
        total
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch attendance',
      code: 'ATTENDANCE_FETCH_FAILED'
    });
  }
});

/**
 * @route PUT /api/attendance/:attendanceId/status
 * @desc Update attendance status
 * @access Private (canApproveAttendance permission)
 */
app.put('/api/attendance/:attendanceId/status', authenticateToken, checkPermission('canApproveAttendance'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    if (!status || !['verified', 'rejected', 'flagged', 'pending'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        code: 'INVALID_STATUS'
      });
    }
    
    const attendance = await AttendanceRecord.findOne({
      _id: req.params.attendanceId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!attendance) {
      return res.status(404).json({ 
        error: 'Attendance record not found',
        code: 'ATTENDANCE_NOT_FOUND'
      });
    }
    
    const oldStatus = attendance.status;
    
    // Update attendance
    attendance.status = status;
    attendance.verificationDetails.verifiedByAdminId = req.user._id;
    attendance.verificationDetails.verificationTimestamp = new Date();
    
    if (notes) {
      attendance.notes = notes;
    }
    
    attendance.auditTrail.push({
      action: 'STATUS_UPDATED',
      performedBy: req.user._id,
      performedByName: req.user.fullName,
      notes: `Changed from ${oldStatus} to ${status}. ${notes || ''}`,
      changes: {
        oldStatus,
        newStatus: status,
        verifiedBy: req.user.fullName
      }
    });
    
    attendance.updatedAt = new Date();
    await attendance.save();
    
    // Update meeting counts
    const updateFields = {};
    if (oldStatus === 'verified' && status !== 'verified') {
      updateFields.$inc = { verifiedCount: -1 };
      if (status === 'pending') updateFields.$inc.pendingCount = 1;
    } else if (oldStatus !== 'verified' && status === 'verified') {
      updateFields.$inc = { verifiedCount: 1 };
      if (oldStatus === 'pending') updateFields.$inc.pendingCount = -1;
    } else if (oldStatus === 'pending' && status !== 'pending') {
      updateFields.$inc = { pendingCount: -1 };
    } else if (oldStatus !== 'pending' && status === 'pending') {
      updateFields.$inc = { pendingCount: 1 };
    }
    
    if (Object.keys(updateFields).length > 0) {
      await Meeting.findByIdAndUpdate(attendance.meetingId, updateFields);
    }
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'ATTENDANCE_STATUS_UPDATED',
      entityType: 'attendance',
      entityId: attendance._id,
      entityName: attendance.attendeeInfo.fullName,
      details: {
        oldStatus,
        newStatus: status,
        notes,
        verifiedBy: req.user.fullName
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.json({
      success: true,
      attendance: {
        id: attendance._id,
        status: attendance.status,
        attendeeName: attendance.attendeeInfo.fullName,
        verifiedBy: req.user.fullName,
        verificationTimestamp: attendance.verificationDetails.verificationTimestamp
      }
    });
  } catch (error) {
    console.error('Update attendance status error:', error);
    res.status(500).json({ 
      error: 'Failed to update attendance status',
      code: 'ATTENDANCE_STATUS_UPDATE_FAILED'
    });
  }
});

// ================= EXPORT ROUTES =================

/**
 * @route GET /api/meetings/:meetingId/export/pdf
 * @desc Export meeting attendance as PDF
 * @access Private (canExportData permission)
 */
app.get('/api/meetings/:meetingId/export/pdf', authenticateToken, checkPermission('canExportData'), async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    const organization = await Organization.findById(req.user.organizationId._id);
    
    // Get attendance records
    const attendance = await AttendanceRecord.find({
      meetingId: meeting._id,
      deletedAt: null
    }).sort({ 'attendeeInfo.fullName': 1 });
    
    // Generate PDF
    const pdfBuffer = await generateAttendancePDF(meeting, attendance, organization);
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'EXPORT_PDF',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: { 
        recordCount: attendance.length,
        format: 'PDF'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${meeting.title.replace(/[^a-z0-9]/gi, '_')}-${moment().format('YYYY-MM-DD')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      code: 'PDF_EXPORT_FAILED'
    });
  }
});

/**
 * @route GET /api/meetings/:meetingId/export/excel
 * @desc Export meeting attendance as Excel
 * @access Private (canExportData permission)
 */
app.get('/api/meetings/:meetingId/export/excel', authenticateToken, checkPermission('canExportData'), async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.meetingId,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        code: 'MEETING_NOT_FOUND'
      });
    }
    
    const organization = await Organization.findById(req.user.organizationId._id);
    
    // Get attendance records
    const attendance = await AttendanceRecord.find({
      meetingId: meeting._id,
      deletedAt: null
    }).sort({ 'attendeeInfo.fullName': 1 });
    
    // Generate Excel
    const excelBuffer = await generateAttendanceExcel(meeting, attendance, organization);
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'EXPORT_EXCEL',
      entityType: 'meeting',
      entityId: meeting._id,
      entityName: meeting.title,
      details: { 
        recordCount: attendance.length,
        format: 'Excel'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${meeting.title.replace(/[^a-z0-9]/gi, '_')}-${moment().format('YYYY-MM-DD')}.xlsx"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ 
      error: 'Failed to generate Excel',
      code: 'EXCEL_EXPORT_FAILED'
    });
  }
});

// ================= ADMIN MANAGEMENT ROUTES =================

/**
 * @route GET /api/admins
 * @desc Get all admins for organization
 * @access Private (canManageAdmins permission)
 */
app.get('/api/admins', authenticateToken, checkPermission('canManageAdmins'), async (req, res) => {
  try {
    const admins = await AdminUser.find({
      organizationId: req.user.organizationId._id,
      deletedAt: null
    }).select('-password -resetPasswordToken -resetPasswordExpires -twoFactorSecret -loginAttempts -lockUntil');
    
    res.json({
      success: true,
      admins
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch admins',
      code: 'ADMINS_FETCH_FAILED'
    });
  }
});

/**
 * @route POST /api/admins
 * @desc Create new admin
 * @access Private (canManageAdmins permission)
 */
app.post('/api/admins', authenticateToken, checkPermission('canManageAdmins'), async (req, res) => {
  try {
    const { email, password, fullName, phone, role, permissions, isActive } = req.body;
    
    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'fullName'],
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    // Check if user already exists
    const existingUser = await AdminUser.findOne({ 
      email,
      organizationId: req.user.organizationId._id,
      deletedAt: null
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Admin already exists',
        code: 'ADMIN_EXISTS'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create admin
    const admin = await AdminUser.create({
      organizationId: req.user.organizationId._id,
      email,
      password: hashedPassword,
      fullName,
      phone,
      role: role || 'admin',
      isActive: isActive !== undefined ? isActive : true,
      permissions: permissions || {
        canCreateMeetings: true,
        canEditMeetings: true,
        canDeleteMeetings: false,
        canViewReports: true,
        canManageAdmins: false,
        canApproveAttendance: true,
        canExportData: true,
        canAccessAnalytics: true,
        canManageOrganization: false
      }
    });
    
    // Create audit log
    await AuditLog.create({
      organizationId: req.user.organizationId._id,
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: 'ADMIN_CREATED',
      entityType: 'user',
      entityId: admin._id,
      entityName: admin.fullName,
      details: {
        email,
        role: admin.role,
        isActive: admin.isActive,
        createdBy: req.user.fullName
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'info'
    });
    
    // Send notification to new admin
    await sendNotification(
      admin._id,
      'Welcome to GSAMS!',
      `You have been added as an admin to ${req.user.organizationId.name} by ${req.user.fullName}.`,
      {
        organizationId: req.user.organizationId._id,
        organizationName: req.user.organizationId.name,
        addedBy: req.user.fullName,
        role: admin.role,
        permissions: admin.permissions
      },
      'system'
    );
    
    res.status(201).json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        isActive: admin.isActive,
        permissions: admin.permissions,
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create admin',
      code: 'ADMIN_CREATION_FAILED'
    });
  }
});

// ================= DASHBOARD & ANALYTICS ROUTES =================

/**
 * @route GET /api/dashboard/stats
 * @desc Get dashboard statistics
 * @access Private
 */
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get statistics using aggregation
    const stats = await Promise.all([
      // Total meetings
      Meeting.countDocuments({ 
        organizationId: req.user.organizationId._id,
        deletedAt: null 
      }),
      
      // Active meetings
      Meeting.countDocuments({ 
        organizationId: req.user.organizationId._id,
        status: 'in_progress',
        deletedAt: null 
      }),
      
      // Upcoming meetings
      Meeting.countDocuments({ 
        organizationId: req.user.organizationId._id,
        status: { $in: ['draft', 'scheduled', 'active'] },
        'schedule.startTime': { $gt: now },
        deletedAt: null 
      }),
      
      // Total attendance (last 30 days)
      AttendanceRecord.countDocuments({ 
        organizationId: req.user.organizationId._id,
        createdAt: { $gte: thirtyDaysAgo },
        deletedAt: null 
      }),
      
      // Today's attendance
      AttendanceRecord.countDocuments({ 
        organizationId: req.user.organizationId._id,
        createdAt: { 
          $gte: new Date(now.setHours(0, 0, 0, 0)),
          $lte: new Date(now.setHours(23, 59, 59, 999))
        },
        deletedAt: null 
      }),
      
      // Attendance by type
      AttendanceRecord.aggregate([
        {
          $match: {
            organizationId: req.user.organizationId._id,
            createdAt: { $gte: thirtyDaysAgo },
            deletedAt: null
          }
        },
        {
          $group: {
            _id: '$verificationType',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Recent meetings
      Meeting.find({
        organizationId: req.user.organizationId._id,
        deletedAt: null
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'fullName')
      .lean(),
      
      // Recent attendance
      AttendanceRecord.find({
        organizationId: req.user.organizationId._id,
        deletedAt: null
      })
      .populate('meetingId', 'title')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('attendeeInfo.fullName verificationType status createdAt meetingId')
      .lean()
    ]);
    
    const [totalMeetings, activeMeetings, upcomingMeetings, totalAttendance, todayAttendance, byType, recentMeetings, recentAttendance] = stats;
    
    // Calculate growth metrics
    const lastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const lastMonthAttendance = await AttendanceRecord.countDocuments({
      organizationId: req.user.organizationId._id,
      createdAt: { 
        $gte: lastMonth,
        $lt: thirtyDaysAgo
      },
      deletedAt: null
    });
    
    const attendanceGrowth = lastMonthAttendance > 0 ? 
      ((totalAttendance - lastMonthAttendance) / lastMonthAttendance * 100).toFixed(1) : 100;
    
    res.json({
      success: true,
      stats: {
        overview: {
          totalMeetings,
          activeMeetings,
          upcomingMeetings,
          totalAttendance,
          todayAttendance,
          attendanceGrowth: parseFloat(attendanceGrowth)
        },
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentMeetings,
        recentAttendance
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard statistics',
      code: 'DASHBOARD_STATS_FAILED'
    });
  }
});

// ================= NOTIFICATION ROUTES =================

/**
 * @route GET /api/notifications
 * @desc Get user notifications
 * @access Private
 */
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { unreadOnly, page = 1, limit = 20 } = req.query;
    
    const query = {
      userId: req.user._id,
      organizationId: req.user.organizationId._id
    };
    
    if (unreadOnly === 'true') {
      query.read = false;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      ...query,
      read: false
    });
    
    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notifications',
      code: 'NOTIFICATIONS_FETCH_FAILED'
    });
  }
});

/**
 * @route PUT /api/notifications/:notificationId/read
 * @desc Mark notification as read
 * @access Private
 */
app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.notificationId,
      userId: req.user._id,
      organizationId: req.user.organizationId._id
    });
    
    if (!notification) {
      return res.status(404).json({ 
        error: 'Notification not found',
        code: 'NOTIFICATION_NOT_FOUND'
      });
    }
    
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
    
    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ 
      error: 'Failed to mark notification as read',
      code: 'NOTIFICATION_READ_FAILED'
    });
  }
});

/**
 * @route PUT /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        userId: req.user._id,
        organizationId: req.user.organizationId._id,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ 
      error: 'Failed to mark all notifications as read',
      code: 'NOTIFICATIONS_READ_ALL_FAILED'
    });
  }
});

// ================= HEALTH CHECK =================

/**
 * @route GET /api/health
 * @desc Health check endpoint
 * @access Public
 */
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      services: {
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: {
          rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
        }
      },
      version: '1.0.0'
    };
    
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

// ================= ERROR HANDLING =================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Default error
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  
  res.status(status).json({
    error: message,
    code,
    timestamp: new Date(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ================= SERVER START =================

const startServer = async () => {
  try {
    server.listen(PORT, () => {
      console.log(`✅ GSAMS Backend running on port ${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✅ MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Close MongoDB connection
  await mongoose.connection.close();
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  
  // Close MongoDB connection
  await mongoose.connection.close();
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

// Export for testing
module.exports = app;