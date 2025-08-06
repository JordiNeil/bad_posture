from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import cv2
import numpy as np
import mediapipe as mp
from math import degrees, atan2
from fastapi.middleware.cors import CORSMiddleware
import os
from io import BytesIO
from PIL import Image
from pydantic import BaseModel

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the absolute path to the frontend directory
# When running in Docker, the frontend will be in /app/frontend
if os.path.exists("/app/frontend"):
    frontend_dir = "/app/frontend"
else:
    # For local development
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Create a sub-application for API routes
api_app = FastAPI()

# Config endpoints removed - posture evaluation now handled by frontend

@api_app.post("/process-image")
async def process_image(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(BytesIO(contents))
    img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert image to RGB
    imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Process the image and detect pose
    results = pose.process(imgRGB)
    
    if results.pose_landmarks:
        try:
            # Calculate neck angles only
            angles = calculate_neck_angles(results.pose_landmarks.landmark)
            
            # Convert landmarks to list for JSON serialization
            landmarks = []
            for landmark in results.pose_landmarks.landmark:
                landmarks.append({
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z,
                    'visibility': landmark.visibility
                })
            
            return {
                "angles": angles,
                "landmarks": landmarks
            }
        except ValueError as e:
            return {"error": str(e)}
    else:
        return {"error": "No pose detected"}

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
pose = mp_pose.Pose()
mp_draw = mp.solutions.drawing_utils

def calculate_neck_angles(landmarks):
    # Calculate head forward angles for both sides
    right_shoulder = (landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                     landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y)
    right_ear = (landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].x,
                 landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].y)
    
    left_shoulder = (landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                    landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y)
    left_ear = (landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].x,
                landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].y)
    
    # Calculate head forward angles from vertical
    # Positive angle = head forward (bad posture)
    # 0° = head directly above shoulders (perfect posture)
    
    # For right side: measure how far forward the ear is from shoulder
    right_dx = right_ear[0] - right_shoulder[0]  # horizontal distance
    right_dy = right_shoulder[1] - right_ear[1]  # vertical distance (inverted y-axis)
    right_angle = degrees(atan2(abs(right_dx), max(right_dy, 0.001)))  # Prevent division by zero
    
    # For left side: same calculation
    left_dx = left_ear[0] - left_shoulder[0]  # horizontal distance  
    left_dy = left_shoulder[1] - left_ear[1]  # vertical distance (inverted y-axis)
    left_angle = degrees(atan2(abs(left_dx), max(left_dy, 0.001)))  # Prevent division by zero
    
    # Calculate visibility scores
    right_visibility = min(landmarks[mp_pose.PoseLandmark.RIGHT_EAR.value].visibility,
                         landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].visibility)
    left_visibility = min(landmarks[mp_pose.PoseLandmark.LEFT_EAR.value].visibility,
                        landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].visibility)
    
    angles = {}
    if right_visibility > 0.5:
        angles['right'] = right_angle
    if left_visibility > 0.5:
        angles['left'] = left_angle
    
    if not angles:
        raise ValueError("No clear view of neck angle")
    
    return angles

# check_posture function removed - posture evaluation now handled by frontend

# Mount the API routes under /api
app.mount("/api", api_app)

# Verify frontend directory exists
if not os.path.exists(frontend_dir):
    raise RuntimeError(f"Frontend directory not found at: {frontend_dir}")

# Serve static files
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend") 