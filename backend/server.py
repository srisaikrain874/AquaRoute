from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=1))
    accuracy_score: int = Field(default=0)  # For voting system
    total_votes: int = Field(default=0)

class WaterloggingReportCreate(BaseModel):
    lat: float
    lng: float
    severity: str = "Medium"

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
    """Create a new waterlogging report"""
    # Validate severity
    if report.severity not in ["Low", "Medium", "Severe"]:
        raise HTTPException(status_code=400, detail="Severity must be Low, Medium, or Severe")
    
    # Create report with auto-expire
    report_data = report.dict()
    new_report = WaterloggingReport(**report_data)
    
    # Insert into database
    await db.waterlogging_reports.insert_one(new_report.dict())
    
    return new_report

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
    return {"message": "AquaRoute API - Real-time waterlogging reports"}

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
    except Exception as e:
        logger.error(f"Error creating TTL index: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()