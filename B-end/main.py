import base64
import os
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

# Enable CORS so your phone tunnel can communicate safely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use environment variables instead of hardcoding tokens for security (crucial for Cloud deployments)
HF_TOKEN = os.environ.get("HF_TOKEN")

# The endpoint pointing directly to Qwen 2.5 Vision
API_URL = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-VL-7B-Instruct"


@app.post("/analyze-pet")
async def analyze_pet(file: UploadFile = File(...)):
    try:
        # 1. Read the image uploaded from your phone camera
        image_bytes = await file.read()
        
        # 2. Convert the image to a base64 string so the API can read it
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:image/jpeg;base64,{base64_image}"
        
        # 3. Construct the prompt for Qwen's deep visual research & injury tracking
        payload = {
            "model": "Qwen/Qwen2.5-VL-7B-Instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url}
                        },
                        {
                            "type": "text",
                            "text": (
                                "You are an expert veterinary AI. Analyze this animal closely. "
                                "1. Detect any visual signs of physical injury, pain, or emotional distress. "
                                "2. Provide details on behavior tracking or structural abnormalities. "
                                "3. Give a comprehensive research overview of what you see to assist the user."
                            )
                        }
                    ]
                }
            ],
            "parameters": {"max_new_tokens": 500}
        }
        
        # 4. Fire it off to Hugging Face
        print("Sending image to Qwen over the cloud...")
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(API_URL, headers=headers, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            
            # Safe extraction logic for Hugging Face vision models
            if isinstance(result, list) and len(result) > 0:
                # Sometimes HF returns a direct list of generated text
                analysis_text = result[0].get("generated_text", str(result))
            elif "choices" in result:
                analysis_text = result["choices"][0]["message"]["content"]
            else:
                # Fallback if the structure is completely raw text
                analysis_text = result.get("generated_text", str(result))
            
            print("Successfully received analysis from Qwen!")
            # 🚀 Clean the string to ensure no weird control characters break React Native
            clean_text = analysis_text.strip()
            
            return {"analysis": clean_text}
            
    except Exception as e:
        print(f"Server Error: {str(e)}")
        return {"error": str(e)}