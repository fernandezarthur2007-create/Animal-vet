import asyncio
from google import genai

client = genai.Client(api_key='AIzaSyAxtTu9WQBWZf6eI5oVplt4YdxFdR69kXk')

async def main():
    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash', 
            contents='hi'
        )
        print("Success:", response.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
