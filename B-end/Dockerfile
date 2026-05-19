# Use the official lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file into the container
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose port (Cloud providers dynamically pass the PORT env variable)
EXPOSE 8000

# Run the FastAPI app using uvicorn. 
# We use shell expansion to use the cloud provider's PORT variable, or default to 8000.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
