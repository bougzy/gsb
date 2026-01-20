/**
 * Seed Script for Platform Admin & Subscription Plans
 *
 * This script creates:
 * 1. Default subscription plans (Starter, Professional, Enterprise)
 * 2. First platform admin account
 *
 * Usage: node seed-platform-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gsams';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connected to MongoDB');
  seedDatabase();
}).catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Define Schemas (same as in index.js)
const Schema = mongoose.Schema;

const PlatformAdminSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  phone: { type: String },
  role: { type: String, default: 'platform_admin' },
  isActive: { type: Boolean, default: true },
  isSuperAdmin: { type: Boolean, default: false },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  permissions: {
    canManageOrganizations: { type: Boolean, default: true },
    canManageSubscriptions: { type: Boolean, default: true },
    canViewGlobalAnalytics: { type: Boolean, default: true },
    canImpersonateOrgs: { type: Boolean, default: true },
    canManagePlatformAdmins: { type: Boolean, default: false },
    canAccessBilling: { type: Boolean, default: true },
    canModifyPricing: { type: Boolean, default: false }
  }
});

const SubscriptionPlanSchema = new Schema({
  name: { type: String, required: true },
  displayName: { type: String, required: true },
  description: { type: String },
  pricing: {
    monthly: { type: Number, required: true },
    annual: { type: Number },
    currency: { type: String, default: 'USD' }
  },
  limits: {
    maxAttendees: { type: Number, default: 100 },
    maxAdmins: { type: Number, default: 1 },
    maxMeetings: { type: Number, default: 10 },
    maxStorageGB: { type: Number, default: 1 }
  },
  features: {
    gpsVerification: { type: Boolean, default: true },
    smsVerification: { type: Boolean, default: false },
    ussdVerification: { type: Boolean, default: false },
    kioskMode: { type: Boolean, default: false },
    manualEntry: { type: Boolean, default: false },
    customForms: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    exportPDF: { type: Boolean, default: true },
    exportExcel: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    sla: { type: Boolean, default: false }
  },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const PlatformAdmin = mongoose.model('PlatformAdmin', PlatformAdminSchema);
const SubscriptionPlan = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);

async function seedDatabase() {
  try {
    console.log('\n🌱 Starting database seeding...\n');

    // 1. Create Subscription Plans
    console.log('📦 Creating subscription plans...');

    const plans = [
      {
        name: 'starter',
        displayName: 'Starter',
        description: 'Perfect for small schools and churches (100-500 members)',
        pricing: {
          monthly: 4900, // $49
          annual: 49000, // $490 (2 months free)
          currency: 'USD'
        },
        limits: {
          maxAttendees: 500,
          maxAdmins: 3,
          maxMeetings: 20,
          maxStorageGB: 2
        },
        features: {
          gpsVerification: true,
          smsVerification: false,
          ussdVerification: false,
          kioskMode: false,
          manualEntry: true,
          customForms: false,
          advancedAnalytics: false,
          exportPDF: true,
          exportExcel: false,
          apiAccess: false,
          whiteLabel: false,
          prioritySupport: false,
          sla: false
        },
        sortOrder: 1
      },
      {
        name: 'professional',
        displayName: 'Professional',
        description: 'For growing organizations (500-2000 members)',
        pricing: {
          monthly: 14900, // $149
          annual: 149000, // $1,490 (2 months free)
          currency: 'USD'
        },
        limits: {
          maxAttendees: 2000,
          maxAdmins: 10,
          maxMeetings: 100,
          maxStorageGB: 10
        },
        features: {
          gpsVerification: true,
          smsVerification: true,
          ussdVerification: true,
          kioskMode: true,
          manualEntry: true,
          customForms: true,
          advancedAnalytics: true,
          exportPDF: true,
          exportExcel: true,
          apiAccess: false,
          whiteLabel: false,
          prioritySupport: true,
          sla: false
        },
        sortOrder: 2
      },
      {
        name: 'enterprise',
        displayName: 'Enterprise',
        description: 'For large organizations (unlimited)',
        pricing: {
          monthly: 49900, // $499
          annual: 499000, // $4,990 (2 months free)
          currency: 'USD'
        },
        limits: {
          maxAttendees: 999999,
          maxAdmins: 999,
          maxMeetings: 999999,
          maxStorageGB: 100
        },
        features: {
          gpsVerification: true,
          smsVerification: true,
          ussdVerification: true,
          kioskMode: true,
          manualEntry: true,
          customForms: true,
          advancedAnalytics: true,
          exportPDF: true,
          exportExcel: true,
          apiAccess: true,
          whiteLabel: true,
          prioritySupport: true,
          sla: true
        },
        sortOrder: 3
      }
    ];

    // Delete existing plans
    await SubscriptionPlan.deleteMany({});
    console.log('  ✅ Cleared existing plans');

    // Create new plans
    for (const planData of plans) {
      const plan = await SubscriptionPlan.create(planData);
      console.log(`  ✅ Created plan: ${plan.displayName} ($${plan.pricing.monthly / 100}/month)`);
    }

    // 2. Create Platform Admin
    console.log('\n👤 Creating platform admin account...');

    // Check if platform admin already exists
    const existingAdmin = await PlatformAdmin.findOne({ email: 'admin@gsams.com' });

    if (existingAdmin) {
      console.log('  ⚠️  Platform admin already exists: admin@gsams.com');
    } else {
      const hashedPassword = await bcrypt.hash('Admin@123456', 10);

      const platformAdmin = await PlatformAdmin.create({
        email: 'admin@gsams.com',
        password: hashedPassword,
        fullName: 'Platform Administrator',
        phone: '+1234567890',
        isSuperAdmin: true,
        permissions: {
          canManageOrganizations: true,
          canManageSubscriptions: true,
          canViewGlobalAnalytics: true,
          canImpersonateOrgs: true,
          canManagePlatformAdmins: true,
          canAccessBilling: true,
          canModifyPricing: true
        }
      });

      console.log('  ✅ Created platform admin:');
      console.log(`     Email: ${platformAdmin.email}`);
      console.log(`     Password: Admin@123456`);
      console.log(`     Super Admin: Yes`);
    }

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - Subscription Plans: ${plans.length}`);
    console.log(`   - Platform Admin: 1\n`);
    console.log('🔐 Platform Admin Login Credentials:');
    console.log('   URL: https://gsams.vercel.app/platform-admin-login.html');
    console.log('   Email: admin@gsams.com');
    console.log('   Password: Admin@123456\n');
    console.log('⚠️  IMPORTANT: Change the default password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding error:', error);
    process.exit(1);
  }
}
