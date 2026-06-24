from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header, Query, Depends
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import requests
import random
import hashlib
import json
from passlib.context import CryptContext
import pytz

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Timezone
TASHKENT_TZ = pytz.timezone('Asia/Tashkent')

# Pricing constants
AD_PRICE = 4999  # UZS
AD_PRICE_FRIDAY = 2499  # 50% discount on Fridays

def get_current_ad_price():
    """Calculate current ad price based on day of week (Tashkent time)"""
    now = datetime.now(TASHKENT_TZ)
    # Friday = 4 (Monday is 0)
    if now.weekday() == 4:
        return AD_PRICE_FRIDAY
    return AD_PRICE

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "gowmarket"
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logging.error(f"Storage init failed: {e}")
        raise

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserCreate(BaseModel):
    phone: str
    name: str
    password: str

class UserLogin(BaseModel):
    phone: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone: str
    name: str
    role: str = "user"
    created_at: str

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRequest(BaseModel):
    phone: str
    code: str

class OTPVerification(BaseModel):
    phone: str
    code: str
    verified: bool
    expires_at: str

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name_uz: str
    name_ru: str
    icon: str

class AdCreate(BaseModel):
    title: str
    category_id: str
    price: Optional[float] = None
    description: str
    location: dict
    contact_name: str
    contact_phone: str
    contact_methods: List[str]
    can_deliver: bool = False
    characteristics: Optional[dict] = None

class Ad(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    title: str
    category_id: str
    price: Optional[float]
    description: str
    images: List[str]
    location: dict
    contact_name: str
    contact_phone: str
    contact_methods: List[str]
    can_deliver: bool
    characteristics: Optional[dict]
    status: str
    views: int
    created_at: str
    updated_at: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    ad_id: str
    sender_id: str
    receiver_id: str
    content: str
    created_at: str
    read: bool

class MessageCreate(BaseModel):
    ad_id: str
    receiver_id: str
    content: str

class FavoriteToggle(BaseModel):
    ad_id: str

class AdminAction(BaseModel):
    ad_id: str
    action: str

class PaymentCreate(BaseModel):
    ad_id: str
    amount: float
    payment_method: str  # "click"

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    ad_id: str
    user_id: str
    amount: float
    payment_method: str
    status: str  # pending, completed, failed
    transaction_id: Optional[str]
    created_at: str
    completed_at: Optional[str]

# Auth Helper
async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    user = await db.users.find_one({"id": token}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user

# Auth Endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    # Validate Uzbekistan phone number
    if not user_data.phone.startswith("+998") or len(user_data.phone) != 13:
        raise HTTPException(status_code=400, detail="Invalid Uzbekistan phone number. Format: +998 XX XXX XX XX")
    
    existing = await db.users.find_one({"phone": user_data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    
    user = {
        "id": user_id,
        "phone": user_data.phone,
        "name": user_data.name,
        "password": hashed_password,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    
    # Don't return password
    user_response = {k: v for k, v in user.items() if k != "password"}
    return User(**user_response)

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"phone": credentials.phone}, {"_id": 0})
    
    if not user or not user.get("password"):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    
    # Return user without password
    user_response = {k: v for k, v in user.items() if k != "password"}
    return {
        "user": user_response,
        "token": user["id"]
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

# Category Endpoints
@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    return categories

# Ad Endpoints
@api_router.post("/ads", response_model=Ad)
async def create_ad(ad_data: AdCreate, current_user: dict = Depends(get_current_user)):
    ad_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    ad = {
        "id": ad_id,
        "user_id": current_user["id"],
        "title": ad_data.title,
        "category_id": ad_data.category_id,
        "price": ad_data.price,
        "description": ad_data.description,
        "images": [],
        "location": ad_data.location,
        "contact_name": ad_data.contact_name,
        "contact_phone": ad_data.contact_phone,
        "contact_methods": ad_data.contact_methods,
        "can_deliver": ad_data.can_deliver,
        "characteristics": ad_data.characteristics,
        "status": "pending",
        "views": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.ads.insert_one(ad)
    return Ad(**ad)

@api_router.post("/ads/{ad_id}/upload")
async def upload_ad_image(ad_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ad = await db.ads.find_one({"id": ad_id, "user_id": current_user["id"]}, {"_id": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    if len(ad.get("images", [])) >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    path = f"{APP_NAME}/ads/{ad_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    
    if len(data) > 16 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 16MB)")
    
    result = put_object(path, data, file.content_type or "image/jpeg")
    
    await db.ads.update_one(
        {"id": ad_id},
        {"$push": {"images": result["path"]}}
    )
    
    return {"path": result["path"], "size": result["size"]}

@api_router.get("/files/{path:path}")
async def download_file(path: str):
    try:
        data, content_type = get_object(path)
        return Response(content=data, media_type=content_type)
    except:
        raise HTTPException(status_code=404, detail="File not found")

@api_router.get("/ads", response_model=List[Ad])
async def get_ads(
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    status: str = "active",
    limit: int = 20,
    skip: int = 0
):
    query = {"status": status}
    
    if category_id:
        query["category_id"] = category_id
    
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    
    ads = await db.ads.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return ads

@api_router.get("/ads/{ad_id}", response_model=Ad)
async def get_ad(ad_id: str):
    ad = await db.ads.find_one({"id": ad_id}, {"_id": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    await db.ads.update_one({"id": ad_id}, {"$inc": {"views": 1}})
    
    return Ad(**ad)

@api_router.get("/users/me/ads", response_model=List[Ad])
async def get_my_ads(current_user: dict = Depends(get_current_user)):
    ads = await db.ads.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return ads

# Favorites
@api_router.post("/favorites/toggle")
async def toggle_favorite(data: FavoriteToggle, current_user: dict = Depends(get_current_user)):
    existing = await db.favorites.find_one({
        "user_id": current_user["id"],
        "ad_id": data.ad_id
    })
    
    if existing:
        await db.favorites.delete_one({"user_id": current_user["id"], "ad_id": data.ad_id})
        return {"favorited": False}
    else:
        await db.favorites.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "ad_id": data.ad_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"favorited": True}

@api_router.get("/favorites", response_model=List[Ad])
async def get_favorites(current_user: dict = Depends(get_current_user)):
    favorites = await db.favorites.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    ad_ids = [f["ad_id"] for f in favorites]
    
    if not ad_ids:
        return []
    
    ads = await db.ads.find({"id": {"$in": ad_ids}}, {"_id": 0}).to_list(100)
    return ads

# Messages
@api_router.post("/messages", response_model=Message)
async def send_message(msg_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    msg_id = str(uuid.uuid4())
    message = {
        "id": msg_id,
        "ad_id": msg_data.ad_id,
        "sender_id": current_user["id"],
        "receiver_id": msg_data.receiver_id,
        "content": msg_data.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    await db.messages.insert_one(message)
    return Message(**message)

@api_router.get("/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["id"]},
            {"receiver_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Collect unique IDs to avoid N+1 queries
    user_ids = set()
    ad_ids = set()
    for msg in messages:
        other_user_id = msg["receiver_id"] if msg["sender_id"] == current_user["id"] else msg["sender_id"]
        user_ids.add(other_user_id)
        ad_ids.add(msg["ad_id"])
    
    # Bulk fetch users and ads
    users = await db.users.find({"id": {"$in": list(user_ids)}}, {"_id": 0}).to_list(len(user_ids)) if user_ids else []
    ads = await db.ads.find({"id": {"$in": list(ad_ids)}}, {"_id": 0}).to_list(len(ad_ids)) if ad_ids else []
    
    # Create lookup dictionaries
    users_dict = {u["id"]: u for u in users}
    ads_dict = {a["id"]: a for a in ads}
    
    conversations = {}
    for msg in messages:
        other_user_id = msg["receiver_id"] if msg["sender_id"] == current_user["id"] else msg["sender_id"]
        
        if other_user_id not in conversations:
            conversations[other_user_id] = {
                "user": users_dict.get(other_user_id),
                "ad": ads_dict.get(msg["ad_id"]),
                "last_message": msg
            }
    
    return list(conversations.values())

@api_router.get("/messages/{other_user_id}", response_model=List[Message])
async def get_messages(other_user_id: str, ad_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "ad_id": ad_id,
        "$or": [
            {"sender_id": current_user["id"], "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    await db.messages.update_many(
        {"sender_id": other_user_id, "receiver_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return messages

# Payment Endpoints
@api_router.get("/payment/price")
async def get_ad_price():
    """Get current ad price (includes Friday discount in Tashkent timezone)"""
    price = get_current_ad_price()
    now = datetime.now(TASHKENT_TZ)
    is_friday = now.weekday() == 4
    return {
        "price": price,
        "original_price": AD_PRICE,
        "discount": 50 if is_friday else 0,
        "is_friday": is_friday,
        "current_time": now.strftime("%Y-%m-%d %H:%M:%S %Z")
    }

@api_router.post("/payment/create", response_model=Payment)
async def create_payment(payment_data: PaymentCreate, current_user: dict = Depends(get_current_user)):
    """Create payment for ad"""
    ad = await db.ads.find_one({"id": payment_data.ad_id, "user_id": current_user["id"]}, {"_id": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    payment_id = str(uuid.uuid4())
    payment = {
        "id": payment_id,
        "ad_id": payment_data.ad_id,
        "user_id": current_user["id"],
        "amount": payment_data.amount,
        "payment_method": payment_data.payment_method,
        "status": "pending",
        "transaction_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    
    await db.payments.insert_one(payment)
    return Payment(**payment)

@api_router.post("/payment/{payment_id}/complete")
async def complete_payment(payment_id: str, transaction_id: str, current_user: dict = Depends(get_current_user)):
    """Complete payment and activate ad"""
    payment = await db.payments.find_one({"id": payment_id, "user_id": current_user["id"]}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update payment
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": "completed", "transaction_id": transaction_id, "completed_at": now}}
    )
    
    # Activate ad (set to pending for admin approval)
    await db.ads.update_one(
        {"id": payment["ad_id"]},
        {"$set": {"status": "pending", "paid": True, "paid_at": now}}
    )
    
    return {"status": "success", "message": "Payment completed"}

# Admin Endpoints
@api_router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_ads = await db.ads.count_documents({})
    active_ads = await db.ads.count_documents({"status": "active"})
    pending_ads = await db.ads.count_documents({"status": "pending"})
    rejected_ads = await db.ads.count_documents({"status": "rejected"})
    
    # Payment statistics
    completed_payments = await db.payments.find({"status": "completed"}, {"_id": 0}).to_list(1000)
    total_revenue = sum(p["amount"] for p in completed_payments)
    
    # Daily revenue
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    daily_payments = [p for p in completed_payments if datetime.fromisoformat(p["completed_at"]) >= today_start]
    daily_revenue = sum(p["amount"] for p in daily_payments)
    
    # Weekly revenue
    week_start = today_start - timedelta(days=today_start.weekday())
    weekly_payments = [p for p in completed_payments if datetime.fromisoformat(p["completed_at"]) >= week_start]
    weekly_revenue = sum(p["amount"] for p in weekly_payments)
    
    # Monthly revenue
    month_start = today_start.replace(day=1)
    monthly_payments = [p for p in completed_payments if datetime.fromisoformat(p["completed_at"]) >= month_start]
    monthly_revenue = sum(p["amount"] for p in monthly_payments)
    
    return {
        "total_users": total_users,
        "total_ads": total_ads,
        "active_ads": active_ads,
        "pending_ads": pending_ads,
        "rejected_ads": rejected_ads,
        "total_revenue": total_revenue,
        "daily_revenue": daily_revenue,
        "weekly_revenue": weekly_revenue,
        "monthly_revenue": monthly_revenue,
        "new_users_today": 0,  # TODO: implement
        "online_users": 0  # TODO: implement
    }

@api_router.post("/admin/ads/action")
async def admin_ad_action(action: AdminAction, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if action.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    status = "active" if action.action == "approve" else "rejected"
    
    result = await db.ads.update_one(
        {"id": action.ad_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    return {"status": status}

@api_router.get("/admin/ads", response_model=List[Ad])
async def get_admin_ads(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    ads = await db.ads.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return ads

@api_router.get("/admin/payments")
async def get_admin_payments(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payments = await db.payments.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payments

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init failed (will retry on first use): {e}")
    
    try:
        # Create default categories
        categories_exist = await db.categories.count_documents({})
        if categories_exist == 0:
            categories = [
                {"id": str(uuid.uuid4()), "name_uz": "Telefonlar", "name_ru": "Телефоны", "icon": "smartphone"},
                {"id": str(uuid.uuid4()), "name_uz": "Elektronika", "name_ru": "Электроника", "icon": "laptop"},
                {"id": str(uuid.uuid4()), "name_uz": "Kompyuterlar", "name_ru": "Компьютеры", "icon": "monitor"},
                {"id": str(uuid.uuid4()), "name_uz": "Avtomobillar", "name_ru": "Автомобили", "icon": "car"},
                {"id": str(uuid.uuid4()), "name_uz": "Ko'chmas mulk", "name_ru": "Недвижимость", "icon": "home"},
                {"id": str(uuid.uuid4()), "name_uz": "Ish o'rinlari", "name_ru": "Вакансии", "icon": "briefcase"},
                {"id": str(uuid.uuid4()), "name_uz": "Kiyimlar", "name_ru": "Одежда", "icon": "shirt"},
                {"id": str(uuid.uuid4()), "name_uz": "Xizmatlar", "name_ru": "Услуги", "icon": "wrench"},
                {"id": str(uuid.uuid4()), "name_uz": "Sport", "name_ru": "Спорт", "icon": "dumbbell"},
                {"id": str(uuid.uuid4()), "name_uz": "Boshqalar", "name_ru": "Другое", "icon": "package"}
            ]
            await db.categories.insert_many(categories)
            logger.info("Default categories created")
        
        # Delete all existing admin accounts and test users
        await db.users.delete_many({"role": "admin"})
        await db.users.delete_many({"phone": "+998945778512"})  # Clear admin phone collisions
        await db.users.delete_many({"phone": {"$regex": "^\\+998901"}})  # Remove test accounts
        
        # Create THE ONLY admin user
        admin_id = str(uuid.uuid4())
        admin_password = hash_password("adminq")
        await db.users.insert_one({
            "id": admin_id,
            "phone": "+998945778512",
            "name": "Administrator",
            "password": admin_password,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Admin user created: +998945778512 / password: adminq / token: " + admin_id)
            
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
