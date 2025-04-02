from sqlalchemy import Column, Integer, String, Float, Date, PrimaryKeyConstraint
from sqlalchemy.ext.declarative import declarative_base
from .base import Base
from datetime import datetime

Base = declarative_base()

class Sale(Base):
    __tablename__ = 'sales'

    task_name = Column(String, nullable=False)
    sale_id = Column(String, nullable=False)
    company = Column(String)
    car_model = Column(String)
    manufacturing_year = Column(Integer)
    price = Column(Float)
    sales_location = Column(String)
    date_of_sale = Column(Date)

    # Define composite primary key
    __table_args__ = (
        PrimaryKeyConstraint('task_name', 'sale_id', name='pk_sale'),
    )

    @classmethod
    def from_dict(cls, data):
        # Map common field variations
        field_mapping = {
            'saleId': 'sale_id',
            'manufacturingYear': 'manufacturing_year',
            'salesLocation': 'sales_location'
        }

        # Apply field mapping
        for old_field, new_field in field_mapping.items():
            if old_field in data:
                data[new_field] = data.pop(old_field)

        # Create instance with mapped data
        return cls(**data) 