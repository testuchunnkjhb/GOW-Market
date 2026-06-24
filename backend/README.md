# GOW Market - Backend API

FastAPI-based backend for GOW Market marketplace platform.

## 🚀 Features

- **FastAPI** framework with async support
- **MongoDB** with Motor async driver
- **JWT-like** bearer token authentication
- **Password hashing** with bcrypt
- **Phone validation** for Uzbekistan numbers
- **Payment system** with Friday discounts
- **Admin panel** API
- **File uploads** support
- **Timezone handling** (Asia/Tashkent)

## 📋 Requirements

- Python 3.11+
- MongoDB 5.0+
- pip or poetry

## 🔧 Installation

### 1. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=gowmarket_db
CORS_ORIGINS=*
EMERGENT_LLM_KEY=your-key-here  # Optional
```

### 4. Run Server

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

API will be available at: `http://localhost:8001`

## 📡 API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

## 🔐 Authentication

### Register User

```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "name": "Test User",
    "password": "password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998901234567",
    "password": "password123"
  }'
```

Response:
```json
{
  "token": "user-id-as-token",
  "user": {
    "id": "...",
    "phone": "+998901234567",
    "name": "Test User",
    "role": "user"
  }
}
```

### Admin Login

```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+998945778512",
    "password": "adminq"
  }'
```

## 📋 Main Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Categories
- `GET /api/categories` - List all categories

### Ads
- `GET /api/ads` - List ads (supports filtering)
- `POST /api/ads` - Create new ad (requires auth)
- `GET /api/ads/{id}` - Get ad details
- `POST /api/ads/{id}/upload` - Upload ad image (requires auth)
- `GET /api/users/me/ads` - Get user's ads (requires auth)

### Favorites
- `POST /api/favorites/toggle` - Add/remove favorite (requires auth)
- `GET /api/favorites` - List user's favorites (requires auth)

### Messages
- `POST /api/messages` - Send message (requires auth)
- `GET /api/messages/conversations` - List conversations (requires auth)
- `GET /api/messages/{user_id}` - Get messages with user (requires auth)

### Payment
- `GET /api/payment/price` - Get current ad price
- `POST /api/payment/create` - Create payment (requires auth)
- `POST /api/payment/{id}/complete` - Complete payment (requires auth)

### Admin (requires admin role)
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/ads` - List all ads
- `POST /api/admin/ads/action` - Approve/reject ad
- `GET /api/admin/payments` - Payment history

### Files
- `GET /api/files/{path:path}` - Download uploaded file

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest tests/

# Run with coverage
pytest --cov=server tests/
```

## 📊 Database Schema

### Collections

1. **users** - User accounts
   ```json
   {
     "id": "uuid",
     "phone": "+998XXXXXXXXX",
     "name": "string",
     "password": "hashed",
     "role": "user|admin",
     "created_at": "iso-date"
   }
   ```

2. **categories** - Product categories
   ```json
   {
     "id": "uuid",
     "name_uz": "string",
     "name_ru": "string",
     "icon": "string"
   }
   ```

3. **ads** - Advertisements
   ```json
   {
     "id": "uuid",
     "user_id": "uuid",
     "title": "string",
     "category_id": "uuid",
     "price": "number",
     "description": "string",
     "images": ["string"],
     "location": {"address": "string", "landmark": "string"},
     "contact_name": "string",
     "contact_phone": "string",
     "contact_methods": ["string"],
     "can_deliver": "boolean",
     "status": "pending|active|rejected",
     "views": "number",
     "created_at": "iso-date"
   }
   ```

4. **payments** - Payment transactions
   ```json
   {
     "id": "uuid",
     "ad_id": "uuid",
     "user_id": "uuid",
     "amount": "number",
     "payment_method": "string",
     "status": "pending|completed|failed",
     "transaction_id": "string",
     "created_at": "iso-date"
   }
   ```

5. **favorites** - User favorites
6. **messages** - Chat messages
7. **otp_verifications** - (Legacy, not used with password auth)

## 🔒 Security Features

- **Password Hashing**: bcrypt with automatic salt
- **Phone Validation**: Uzbekistan format (+998 XX XXX XX XX)
- **CORS Protection**: Configurable origins
- **Admin-only Routes**: Role-based access control
- **Token Authentication**: Bearer token (user ID)

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONGO_URL` | MongoDB connection string | - | Yes |
| `DB_NAME` | Database name | `gowmarket_db` | Yes |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `*` | Yes |
| `EMERGENT_LLM_KEY` | Emergent API key | - | No |

### Admin Account

Default admin is created on startup:
- Phone: `+998945778512`
- Password: `adminq`

⚠️ **Change in production!**

## 💳 Payment System

### Ad Pricing

- **Regular Days**: 4,999 UZS
- **Friday (Juma)**: 2,499 UZS (50% discount)
- Timezone: Asia/Tashkent

### Payment Flow

1. User creates ad (status: draft)
2. User initiates payment (`POST /api/payment/create`)
3. User completes payment via Click gateway
4. Backend confirms payment (`POST /api/payment/{id}/complete`)
5. Ad status changes to "pending"
6. Admin approves ad
7. Ad becomes "active"

## 🚀 Deployment

### Production Checklist

- [ ] Change admin password
- [ ] Configure production MongoDB
- [ ] Set secure CORS origins
- [ ] Configure payment gateway
- [ ] Set up monitoring
- [ ] Configure backup strategy
- [ ] Enable HTTPS
- [ ] Set up logging

### Environment Variables for Production

```env
MONGO_URL=mongodb://production-host:27017
DB_NAME=gowmarket_prod
CORS_ORIGINS=https://gowmarket.uz,https://www.gowmarket.uz
EMERGENT_LLM_KEY=production-key
```

## 📝 License

MIT License - see [LICENSE](../LICENSE) file

## 🤝 Contributing

See main [README](../README.md) for contribution guidelines.
