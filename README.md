# 🚨 Alert API Server

A Node.js API server that receives alerts from IoT devices and sends push notifications to mobile apps via Firebase.

## 🚀 Features

- **Alert Processing**: Receives alerts from external devices (Raspberry Pi, etc.)
- **Firebase Integration**: Stores alerts in Firestore and sends push notifications
- **Push Notifications**: Sends notifications via Expo Push API
- **Security**: Rate limiting, CORS, and input validation
- **Cloud Ready**: Optimized for Railway, Heroku, and other cloud platforms

## 📡 API Endpoints

### `POST /api/alerts`
Receive and process alerts from external devices.

**Request Body:**
```json
{
  "userId": "firebase-user-id",
  "deviceId": "device-identifier",
  "alert": {
    "notification_type": "Alert",
    "detected_objects": ["person", "weapon"],
    "risk_label": "Critical",
    "predicted_risk": "Critical",
    "description": ["Alert description"],
    "device_identifier": "device_001",
    "timestamp": 1234567890,
    "model_version": "v2.1.0",
    "confidence_score": 0.95
  }
}
```

### `GET /health`
Health check endpoint.

### `GET /api/stats`
Server statistics and status.

## 🔧 Environment Variables

### Firebase Configuration (Option 1 - Recommended)
```
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-encoded-service-account-json>
```

### Firebase Configuration (Option 2 - Individual Variables)
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=your-cert-url
FIREBASE_DATABASE_URL=your-database-url
```

### Server Configuration
```
NODE_ENV=production
PORT=3000
```

## 🚀 Deployment

### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/yourusername/alert-api-server)

1. Click the Railway button above
2. Set environment variables
3. Deploy!

### Manual Deployment
```bash
# Clone repository
git clone https://github.com/yourusername/alert-api-server.git
cd alert-api-server

# Install dependencies
npm install

# Set environment variables
# (see .env.example)

# Start server
npm start
```

## 🧪 Testing

```bash
# Health check
curl https://your-api-url.com/health

# Send test alert
curl -X POST https://your-api-url.com/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "deviceId": "test_device",
    "alert": {
      "notification_type": "Alert",
      "detected_objects": ["test"],
      "risk_label": "Medium",
      "predicted_risk": "Medium",
      "description": ["Test alert"],
      "device_identifier": "test_device",
      "timestamp": 1234567890,
      "model_version": "v1.0",
      "confidence_score": 0.8
    }
  }'
```

## 📱 Mobile App Integration

This API works with React Native apps using:
- **Firebase Firestore**: Real-time alert storage
- **Expo Push Notifications**: Push notification delivery
- **Real-time Listeners**: Automatic UI updates

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Cross-origin request handling
- **Helmet.js**: Security headers
- **Input Validation**: Required field validation
- **Firebase Admin SDK**: Secure server-side Firebase access

## 📊 Architecture

```
IoT Device (Raspberry Pi)
    ↓ HTTP POST
Alert API Server (This Repository)
    ↓ Store in Firestore
    ↓ Send Push Notification
Mobile App (React Native)
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For issues and questions, please open a GitHub issue.