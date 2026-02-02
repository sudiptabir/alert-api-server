#!/usr/bin/env node

/**
 * 🚨 Alert API Backend Server - Railway Deployment
 * Receives alerts from external sources and pushes notifications to mobile app
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  try {
    if (!firebaseInitialized) {
      let serviceAccount;
      
      // Prioritize individual environment variables (more reliable for Railway)
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID || "sensor-app-2a69b",
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
        };
        console.log('✅ Using individual Firebase environment variables');
      } 
      // Fallback to base64 encoded service account
      else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const base64Data = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        const jsonString = Buffer.from(base64Data, 'base64').toString('utf8');
        serviceAccount = JSON.parse(jsonString);
        
        // Fix the private key - replace literal \n with actual newlines
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        console.log('✅ Using base64 encoded service account');
      } else {
        throw new Error('No Firebase credentials provided. Set either FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT_BASE64');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://sensor-app-2a69b-default-rtdb.firebaseio.com"
      });
      
      firebaseInitialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️  Server will continue without Firebase (notifications disabled)');
  }
}

// Initialize Firebase on startup
initializeFirebase();

/**
 * Generate notification content from alert data
 */
function generateNotificationContent(alert) {
  const riskEmojis = {
    'critical': '🔴',
    'high': '🟠', 
    'medium': '🟡',
    'low': '🟢'
  };

  const riskLevel = alert.risk_label.toLowerCase();
  const emoji = riskEmojis[riskLevel] || '🔵';
  
  const title = `${emoji} ${alert.risk_label} Alert - ${alert.device_identifier}`;
  const body = `${alert.detected_objects.join(', ')}: ${alert.description[0] || 'Alert detected'}`;

  return { title, body, emoji };
}

/**
 * Send push notification via Firebase
 */
async function sendPushNotification(userId, alert, notificationContent) {
  if (!firebaseInitialized) {
    console.log('⚠️  Firebase not initialized, skipping push notification');
    return null;
  }

  try {
    const db = admin.firestore();
    
    // Get user's Expo push token
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.expoPushToken) {
      console.log('⚠️  No Expo push token found for user:', userId);
      return null;
    }

    // Send notification via Expo Push API
    const message = {
      to: userData.expoPushToken,
      title: notificationContent.title,
      body: notificationContent.body,
      data: {
        type: 'mlAlert',
        deviceId: alert.device_identifier,
        alertId: alert.additional_data?.alert_id || uuidv4(),
        riskLabel: alert.risk_label,
        detectedObjects: alert.detected_objects.join(', '),
        timestamp: alert.timestamp.toString()
      },
      badge: 1,
      sound: 'default'
    };

    // Use Expo's push notification service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('📱 Push notification sent:', result);
    return result;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return null;
  }
}

/**
 * Store alert in Firestore
 */
async function storeAlertInFirestore(userId, deviceId, alert) {
  if (!firebaseInitialized) {
    console.log('⚠️  Firebase not initialized, skipping Firestore storage');
    return null;
  }

  try {
    const db = admin.firestore();
    
    // Create ML alert document
    const alertDoc = {
      deviceId: deviceId,
      deviceIdentifier: alert.device_identifier,
      userId: userId,
      notificationType: alert.notification_type,
      detectedObjects: alert.detected_objects,
      riskLabel: alert.risk_label,
      predictedRisk: alert.predicted_risk,
      description: alert.description,
      screenshots: alert.screenshot || [],
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      alertGeneratedAt: alert.timestamp,
      modelVersion: alert.model_version,
      confidenceScore: alert.confidence_score,
      acknowledged: false,
      rating: null,
      ratingAccuracy: null,
      additionalData: alert.additional_data || {}
    };

    // Store in user's mlAlerts collection
    const alertRef = await db
      .collection('users')
      .doc(userId)
      .collection('mlAlerts')
      .add(alertDoc);

    console.log('💾 Alert stored in Firestore:', alertRef.id);
    return alertRef.id;
  } catch (error) {
    console.error('❌ Error storing alert in Firestore:', error);
    return null;
  }
}

/**
 * API Routes
 */

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'Alert API Backend',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    firebase: firebaseInitialized,
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    firebase: firebaseInitialized
  });
});

// Receive and process alerts
app.post('/api/alerts', async (req, res) => {
  try {
    const { userId, deviceId, alert } = req.body;

    // Validate required fields
    if (!userId || !deviceId || !alert) {
      return res.status(400).json({
        error: 'Missing required fields: userId, deviceId, alert'
      });
    }

    if (!alert.detected_objects || !alert.risk_label) {
      return res.status(400).json({
        error: 'Invalid alert data: missing detected_objects or risk_label'
      });
    }

    console.log('🚨 Received alert:', {
      userId,
      deviceId,
      type: alert.notification_type,
      risk: alert.risk_label,
      objects: alert.detected_objects.join(', ')
    });

    // Generate notification content
    const notificationContent = generateNotificationContent(alert);

    // Store alert in Firestore (this will trigger real-time listeners in the app)
    const alertId = await storeAlertInFirestore(userId, deviceId, alert);

    // Send push notification
    const pushResult = await sendPushNotification(userId, alert, notificationContent);

    // Response
    res.json({
      success: true,
      message: 'Alert processed successfully',
      alertId,
      notification: {
        title: notificationContent.title,
        body: notificationContent.body,
        sent: !!pushResult
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error processing alert:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get server stats
app.get('/api/stats', (req, res) => {
  res.json({
    server: 'Alert API Backend',
    version: '1.0.0',
    uptime: process.uptime(),
    firebase: firebaseInitialized,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚨 Alert API Backend Server - Railway Deployment');
  console.log('=================================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔥 Firebase initialized: ${firebaseInitialized}`);
  console.log(`📡 Alert endpoint: /api/alerts`);
  console.log(`💚 Health check: /health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=================================================');
});

module.exports = app;