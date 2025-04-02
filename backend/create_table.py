from sqlalchemy import create_engine, Column, Integer, String, Float, Date, PrimaryKeyConstraint, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the database engine
SQLALCHEMY_DATABASE_URL = "sqlite:///car_sales.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the base class
Base = declarative_base()

# Define the Sale model
class Sale(Base):
    __tablename__ = "sales"
    
    # Define composite primary key
    __table_args__ = (
        PrimaryKeyConstraint('task_name', 'sale_id', name='pk_sale'),
    )
    
    task_name = Column(String, nullable=False)
    sale_id = Column(String, nullable=False)
    company = Column(String)
    car_model = Column(String)
    manufacturing_year = Column(Integer)
    price = Column(Float)
    sales_location = Column(String)
    date_of_sale = Column(Date)

def create_tables():
    try:
        # Drop all existing tables
        Base.metadata.drop_all(bind=engine)
        logger.info("Dropped existing tables")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Created sales table successfully")
        
        # Verify table creation
        with engine.connect() as conn:
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'"))
            if result.fetchone():
                logger.info("Verified sales table exists")
                return True
            else:
                logger.error("Sales table was not created")
                return False
                
    except Exception as e:
        logger.error(f"Error creating tables: {str(e)}")
        return False

if __name__ == "__main__":
    success = create_tables()
    if success:
        print("Table creation successful!")
    else:
        print("Table creation failed!") 