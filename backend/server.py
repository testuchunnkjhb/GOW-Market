from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field, validator, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient, ASCENDING, DESCENDING, IndexModel
from pymongo.errors import PyMongoError, DuplicateKeyError
import motor.motor_asyncio
import jwt
import bcrypt
import os
import shutil
import uuid
import time
import re
import json
from collections import defaultdict
from functools import wraps
import asyncio
from pathlib import Path
import hashlib
from PIL import Image

# ==================== CONFIGURATION ====================
SECRET_KEY = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
REFRESH_TOKEN_EXPIRE_DAYS = 30
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
RATE_LIMIT_REQUESTS = 60
RATE_LIMIT_WINDOW = 60  # seconds

# ==================== MONGODB CONNECTION ====================
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "gow_market")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
ads_collection = db["ads"]
users_collection = db["users"]
categories_collection = db["categories"]
favorites_collection = db["favorites"]
messages_collection = db["messages"]

# ==================== INDEXES ====================
async def create_indexes():
    """Create indexes for performance optimization"""
    try:
        # Ads indexes
        await ads_collection.create_index([("category_id", ASCENDING)])
        await ads_collection.create_index([("created_at", DESCENDING)])
        await ads_collection.create_index([("status", ASCENDING)])
        await ads_collection.create_index([("user_id", ASCENDING)])
        await ads_collection.create_index([("created_at", DESCENDING), ("status", ASCENDING)])
        
        # Users indexes
        await users_collection.create_index([("phone", ASCENDING)], unique=True)
        await users_collection.create_index([("email", ASCENDING)], unique=True)
        
        # Favorites indexes
        await favorites_collection.create_index([("user_id", ASCENDING), ("ad_id", ASCENDING)], unique=True)
        
        # Messages indexes
        await messages_collection.create_index([("sender_id", ASCENDING)])
        await messages_collection.create_index([("receiver_id", ASCENDING)])
        await messages_collection.create_index([("ad_id", ASCENDING)])
        await messages_collection.create_index([("created_at", DESCENDING)])
        
        # Categories indexes
        await categories_collection.create_index([("name_uz", ASCENDING)])
        await categories_collection.create_index([("name_ru", ASCENDING)])
        
        print("✅ Indexes created successfully")
    except Exception as e:
        print(f"⚠️ Index creation error: {e}")

# ==================== SAFE HELPERS ====================
def safe_id(id_str: str) -> Optional[ObjectId]:
    """Safely convert string to ObjectId"""
    if not id_str:
        return None
    try:
        return ObjectId(id_str)
    except:
        return None

def safe_mongo_doc(doc: Optional[Dict]) -> Optional[Dict]:
    """Safely convert MongoDB document to dict with string IDs"""
    if not doc:
        return None
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

def safe_mongo_list(docs: Optional[List]) -> List[Dict]:
    """Safely convert MongoDB cursor/list to list of dicts with string IDs"""
    if not docs:
        return []
    result = []
    try:
        for doc in docs:
            if doc:
                doc_copy = dict(doc)
                if "_id" in doc_copy:
                    doc_copy["id"] = str(doc_copy.pop("_id"))
                result.append(doc_copy)
    except Exception:
        return []
    return result

def safe_str(value: Any, default: str = "") -> str:
    """Safely convert value to string"""
    if value is None:
        return default
    try:
        return str(value)
    except:
        return default

def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert value to int"""
    if value is None:
        return default
    try:
        return int(value)
    except:
        return default

def safe_float(value: Any, default: float = 0.0) -> float:
    """Safely convert value to float"""
    if value is None:
        return default
    try:
        return float(value)
    except:
        return default

def safe_bool(value: Any, default: bool = False) -> bool:
    """Safely convert value to bool"""
    if value is None:
        return default
    try:
        return bool(value)
    except:
        return default

def safe_datetime(dt: Any) -> Optional[datetime]:
    """Safely convert to datetime"""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt
    if isinstance(dt, str):
        try:
            return datetime.fromisoformat(dt)
        except:
            return None
    return None

def safe_now() -> datetime:
    """Get current datetime safely"""
    try:
        return datetime.utcnow()
    except:
        return datetime.now()

def safe_list(data: Any) -> List:
    """Safely convert to list"""
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return list(data.values())
    try:
        return list(data)
    except:
        return []

def safe_dict(data: Any) -> Dict:
    """Safely convert to dict"""
    if data is None:
        return {}
    if isinstance(data, dict):
        return data
    try:
        return dict(data)
    except:
        return {}

def safe_get(data: Dict, key: str, default: Any = None) -> Any:
    """Safely get value from dict with default"""
    if not isinstance(data, dict):
        return default
    return data.get(key, default)

def safe_find_one(collection, filter_dict: Dict) -> Optional[Dict]:
    """Safely find one document"""
    try:
        doc = await collection.find_one(filter_dict)
        return safe_mongo_doc(doc)
    except:
        return None

def safe_find(collection, filter_dict: Dict, **kwargs) -> List[Dict]:
    """Safely find documents"""
    try:
        cursor = collection.find(filter_dict, **kwargs)
        docs = await cursor.to_list(length=None)
        return safe_mongo_list(docs)
    except:
        return []

def safe_insert_one(collection, document: Dict) -> Optional[str]:
    """Safely insert one document"""
    try:
        result = await collection.insert_one(document)
        return str(result.inserted_id) if result.inserted_id else None
    except:
        return None

def safe_update_one(collection, filter_dict: Dict, update_dict: Dict) -> bool:
    """Safely update one document"""
    try:
        result = await collection.update_one(filter_dict, update_dict)
        return result.modified_count > 0
    except:
        return False

def safe_delete_one(collection, filter_dict: Dict) -> bool:
    """Safely delete one document"""
    try:
        result = await collection.delete_one(filter_dict)
        return result.deleted_count > 0
    except:
        return False

# ==================== RATE LIMITING ====================
rate_limit_store = defaultdict(list)

async def rate_limit_middleware(request: Request, call_next):
    """Rate limiting middleware - 60 requests per minute per IP"""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    # Clean old requests
    rate_limit_store[client_ip] = [
        req_time for req_time in rate_limit_store[client_ip]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    
    # Check rate limit
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"success": False, "error": "Too many requests. Please try again later."}
        )
    
    # Add current request
    rate_limit_store[client_ip].append(now)
    
    # Process request
    response = await call_next(request)
    return response

# ==================== LOGGING MIDDLEWARE ====================
async def logging_middleware(request: Request, call_next):
    """Request logging middleware"""
    start_time = time.time()
    
    # Get request details
    method = request.method
    path = request.url.path
    client_ip = request.client.host if request.client else "unknown"
    
    # Process request
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as e:
        status_code = 500
        raise
    
    # Calculate duration
    duration = (time.time() - start_time) * 1000
    
    # Log
    print(f"[{datetime.now().isoformat()}] {method} {path} | {status_code} | {duration:.2f}ms | IP: {client_ip}")
    
    return response

# ==================== JWT AUTH ====================
def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = safe_now() + expires_delta
    else:
        expire = safe_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except:
        return None

def verify_token(token: str) -> Optional[Dict]:
    """Verify JWT token"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except:
        return None

async def get_current_user(token: Optional[str] = None) -> Optional[Dict]:
    """Get current user from token"""
    if not token:
        return None
    
    # Remove "Bearer " prefix if present
    if token.startswith("Bearer "):
        token = token[7:]
    
    payload = verify_token(token)
    if not payload:
        return None
    
    user_id = safe_get(payload, "sub")
    if not user_id:
        return None
    
    # Get user from database
    user = await safe_find_one(users_collection, {"_id": safe_id(user_id)})
    return user

async def get_current_user_optional(request: Request) -> Optional[Dict]:
    """Get current user from request header (optional)"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    return await get_current_user(auth_header)

async def get_current_user_required(request: Request) -> Dict:
    """Get current user from request header (required)"""
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ==================== PYDANTIC MODELS ====================
class UserCreate(BaseModel):
    phone: str = Field(..., min_length=5, max_length=20, description="Phone number")
    password: str = Field(..., min_length=6, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = Field("user", pattern="^(user|admin)$")
    
    @validator('phone')
    def validate_phone(cls, v):
        if not v or len(v.strip()) < 5:
            raise ValueError('Phone number is too short')
        return v.strip()
    
    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v

class UserLogin(BaseModel):
    phone: str = Field(..., min_length=5, max_length=20)
    password: str = Field(..., min_length=6, max_length=100)

class AdCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
    price: Optional[float] = Field(None, ge=0, le=999999999999)
    category_id: str = Field(..., min_length=1)
    contact_name: str = Field(..., min_length=1, max_length=100)
    contact_phone: str = Field(..., min_length=5, max_length=20)
    contact_methods: List[str] = Field(default=["chat", "call"])
    location: Optional[Dict] = Field(default_factory=dict)
    can_deliver: bool = Field(default=False)
    characteristics: Optional[Dict] = Field(default_factory=dict)
    
    @validator('category_id')
    def validate_category_id(cls, v):
        if not safe_id(v):
            raise ValueError('Invalid category ID')
        return v
    
    @validator('contact_phone')
    def validate_contact_phone(cls, v):
        if not v or len(v.strip()) < 5:
            raise ValueError('Phone number is too short')
        return v.strip()

class AdUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=5, max_length=5000)
    price: Optional[float] = Field(None, ge=0, le=999999999999)
    category_id: Optional[str] = Field(None, min_length=1)
    contact_name: Optional[str] = Field(None, min_length=1, max_length=100)
    contact_phone: Optional[str] = Field(None, min_length=5, max_length=20)
    contact_methods: Optional[List[str]] = None
    location: Optional[Dict] = None
    can_deliver: Optional[bool] = None
    characteristics: Optional[Dict] = None
    status: Optional[str] = Field(None, pattern="^(active|inactive|sold)$")
    
    @validator('category_id')
    def validate_category_id(cls, v):
        if v and not safe_id(v):
            raise ValueError('Invalid category ID')
        return v

class CategoryCreate(BaseModel):
    name_uz: str = Field(..., min_length=1, max_length=100)
    name_ru: str = Field(..., min_length=1, max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    order: Optional[int] = Field(0, ge=0)

class FavoriteToggle(BaseModel):
    ad_id: str = Field(..., min_length=1)
    
    @validator('ad_id')
    def validate_ad_id(cls, v):
        if not safe_id(v):
            raise ValueError('Invalid ad ID')
        return v

class MessageCreate(BaseModel):
    ad_id: str = Field(..., min_length=1)
    receiver_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1, max_length=5000)
    
    @validator('ad_id', 'receiver_id')
    def validate_ids(cls, v):
        if not safe_id(v):
            raise ValueError('Invalid ID')
        return v

# ==================== API ROUTES ====================
app = FastAPI(
    title="GOW Market API",
    version="1.0.0",
    description="Production-ready marketplace API"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://gow-market.vercel.app",
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted Hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "localhost",
        "127.0.0.1",
        "*.vercel.app",
        "gow-market.vercel.app"
    ]
)

# Custom Middleware
app.middleware("http")(rate_limit_middleware)
app.middleware("http")(logging_middleware)

# ==================== GLOBAL ERROR HANDLER ====================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global error handler for all exceptions"""
    error_msg = str(exc) if str(exc) else "Internal server error"
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": error_msg}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.detail}
    )

# ==================== HEALTH CHECK ====================
@app.get("/", response_model=Dict)
@app.get("/health", response_model=Dict)
async def health_check():
    """Health check endpoint"""
    return {
        "success": True,
        "status": "healthy",
        "timestamp": safe_now().isoformat(),
        "version": "1.0.0"
    }

# ==================== AUTH ENDPOINTS ====================
@app.post("/api/auth/register", response_model=Dict)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    try:
        # Check if user exists
        existing_user = await safe_find_one(users_collection, {"phone": user_data.phone})
        if existing_user:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        
        # Hash password
        hashed_password = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt())
        
        # Create user
        user_dict = {
            "phone": user_data.phone,
            "password": hashed_password.decode(),
            "name": user_data.name,
            "email": user_data.email,
            "role": user_data.role or "user",
            "created_at": safe_now(),
            "updated_at": safe_now(),
            "is_active": True,
            "last_login": None
        }
        
        user_id = await safe_insert_one(users_collection, user_dict)
        if not user_id:
            raise HTTPException(status_code=500, detail="Failed to create user")
        
        # Get created user
        user = await safe_find_one(users_collection, {"_id": safe_id(user_id)})
        
        # Create access token
        token = create_access_token({"sub": user_id})
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate token")
        
        return {
            "success": True,
            "data": {
                "user": user,
                "token": token
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/login", response_model=Dict)
async def login_user(login_data: UserLogin):
    """Login user"""
    try:
        # Find user
        user = await safe_find_one(users_collection, {"phone": login_data.phone})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid phone or password")
        
        # Verify password
        if not bcrypt.checkpw(login_data.password.encode(), user.get("password", "").encode()):
            raise HTTPException(status_code=401, detail="Invalid phone or password")
        
        # Update last login
        await safe_update_one(
            users_collection,
            {"_id": safe_id(user.get("id"))},
            {"$set": {"last_login": safe_now()}}
        )
        
        # Create token
        token = create_access_token({"sub": user.get("id")})
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate token")
        
        return {
            "success": True,
            "data": {
                "user": user,
                "token": token
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.get("/api/auth/me", response_model=Dict)
async def get_me(request: Request):
    """Get current user info"""
    try:
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        return {
            "success": True,
            "data": user
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user info: {str(e)}")

# ==================== CATEGORY ENDPOINTS ====================
@app.get("/api/categories", response_model=Dict)
async def get_categories():
    """Get all categories"""
    try:
        categories = await safe_find(categories_collection, {}, sort=[("order", ASCENDING)])
        
        return {
            "success": True,
            "data": categories
        }
    except Exception as e:
        print(f"Error fetching categories: {e}")
        return {
            "success": True,
            "data": []
        }

@app.post("/api/categories", response_model=Dict)
async def create_category(category_data: CategoryCreate, request: Request):
    """Create a new category (admin only)"""
    try:
        # Check if admin
        user = await get_current_user_optional(request)
        if not user or user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Create category
        category_dict = {
            "name_uz": category_data.name_uz,
            "name_ru": category_data.name_ru,
            "icon": category_data.icon,
            "order": category_data.order or 0,
            "created_at": safe_now(),
            "updated_at": safe_now()
        }
        
        category_id = await safe_insert_one(categories_collection, category_dict)
        if not category_id:
            raise HTTPException(status_code=500, detail="Failed to create category")
        
        category = await safe_find_one(categories_collection, {"_id": safe_id(category_id)})
        
        return {
            "success": True,
            "data": category
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")

# ==================== AD ENDPOINTS ====================
@app.get("/api/ads", response_model=Dict)
async def get_ads(
    limit: Optional[int] = 20,
    offset: Optional[int] = 0,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = "active",
    request: Request = None
):
    """Get ads with filtering and pagination"""
    try:
        # Build filter
        filter_dict = {}
        if status:
            filter_dict["status"] = status
        if category_id and safe_id(category_id):
            filter_dict["category_id"] = category_id
        if user_id and safe_id(user_id):
            filter_dict["user_id"] = user_id
        
        # Search
        if search:
            filter_dict["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
        
        # Pagination
        limit = safe_int(limit, 20)
        offset = safe_int(offset, 0)
        if limit > 100:
            limit = 100
        
        # Get ads
        ads = await safe_find(
            ads_collection,
            filter_dict,
            sort=[("created_at", DESCENDING)],
            skip=offset,
            limit=limit
        )
        
        # Increment views for each ad (optional)
        # Could be done asynchronously
        
        return {
            "success": True,
            "data": ads,
            "pagination": {
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        print(f"Error fetching ads: {e}")
        return {
            "success": True,
            "data": [],
            "pagination": {
                "limit": 20,
                "offset": 0
            }
        }

@app.get("/api/ads/{ad_id}", response_model=Dict)
async def get_ad(ad_id: str):
    """Get ad by ID"""
    try:
        if not safe_id(ad_id):
            raise HTTPException(status_code=400, detail="Invalid ad ID")
        
        ad = await safe_find_one(ads_collection, {"_id": safe_id(ad_id)})
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Increment views
        await safe_update_one(
            ads_collection,
            {"_id": safe_id(ad_id)},
            {"$inc": {"views": 1}}
        )
        ad["views"] = safe_int(ad.get("views", 0)) + 1
        
        return {
            "success": True,
            "data": ad
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get ad: {str(e)}")

@app.post("/api/ads", response_model=Dict)
async def create_ad(
    request: Request,
    title: str = Form(...),
    description: str = Form(...),
    price: Optional[float] = Form(None),
    category_id: str = Form(...),
    contact_name: str = Form(...),
    contact_phone: str = Form(...),
    contact_methods: str = Form("chat,call"),
    location: str = Form("{}"),
    can_deliver: bool = Form(False),
    characteristics: str = Form("{}"),
    images: List[UploadFile] = File([])
):
    """Create a new ad"""
    try:
        # Get current user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Validate category
        if not safe_id(category_id):
            raise HTTPException(status_code=400, detail="Invalid category ID")
        
        category = await safe_find_one(categories_collection, {"_id": safe_id(category_id)})
        if not category:
            raise HTTPException(status_code=400, detail="Category not found")
        
        # Parse JSON fields
        try:
            location_dict = json.loads(location) if location else {}
        except:
            location_dict = {}
        
        try:
            characteristics_dict = json.loads(characteristics) if characteristics else {}
        except:
            characteristics_dict = {}
        
        contact_methods_list = [m.strip() for m in contact_methods.split(",") if m.strip()]
        if not contact_methods_list:
            contact_methods_list = ["chat", "call"]
        
        # Process images
        image_filenames = []
        for image in images[:5]:  # Max 5 images
            if not image.filename:
                continue
            
            # Validate file
            ext = Path(image.filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                continue
            
            # Check size
            content = await image.read()
            if len(content) > MAX_FILE_SIZE:
                continue
            
            # Generate safe filename
            file_hash = hashlib.md5(content).hexdigest()[:8]
            safe_name = f"{file_hash}_{uuid.uuid4().hex[:8]}{ext}"
            
            # Save file
            upload_dir = Path("uploads")
            upload_dir.mkdir(exist_ok=True)
            
            file_path = upload_dir / safe_name
            with open(file_path, "wb") as f:
                f.write(content)
            
            image_filenames.append(safe_name)
        
        # Create ad
        ad_dict = {
            "title": title,
            "description": description,
            "price": price,
            "category_id": category_id,
            "user_id": user.get("id"),
            "contact_name": contact_name,
            "contact_phone": contact_phone,
            "contact_methods": contact_methods_list,
            "location": location_dict,
            "can_deliver": can_deliver,
            "characteristics": characteristics_dict,
            "images": image_filenames,
            "views": 0,
            "status": "active",
            "created_at": safe_now(),
            "updated_at": safe_now()
        }
        
        ad_id = await safe_insert_one(ads_collection, ad_dict)
        if not ad_id:
            raise HTTPException(status_code=500, detail="Failed to create ad")
        
        ad = await safe_find_one(ads_collection, {"_id": safe_id(ad_id)})
        
        return {
            "success": True,
            "data": ad
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create ad: {str(e)}")

@app.put("/api/ads/{ad_id}", response_model=Dict)
async def update_ad(ad_id: str, ad_data: AdUpdate, request: Request):
    """Update an ad"""
    try:
        if not safe_id(ad_id):
            raise HTTPException(status_code=400, detail="Invalid ad ID")
        
        # Get user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Get ad
        ad = await safe_find_one(ads_collection, {"_id": safe_id(ad_id)})
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Check ownership
        if ad.get("user_id") != user.get("id") and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to update this ad")
        
        # Build update
        update_dict = {}
        for field, value in ad_data.dict(exclude_unset=True).items():
            if value is not None:
                update_dict[field] = value
        
        if not update_dict:
            return {"success": True, "data": ad}
        
        update_dict["updated_at"] = safe_now()
        
        # Update
        updated = await safe_update_one(
            ads_collection,
            {"_id": safe_id(ad_id)},
            {"$set": update_dict}
        )
        
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update ad")
        
        updated_ad = await safe_find_one(ads_collection, {"_id": safe_id(ad_id)})
        
        return {
            "success": True,
            "data": updated_ad
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update ad: {str(e)}")

@app.delete("/api/ads/{ad_id}", response_model=Dict)
async def delete_ad(ad_id: str, request: Request):
    """Delete an ad"""
    try:
        if not safe_id(ad_id):
            raise HTTPException(status_code=400, detail="Invalid ad ID")
        
        # Get user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Get ad
        ad = await safe_find_one(ads_collection, {"_id": safe_id(ad_id)})
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Check ownership
        if ad.get("user_id") != user.get("id") and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not authorized to delete this ad")
        
        # Delete
        deleted = await safe_delete_one(ads_collection, {"_id": safe_id(ad_id)})
        
        if not deleted:
            raise HTTPException(status_code=500, detail="Failed to delete ad")
        
        return {
            "success": True,
            "message": "Ad deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete ad: {str(e)}")

# ==================== FAVORITE ENDPOINTS ====================
@app.post("/api/favorites/toggle", response_model=Dict)
async def toggle_favorite(favorite_data: FavoriteToggle, request: Request):
    """Toggle favorite status for an ad"""
    try:
        # Get user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Validate ad
        if not safe_id(favorite_data.ad_id):
            raise HTTPException(status_code=400, detail="Invalid ad ID")
        
        ad = await safe_find_one(ads_collection, {"_id": safe_id(favorite_data.ad_id)})
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        user_id = user.get("id")
        
        # Check if favorited
        existing = await safe_find_one(
            favorites_collection,
            {"user_id": user_id, "ad_id": favorite_data.ad_id}
        )
        
        if existing:
            # Remove favorite
            await safe_delete_one(
                favorites_collection,
                {"user_id": user_id, "ad_id": favorite_data.ad_id}
            )
            return {
                "success": True,
                "data": {"favorited": False}
            }
        else:
            # Add favorite
            favorite_dict = {
                "user_id": user_id,
                "ad_id": favorite_data.ad_id,
                "created_at": safe_now()
            }
            await safe_insert_one(favorites_collection, favorite_dict)
            return {
                "success": True,
                "data": {"favorited": True}
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")

@app.get("/api/favorites", response_model=Dict)
async def get_favorites(request: Request):
    """Get user's favorite ads"""
    try:
        # Get user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id = user.get("id")
        
        # Get favorites
        favorites = await safe_find(
            favorites_collection,
            {"user_id": user_id}
        )
        
        # Get ad details
        ad_ids = [f.get("ad_id") for f in favorites if f.get("ad_id")]
        ads = []
        for ad_id in ad_ids:
            if safe_id(ad_id):
                ad = await safe_find_one(ads_collection, {"_id": safe_id(ad_id)})
                if ad:
                    ads.append(ad)
        
        return {
            "success": True,
            "data": ads
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get favorites: {str(e)}")

# ==================== MESSAGE ENDPOINTS ====================
@app.get("/api/messages", response_model=Dict)
async def get_messages(request: Request):
    """Get user's messages"""
    try:
        # Get user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        user_id = user.get("id")
        
        # Get messages
        messages = await safe_find(
            messages_collection,
            {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]},
            sort=[("created_at", DESCENDING)]
        )
        
        return {
            "success": True,
            "data": messages
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@app.post("/api/messages", response_model=Dict)
async def send_message(message_data: MessageCreate, request: Request):
    """Send a message"""
    try:
        # Get user
        user = await get_current_user_optional(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Validate receiver
        if not safe_id(message_data.receiver_id):
            raise HTTPException(status_code=400, detail="Invalid receiver ID")
        
        receiver = await safe_find_one(users_collection, {"_id": safe_id(message_data.receiver_id)})
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")
        
        # Validate ad
        if not safe_id(message_data.ad_id):
            raise HTTPException(status_code=400, detail="Invalid ad ID")
        
        ad = await safe_find_one(ads_collection, {"_id": safe_id(message_data.ad_id)})
        if not ad:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        user_id = user.get("id")
        
        # Create message
        message_dict = {
            "ad_id": message_data.ad_id,
            "sender_id": user_id,
            "receiver_id": message_data.receiver_id,
            "text": message_data.text,
            "read": False,
            "created_at": safe_now(),
            "updated_at": safe_now()
        }
        
        message_id = await safe_insert_one(messages_collection, message_dict)
        if not message_id:
            raise HTTPException(status_code=500, detail="Failed to send message")
        
        message = await safe_find_one(messages_collection, {"_id": safe_id(message_id)})
        
        return {
            "success": True,
            "data": message
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

# ==================== UPLOAD ENDPOINTS ====================
@app.get("/api/files/{filename}", response_model=Any)
async def get_file(filename: str):
    """Get uploaded file"""
    try:
        # Security: prevent directory traversal
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        file_path = Path("uploads") / filename
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file: {str(e)}")

@app.post("/api/upload", response_model=Dict)
async def upload_file(file: UploadFile = File(...), request: Request = None):
    """Upload a file"""
    try:
        # Check authentication
        if request:
            user = await get_current_user_optional(request)
            if not user:
                raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Check extension
        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Check content
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Verify image
        try:
            Image.open(content)
        except:
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Generate safe filename
        file_hash = hashlib.md5(content).hexdigest()[:8]
        safe_name = f"{file_hash}_{uuid.uuid4().hex[:8]}{ext}"
        
        # Save file
        upload_dir = Path("uploads")
        upload_dir.mkdir(exist_ok=True)
        
        file_path = upload_dir / safe_name
        with open(file_path, "wb") as f:
            f.write(content)
        
        return {
            "success": True,
            "data": {
                "filename": safe_name,
                "url": f"/api/files/{safe_name}",
                "size": len(content)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

# ==================== STARTUP ====================
@app.on_event("startup")
async def startup_event():
    """Startup tasks"""
    print("🚀 Starting GOW Market API...")
    await create_indexes()
    print("✅ API started successfully")

# ==================== MAIN ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=4
    )
