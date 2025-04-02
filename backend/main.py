from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import pandas as pd
import json
import requests
from io import StringIO
import os
from datetime import datetime
from app.models import Sale, Base
from app.database import SessionLocal, engine
from sqlalchemy.orm import Session
from sqlalchemy import func
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_data_source(source_data: pd.DataFrame, source_type: str) -> pd.DataFrame:
    """Process data based on source type and return standardized DataFrame"""
    try:
        # Standardize column names
        source_data.columns = source_data.columns.str.lower().str.replace(' ', '_')
        
        # Map common field variations
        field_mapping = {
            'saleid': 'sale_id',
            'manufacturingyear': 'manufacturing_year',
            'saleslocation': 'sales_location'
        }
        
        # Rename columns based on mapping
        source_data = source_data.rename(columns=field_mapping)
        
        # Ensure required columns exist
        required_columns = [
            'sale_id', 'company', 'car_model', 'manufacturing_year',
            'price', 'sales_location'
        ]
        
        # Add missing columns with default values
        for col in required_columns:
            if col not in source_data.columns:
                source_data[col] = None
        
        # Convert numeric columns
        numeric_columns = ['price', 'manufacturing_year']
        for col in numeric_columns:
            if col in source_data.columns:
                source_data[col] = pd.to_numeric(source_data[col], errors='coerce')
        
        return source_data
        
    except Exception as e:
        logger.error(f"Error processing data source: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing data source: {str(e)}")

def apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """Apply filters to DataFrame"""
    try:
        filtered_df = df.copy()
        
        # Apply price range filter
        if filters.get('priceRange'):
            min_price = filters['priceRange']['min']
            max_price = filters['priceRange']['max']
            filtered_df = filtered_df[
                (filtered_df['price'] >= min_price) &
                (filtered_df['price'] <= max_price)
            ]
        
        # Apply model filter
        if filters.get('model'):
            filtered_df = filtered_df[filtered_df['car_model'] == filters['model']]
        
        # Apply year range filter
        if filters.get('yearRange'):
            min_year = filters['yearRange']['min']
            max_year = filters['yearRange']['max']
            filtered_df = filtered_df[
                (filtered_df['manufacturing_year'] >= min_year) &
                (filtered_df['manufacturing_year'] <= max_year)
            ]
        
        # Apply company filter
        if filters.get('company'):
            filtered_df = filtered_df[filtered_df['company'] == filters['company']]
        
        # Apply location filter
        if filters.get('location'):
            filtered_df = filtered_df[filtered_df['sales_location'] == filters['location']]
        
        return filtered_df
        
    except Exception as e:
        logger.error(f"Error applying filters: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error applying filters: {str(e)}")

@app.post("/generate-report")
async def generate_report(
    task_name: str = Form(...),
    task_description: str = Form(...),
    sources: List[UploadFile] = File(...),
    source_urls: List[str] = Form([]),
    filters: Optional[str] = Form(None)
):
    """Generate a report by processing multiple data sources"""
    try:
        # Parse filters if provided
        filter_dict = json.loads(filters) if filters else {}
        
        # Process file sources
        processed_sources = []
        source_metadata = []
        
        # Process uploaded files
        for source in sources:
            try:
                # Read file content
                content = await source.read()
                if source.filename.endswith('.csv'):
                    df = pd.read_csv(StringIO(content.decode('utf-8')))
                elif source.filename.endswith('.xlsx'):
                    df = pd.read_excel(StringIO(content.decode('utf-8')))
                elif source.filename.endswith('.json'):
                    # Handle JSON files
                    json_data = json.loads(content.decode('utf-8'))
                    # Convert JSON to DataFrame, handling both array and object formats
                    if isinstance(json_data, list):
                        df = pd.DataFrame(json_data)
                    else:
                        # If JSON is an object, convert to DataFrame with one row
                        df = pd.DataFrame([json_data])
                else:
                    raise HTTPException(status_code=400, detail=f"Unsupported file format: {source.filename}")
                
                # Process the data
                processed_df = process_data_source(df, 'file')
                processed_sources.append(processed_df)
                
                # Add source metadata
                source_metadata.append({
                    'name': source.filename,
                    'type': 'file',
                    'records': len(processed_df),
                    'columns': list(processed_df.columns)
                })
                
            except Exception as e:
                logger.error(f"Error processing source {source.filename}: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Error processing source {source.filename}: {str(e)}")
        
        # Process URL sources
        for url in source_urls:
            try:
                # Download file from URL
                response = requests.get(url)
                response.raise_for_status()
                
                # Determine file type from URL or content
                if url.endswith('.csv'):
                    df = pd.read_csv(StringIO(response.text))
                elif url.endswith('.xlsx'):
                    df = pd.read_excel(StringIO(response.content))
                elif url.endswith('.json'):
                    # Handle JSON files from URL
                    json_data = response.json()
                    # Convert JSON to DataFrame, handling both array and object formats
                    if isinstance(json_data, list):
                        df = pd.DataFrame(json_data)
                    else:
                        # If JSON is an object, convert to DataFrame with one row
                        df = pd.DataFrame([json_data])
                else:
                    raise HTTPException(status_code=400, detail=f"Unsupported file format for URL: {url}")
                
                # Process the data
                processed_df = process_data_source(df, 'url')
                processed_sources.append(processed_df)
                
                # Add source metadata
                source_metadata.append({
                    'name': url,
                    'type': 'url',
                    'records': len(processed_df),
                    'columns': list(processed_df.columns)
                })
                
            except Exception as e:
                logger.error(f"Error processing URL source {url}: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Error processing URL source {url}: {str(e)}")
        
        if not processed_sources:
            raise HTTPException(status_code=400, detail="No valid data sources provided")
        
        # Combine all processed sources
        combined_data = pd.concat(processed_sources, ignore_index=True)
        
        # Apply filters if provided
        if filter_dict:
            combined_data = apply_filters(combined_data, filter_dict)
        
        # Store data in database
        db = SessionLocal()
        try:
            # Delete existing data for this task
            db.query(Sale).filter(Sale.task_name == task_name).delete()
            
            # Insert new data
            for _, row in combined_data.iterrows():
                sale = Sale(**row.to_dict(), task_name=task_name)
                db.add(sale)
            
            db.commit()
            
            # Get total records count
            total_records = db.query(func.count(Sale.sale_id)).filter(Sale.task_name == task_name).scalar()
            
            return {
                "task_name": task_name,
                "task_description": task_description,
                "status": "success",
                "processed_sources": len(processed_sources),
                "total_records": total_records,
                "processed_data": combined_data.to_dict(orient='records'),
                "source_metadata": source_metadata
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Database error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error in generate_report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/{task_name}")
async def get_task(task_name: str):
    """Get a specific task by name"""
    try:
        db = SessionLocal()
        try:
            # Get all sales for this task
            sales = db.query(Sale).filter(Sale.task_name == task_name).all()
            
            if not sales:
                raise HTTPException(status_code=404, detail="Task not found")
            
            # Convert to dict format
            sales_data = [sale.__dict__ for sale in sales]
            for sale in sales_data:
                sale.pop('_sa_instance_state', None)  # Remove SQLAlchemy internal state
            
            return {
                "task_name": task_name,
                "sales": sales_data
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error getting task {task_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks")
async def get_tasks():
    """Get all tasks"""
    try:
        db = SessionLocal()
        try:
            # Get unique task names
            tasks = db.query(Sale.task_name, func.count(Sale.sale_id).label('record_count')).group_by(Sale.task_name).all()
            
            return {
                "tasks": [
                    {
                        "task_name": task.task_name,
                        "record_count": task.record_count
                    }
                    for task in tasks
                ]
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error getting tasks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 