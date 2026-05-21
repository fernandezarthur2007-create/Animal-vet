from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
import json

class PetAnalysis(BaseModel):
    pet_emotion: str
    confidence_score: int
    health_observations: list[str]
    actionable_advice: str

app = FastAPI()

# Enable CORS so your phone or web app can communicate safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Gemini client using the modern SDK
GEMINI_API_KEY = "AIzaSyAxtTu9WQBWZf6eI5oVplt4YdxFdR69kXk"
client = genai.Client(api_key=GEMINI_API_KEY)

@app.post("/analyze-pet")
async def analyze_pet(file: UploadFile = File(...)):
    try:
        print(f"Received file: {file.filename} with content type {file.content_type}")
        # 1. Read raw image bytes directly from the FastAPI stream
        image_bytes = await file.read()
        
        # Fallback to jpeg if the frontend doesn't provide a mime type
        mime_type = file.content_type if file.content_type else "image/jpeg"

        # 2. Package the raw bytes into a Gemini Part object
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type=mime_type,
        )

        # 3. Define the expert veterinary prompt
        prompt = (
            "You are an expert veterinary AI. Analyze this animal closely. "
            "1. Detect any visual signs of physical injury, pain, or emotional distress. "
            "2. Provide details on behavior tracking or structural abnormalities. "
            "3. Give a comprehensive research overview of what you see to assist the user."
        )

        # 4. Fire the request to Gemini 2.5 Flash for lightning-fast reasoning
        print("Sending raw bytes to Gemini 2.5 Flash...")
        from fastapi.concurrency import run_in_threadpool
        
        def call_gemini():
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=PetAnalysis,
                ),
            )
            
        response = await run_in_threadpool(call_gemini)
        
        print("Successfully received analysis from Gemini!")
        
        # Parse the JSON string from Gemini into a Python dictionary
        analysis_dict = json.loads(response.text)
        
        # Return cleanly matching the key your React Native frontend expects
        return {"analysis": analysis_dict}

    except Exception as e:
        print(f"Server Error: {str(e)}")
        # Guarantee a 500 error is thrown so React Native catches it in the 'else' block
        raise HTTPException(status_code=500, detail=f"Backend Error: {str(e)}")