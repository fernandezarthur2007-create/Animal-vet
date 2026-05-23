from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import Optional
import json
import os
from dotenv import load_dotenv

class ChatResponse(BaseModel):
    reply_text: str
    is_pet_related: bool
    pet_emotion: Optional[str] = "None"
    confidence_score: Optional[int] = 0
    health_observations: list[str] = []
    actionable_advice: Optional[str] = "None"

load_dotenv()

app = FastAPI()

AI_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "reply_text": {"type": "string"},
        "is_pet_related": {"type": "boolean"},
        "pet_emotion": {"type": "string"},
        "confidence_score": {"type": "integer"},
        "health_observations": {
            "type": "array",
            "items": {"type": "string"},
        },
        "actionable_advice": {"type": "string"},
    },
    "required": ["reply_text", "is_pet_related"],
}

# Enforce full CORS permissions so mobile devices connect cleanly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set. Add it to B-end/.env")
client = genai.Client(api_key=GEMINI_API_KEY)

@app.post("/analyze-pet")
async def analyze_pet(
    file: Optional[UploadFile] = File(None), 
    user_message: Optional[str] = Form(None)
):
    try:
        contents = []
        
        # 1. Image extraction processing pipeline
        if file:
            image_bytes = await file.read()
            mime_type = file.content_type if file.content_type else "image/jpeg"
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            contents.append(image_part)
            
        # 2. Extract string content message
        text_query = user_message if user_message else "Analyze this photo."
        contents.append(text_query)

        # 3. Model parameters and structural guidelines
        system_prompt = os.getenv("SYSTEM_PROMPT", (
            "You are a specialized Pet Care & Veterinary Chatbot Assistant. "
            "CRITICAL PROTOCOL: You must ONLY talk about pets, domestic animals, and veterinary care. "
            "If the user asks about unrelated topics (e.g., coding, cooking, general history, non-animal tasks), "
            "you must set 'is_pet_related' to false and politely refuse to answer, reminding them you are a pet assistant. "
            "If an image is present, analyze visual signs of injury, distress, or mood. "
            "Format your reply text and structured metric keys into the required JSON schema fields perfectly." 
        ))

        from fastapi.concurrency import run_in_threadpool
        def call_gemini():
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=types.GenerateContentConfig(
                    systemInstruction=system_prompt,
                    responseMimeType="application/json",
                    responseSchema=AI_RESPONSE_SCHEMA,
                ),
            )
            
        response = await run_in_threadpool(call_gemini)
        response_text = getattr(response, "text", None)
        if not response_text:
            raise HTTPException(
                status_code=502,
                detail="AI service returned an empty response."
            )

        try:
            analysis_dict = json.loads(response_text)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=502,
                detail=f"AI response was not valid JSON: {response_text}"
            )

        # 4. Formatted nested structure payload sent back to your React Native view engine
        return {
            "success": True,
            "reply_text": analysis_dict.get("reply_text", "No response text found."),
            "is_pet_related": analysis_dict.get("is_pet_related", True),
            "pet_emotion": analysis_dict.get("pet_emotion", "None"),
            "confidence_score": analysis_dict.get("confidence_score", 0),
            "health_observations": analysis_dict.get("health_observations", []),
            "actionable_advice": analysis_dict.get("actionable_advice", "None")
        }

    except Exception as e:
        print(f"Server Error Exception Logs: {str(e)}")
        return {
            "success": False,
            "reply_text": "",
            "is_pet_related": False,
            "pet_emotion": "None",
            "confidence_score": 0,
            "health_observations": [],
            "actionable_advice": str(e),
        }