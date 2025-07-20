from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import cloudinary
import cloudinary.uploader
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import base64
import io
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cloudinary configuration
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME', 'demo'),
    api_key=os.environ.get('CLOUDINARY_API_KEY', 'demo'),  
    api_secret=os.environ.get('CLOUDINARY_API_SECRET', 'demo')
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class WaterloggingReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lat: float
    lng: float
    severity: str = Field(default="Medium")  # Low, Medium, Severe
    image_url: Optional[str] = None  # New field for photo URL
    image_base64: Optional[str] = None  # Base64 for display when Cloudinary unavailable
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=1))
    accuracy_score: int = Field(default=0)  # For voting system
    total_votes: int = Field(default=0)

class WaterloggingReportCreate(BaseModel):
    lat: float
    lng: float
    severity: str = "Medium"
    image_base64: Optional[str] = None  # For photo upload

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    report_id: str
    text: str = Field(max_length=200)
    author: str = Field(default="Anonymous")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CommentCreate(BaseModel):
    text: str = Field(max_length=200)
    author: Optional[str] = "Anonymous"

class VoteRequest(BaseModel):
    vote_type: str  # "up" or "down"

class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Helper function for image upload
async def upload_image_to_cloudinary(image_base64: str) -> str:
    """Upload base64 image to Cloudinary and return URL"""
    try:
        # Check if Cloudinary is configured
        if (os.environ.get('CLOUDINARY_CLOUD_NAME', 'demo') == 'demo' or
            os.environ.get('CLOUDINARY_API_KEY', 'demo') == 'demo' or  
            os.environ.get('CLOUDINARY_API_SECRET', 'demo') == 'demo'):
            logger.warning("Cloudinary not configured - using base64 storage")
            return None
            
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            image_base64,
            folder="aquaroute_reports",
            resource_type="image",
            transformation=[
                {"width": 800, "height": 600, "crop": "limit"},
                {"quality": "auto:good"}
            ]
        )
        return result.get("secure_url")
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}")
        return None

# Waterlogging report routes
@api_router.get("/reports", response_model=List[WaterloggingReport])
async def get_waterlogging_reports(time_filter: Optional[str] = None):
    """Get all active waterlogging reports with optional time filtering"""
    current_time = datetime.utcnow()
    
    # Remove expired reports
    await db.waterlogging_reports.delete_many({"expires_at": {"$lt": current_time}})
    
    # Build query based on time filter
    query = {"expires_at": {"$gte": current_time}}
    
    if time_filter:
        if time_filter == "1h":
            time_threshold = current_time - timedelta(hours=1)
        elif time_filter == "6h":
            time_threshold = current_time - timedelta(hours=6)
        elif time_filter == "24h":
            time_threshold = current_time - timedelta(hours=24)
        else:
            time_threshold = current_time - timedelta(hours=24)  # Default to 24h
            
        query["created_at"] = {"$gte": time_threshold}
    
    # Get remaining active reports
    reports = await db.waterlogging_reports.find(query).to_list(1000)
    return [WaterloggingReport(**report) for report in reports]

@api_router.post("/reports", response_model=WaterloggingReport)
async def create_waterlogging_report(report: WaterloggingReportCreate):
    """Create a new waterlogging report with optional photo"""
    # Validate severity
    if report.severity not in ["Low", "Medium", "Severe"]:
        raise HTTPException(status_code=400, detail="Severity must be Low, Medium, or Severe")
    
    # Create report with auto-expire
    report_data = report.dict()
    
    # Handle image upload if provided
    image_url = None
    if report.image_base64:
        try:
            # Try to upload to Cloudinary
            image_url = await upload_image_to_cloudinary(report.image_base64)
            if image_url:
                report_data["image_url"] = image_url
                # Remove base64 data if successfully uploaded to cloud
                report_data.pop("image_base64", None)
            else:
                # Keep base64 for display if Cloudinary upload failed
                logger.info("Using base64 storage for image")
        except Exception as e:
            logger.error(f"Image processing failed: {e}")
            # Keep base64 as fallback
            pass
    
    new_report = WaterloggingReport(**report_data)
    
    # Insert into database
    await db.waterlogging_reports.insert_one(new_report.dict())
    
    return new_report

# Image upload route (alternative method)
@api_router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload image file and return URL or base64"""
    try:
        # Read and validate image
        image_data = await file.read()
        
        # Convert to base64 for storage/transport
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        image_base64_with_prefix = f"data:{file.content_type};base64,{image_base64}"
        
        # Try to upload to Cloudinary
        try:
            cloudinary_url = await upload_image_to_cloudinary(image_base64_with_prefix)
            if cloudinary_url:
                return {
                    "success": True,
                    "image_url": cloudinary_url,
                    "storage": "cloudinary"
                }
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
        
        # Fallback to base64 storage
        return {
            "success": True, 
            "image_base64": image_base64_with_prefix,
            "storage": "base64",
            "message": "Image stored as base64 (add Cloudinary credentials for cloud storage)"
        }
        
    except Exception as e:
        logger.error(f"Image upload failed: {e}")
        raise HTTPException(status_code=400, detail=f"Image upload failed: {str(e)}")

# Comment routes
@api_router.get("/reports/{report_id}/comments", response_model=List[Comment])
async def get_comments(report_id: str):
    """Get all comments for a specific report"""
    comments = await db.comments.find({"report_id": report_id}).to_list(100)
    return [Comment(**comment) for comment in comments]

@api_router.post("/reports/{report_id}/comments", response_model=Comment)
async def create_comment(report_id: str, comment: CommentCreate):
    """Add a new comment to a specific report"""
    # Verify the report exists
    existing_report = await db.waterlogging_reports.find_one({"id": report_id})
    if not existing_report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Create comment
    comment_data = comment.dict()
    comment_data["report_id"] = report_id
    new_comment = Comment(**comment_data)
    
    # Insert into database
    await db.comments.insert_one(new_comment.dict())
    
    return new_comment

# Voting routes
@api_router.post("/reports/{report_id}/vote")
async def vote_on_report(report_id: str, vote: VoteRequest):
    """Vote on report accuracy"""
    # Verify the report exists
    report = await db.waterlogging_reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Update vote counts
    if vote.vote_type == "up":
        await db.waterlogging_reports.update_one(
            {"id": report_id},
            {"$inc": {"accuracy_score": 1, "total_votes": 1}}
        )
    elif vote.vote_type == "down":
        await db.waterlogging_reports.update_one(
            {"id": report_id},
            {"$inc": {"accuracy_score": -1, "total_votes": 1}}
        )
    else:
        raise HTTPException(status_code=400, detail="Vote type must be 'up' or 'down'")
    
    # Return updated report
    updated_report = await db.waterlogging_reports.find_one({"id": report_id})
    return {"message": "Vote recorded", "accuracy_score": updated_report["accuracy_score"], "total_votes": updated_report["total_votes"]}

# Original status check routes
@api_router.get("/")
async def root():
    return {"message": "AquaRoute API - Real-time waterlogging reports with photo uploads"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db():
    """Create TTL index for auto-expiring reports"""
    try:
        # Create TTL index on expires_at field for automatic document deletion
        await db.waterlogging_reports.create_index("expires_at", expireAfterSeconds=0)
        logger.info("Created TTL index for waterlogging reports")
        
        # Log Cloudinary configuration status
        if (os.environ.get('CLOUDINARY_CLOUD_NAME', 'demo') == 'demo'):
            logger.warning("🔑 Cloudinary not configured - add credentials to .env for photo uploads")
        else:
            logger.info("✅ Cloudinary configured - photo uploads enabled")
            
    except Exception as e:
        logger.error(f"Error in startup: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()