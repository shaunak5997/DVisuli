from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
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
from sqlalchemy import func, distinct
import logging
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
try:
    Base.metadata.drop_all(bind=engine)  # Drop all tables first
    Base.metadata.create_all(bind=engine)  # Create tables with new schema
    logger.info("Database tables created successfully")
except Exception as e:
    logger.error(f"Error creating database tables: {str(e)}")
    raise

app = FastAPI()

# Configure rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Specify allowed methods
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    response = await call_next(request)
    end_time = datetime.now()
    
    logger.info(
        f"Path: {request.url.path} "
        f"Method: {request.method} "
        f"Client: {request.client.host} "
        f"Duration: {(end_time - start_time).total_seconds():.3f}s "
        f"Status: {response.status_code}"
    )
    
    return response

# Input validation function
def validate_task_input(task_name: str, task_description: str) -> None:
    if not task_name or len(task_name) > 100:
        raise HTTPException(status_code=400, detail="Invalid task name")
    if not task_description or len(task_description) > 500:
        raise HTTPException(status_code=400, detail="Invalid task description")

def validate_file_type(filename: str) -> None:
    allowed_extensions = {'.csv', '.xlsx', '.json'}
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

def process_data_source(source_data: pd.DataFrame, source_type: str) -> pd.DataFrame:
    """Process data based on source type and return standardized DataFrame"""
    try:
        # Standardize column names
        source_data.columns = source_data.columns.str.lower().str.replace(' ', '_')
        
        # Map common field variations
        field_mapping = {
            'saleid': 'sale_id',
            'manufacturingyear': 'manufacturing_year',
            'saleslocation': 'sales_location',
            'dateofsale': 'date_of_sale',
            'saledate': 'date_of_sale',
            'date': 'date_of_sale'
        }
        
        # Rename columns based on mapping
        source_data = source_data.rename(columns=field_mapping)
        
        # Ensure required columns exist
        required_columns = [
            'sale_id', 'company', 'car_model', 'manufacturing_year',
            'price', 'sales_location', 'date_of_sale'
        ]
        
        # Add missing columns with default values
        for col in required_columns:
            if col not in source_data.columns:
                if col == 'date_of_sale':
                    source_data[col] = pd.Timestamp.now().date()  # Default to current date
                else:
                    source_data[col] = None
        
        # Convert numeric columns
        numeric_columns = ['price', 'manufacturing_year']
        for col in numeric_columns:
            if col in source_data.columns:
                source_data[col] = pd.to_numeric(source_data[col], errors='coerce')
        
        # Convert date column
        if 'date_of_sale' in source_data.columns:
            source_data['date_of_sale'] = pd.to_datetime(source_data['date_of_sale'], errors='coerce').dt.date
        
        return source_data
        
    except Exception as e:
        logger.error(f"Error processing data source: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error processing data source: {str(e)}")

def apply_filters(df: pd.DataFrame, filters: dict) -> pd.DataFrame:
    """Apply filters to DataFrame"""
    print(f"filters: {filters}")
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
@limiter.limit("5/minute")  # Rate limit: 5 requests per minute
async def generate_report(
    request: Request,  # Required for rate limiting
    task_name: str = Form(...),
    task_description: str = Form(...),
    sources: List[UploadFile] = File(...),
    source_urls: List[str] = Form([]),
    filters: Optional[str] = Form(None)
):
    """Generate a report by processing multiple data sources"""
    try:
        # Validate inputs
        validate_task_input(task_name, task_description)
        
        # Validate file types
        for source in sources:
            validate_file_type(source.filename)
        
        # Parse filters if provided
        filter_dict = json.loads(filters) if filters else {}
        
        # Process file sources
        processed_sources = []
        source_metadata = []
        
        # Process uploaded files
        for source in sources:
            try:
                content = await source.read()
                if source.filename.endswith('.csv'):
                    df = pd.read_csv(StringIO(content.decode('utf-8')))
                elif source.filename.endswith('.xlsx'):
                    df = pd.read_excel(StringIO(content.decode('utf-8')))
                elif source.filename.endswith('.json'):
                    json_data = json.loads(content.decode('utf-8'))
                    if isinstance(json_data, list):
                        df = pd.DataFrame(json_data)
                    else:
                        df = pd.DataFrame([json_data])
                else:
                    raise HTTPException(status_code=400, detail=f"Unsupported file format: {source.filename}")
                processed_df = process_data_source(df, 'file')
                processed_sources.append(processed_df)
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
                response = requests.get(url)
                response.raise_for_status()
                
                if url.endswith('.csv'):
                    df = pd.read_csv(StringIO(response.text))
                elif url.endswith('.xlsx'):
                    df = pd.read_excel(StringIO(response.content))
                elif url.endswith('.json'):
                    json_data = response.json()
                    if isinstance(json_data, list):
                        df = pd.DataFrame(json_data)
                    else:
                        df = pd.DataFrame([json_data])
        else:
                    raise HTTPException(status_code=400, detail=f"Unsupported URL format: {url}")
                
                processed_df = process_data_source(df, 'url')
                processed_sources.append(processed_df)
                
                source_metadata.append({
                    'name': url,
                    'type': 'url',
                    'records': len(processed_df),
                    'columns': list(processed_df.columns)
                })
            except Exception as e:
                logger.error(f"Error processing URL {url}: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Error processing URL {url}: {str(e)}")
        
        # Combine all processed sources
        if not processed_sources:
            raise HTTPException(status_code=400, detail="No valid data sources provided")
        
        combined_df = pd.concat(processed_sources, ignore_index=True)
        
        # Apply filters if any
        if filter_dict:
            combined_df = apply_filters(combined_df, filter_dict)
        
        # Create database session
        db = SessionLocal()
        try:
            # Save to database
            for _, row in combined_df.iterrows():
                sale = Sale(
                    task_name=task_name,
                    sale_id=row.get('sale_id'),
                    company=row.get('company'),
                    car_model=row.get('car_model'),
                    manufacturing_year=row.get('manufacturing_year'),
                    price=row.get('price'),
                    sales_location=row.get('sales_location'),
                    date_of_sale=row.get('date_of_sale')
                )
                db.add(sale)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Database error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            db.close()
        
        return JSONResponse({
            "message": "Report generated successfully",
            "task_name": task_name,
            "sources_processed": len(source_metadata),
            "total_records": len(combined_df),
            "source_metadata": source_metadata
        })
        
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")

@app.get("/tasks/{task_name}")
@limiter.limit("10/minute")  # Rate limit: 10 requests per minute
async def get_task(request: Request, task_name: str):
    """Get a specific task by name"""
    try:
        if not task_name or len(task_name) > 100:
            raise HTTPException(status_code=400, detail="Invalid task name")
            
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
@limiter.limit("10/minute")  # Rate limit: 10 requests per minute
async def get_tasks(request: Request):
    """Get all unique task names from the sales table"""
    try:
        db = SessionLocal()
        try:
            # Get unique task names with their record counts
            tasks = db.query(
                Sale.task_name,
                func.count(Sale.sale_id).label('record_count')
            ).group_by(Sale.task_name).all()
            
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

@app.get("/tasks/{task_name}/analytics")
@limiter.limit("10/minute")  # Rate limit: 10 requests per minute
async def show_analytics(request: Request, task_name: str):
    """Get analytics data for a specific task"""
    try:
        if not task_name or len(task_name) > 100:
            raise HTTPException(status_code=400, detail="Invalid task name")
            
        db = SessionLocal()
        try:
            # Get all sales for this task
            sales = db.query(Sale).filter(Sale.task_name == task_name).all()
            
            if not sales:
                raise HTTPException(status_code=404, detail="No data found for this task")
            
            # Convert to dict format and remove SQLAlchemy internal state
            sales_data = []
            for sale in sales:
                sale_dict = sale.__dict__
                sale_dict.pop('_sa_instance_state', None)
                # Convert date to string format
                if sale_dict.get('date_of_sale'):
                    sale_dict['date_of_sale'] = sale_dict['date_of_sale'].isoformat()
                sales_data.append(sale_dict)
            
            # Calculate summary statistics
            total_sales = len(sales_data)
            total_revenue = sum(float(sale.get('price', 0)) for sale in sales_data)
            avg_price = total_revenue / total_sales if total_sales > 0 else 0
            
            # Get date range
            dates = [pd.to_datetime(sale.get('date_of_sale', pd.Timestamp.now().date())) for sale in sales_data]
            date_range = {
                'start': min(dates).strftime('%Y-%m-%d'),
                'end': max(dates).strftime('%Y-%m-%d')
            }
            
            # Aggregate data for company bar chart
            company_aggregation = {}
            for sale in sales_data:
                company = sale.get('company', 'Unknown')
                if company not in company_aggregation:
                    company_aggregation[company] = {
                        'count': 0,
                        'total_revenue': 0
                    }
                company_aggregation[company]['count'] += 1
                company_aggregation[company]['total_revenue'] += float(sale.get('price', 0))
            
            # Convert company aggregation to list format for D3.js
            company_chart_data = [
                {
                    'company': company,
                    'count': data['count'],
                    'total_revenue': round(data['total_revenue'], 2)
                }
                for company, data in company_aggregation.items()
            ]
            
            # Aggregate data by month and year
            monthly_aggregation = {}
            for sale in sales_data:
                date = pd.to_datetime(sale.get('date_of_sale', pd.Timestamp.now().date()))
                month_key = date.strftime('%Y-%m')
                if month_key not in monthly_aggregation:
                    monthly_aggregation[month_key] = {
                        'count': 0,
                        'total_revenue': 0,
                        'avg_price': 0
                    }
                monthly_aggregation[month_key]['count'] += 1
                monthly_aggregation[month_key]['total_revenue'] += float(sale.get('price', 0))
                monthly_aggregation[month_key]['avg_price'] = monthly_aggregation[month_key]['total_revenue'] / monthly_aggregation[month_key]['count']
            
            # Convert monthly aggregation to list format for D3.js
            monthly_chart_data = [
                {
                    'month': month,
                    'count': data['count'],
                    'total_revenue': round(data['total_revenue'], 2),
                    'avg_price': round(data['avg_price'], 2)
                }
                for month, data in sorted(monthly_aggregation.items())
            ]
            
            return {
                "task_name": task_name,
                "summary": {
                    "total_sales": total_sales,
                    "total_revenue": round(total_revenue, 2),
                    "average_price": round(avg_price, 2),
                    "date_range": date_range
                },
                "company_chart_data": company_chart_data,
                "monthly_chart_data": monthly_chart_data,
                "sales_data": sales_data
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error getting analytics for task {task_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 