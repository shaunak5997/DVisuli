# backend/app/main.py
from fastapi import FastAPI,UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import json
import requests
from typing import Optional
import io

app = FastAPI(title="D3 Visualization API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],  # Live Server URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sample data endpoint
@app.get("/api/data")
async def get_data():
    return [
        {"category": "A", "value": 10},
        {"category": "B", "value": 20},
        {"category": "C", "value": 15},
        {"category": "D", "value": 25},
        {"category": "E", "value": 18}
    ]

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/upload/file")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Read file content
        content = await file.read()
        
        # Determine file type and process accordingly
        if file.filename.endswith('.csv'):
            # Process CSV
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
            return {"data": df.to_dict(orient='records')}
        elif file.filename.endswith('.json'):
            # Process JSON
            data = json.loads(content.decode('utf-8'))
            return {"data": data}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or JSON files.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload/url")
async def upload_from_url(url: str):
    try:
        # Fetch content from URL
        response = requests.get(url)
        response.raise_for_status()
        
        # Determine content type and process accordingly
        content_type = response.headers.get('content-type', '')
        
        if 'text/csv' in content_type or url.endswith('.csv'):
            # Process CSV
            df = pd.read_csv(io.StringIO(response.text))
            return {"data": df.to_dict(orient='records')}
        elif 'application/json' in content_type or url.endswith('.json'):
            # Process JSON
            data = response.json()
            return {"data": data}
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please provide CSV or JSON URL.")
            
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Error fetching URL: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)