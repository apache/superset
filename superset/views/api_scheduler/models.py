# superset/views/api_scheduler/models.py
"""
API Scheduler Models for Apache Superset
Database models for scheduled API data fetching
"""

from superset import db
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime


class APIConfiguration(db.Model):
    """API fetch configuration model"""
    
    __tablename__ = 'api_scheduler_configuration'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False, unique=True)
    target_table = Column(String(100), nullable=False)
    api_url = Column(String(500), nullable=False)
    api_method = Column(String(10), default='GET')
    api_headers = Column(Text, nullable=True)
    api_key = Column(String(500), nullable=True)
    schedule_interval = Column(Integer, default=300)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    field_mappings = relationship(
        'FieldMapping',
        back_populates='config',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )
    execution_logs = relationship(
        'ExecutionLog',
        back_populates='config',
        cascade='all, delete-orphan',
        lazy='dynamic'
    )
    
    def __repr__(self):
        return f'<APIConfiguration {self.name}>'
    
    def to_dict(self):
        """Convert to dictionary for JSON responses"""
        return {
            'id': self.id,
            'name': self.name,
            'target_table': self.target_table,
            'api_url': self.api_url,
            'api_method': self.api_method,
            'schedule_interval': self.schedule_interval,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class FieldMapping(db.Model):
    """API response field to database column mapping"""
    
    __tablename__ = 'api_scheduler_field_mapping'
    
    id = Column(Integer, primary_key=True)
    config_id = Column(Integer, ForeignKey('api_scheduler_configuration.id'), nullable=False)
    api_field_path = Column(String(200), nullable=False)
    db_column_name = Column(String(100), nullable=False)
    db_column_type = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    config = relationship('APIConfiguration', back_populates='field_mappings')
    
    def __repr__(self):
        return f'<FieldMapping {self.api_field_path} -> {self.db_column_name}>'
    
    def to_dict(self):
        """Convert to dictionary for JSON responses"""
        return {
            'id': self.id,
            'config_id': self.config_id,
            'api_field_path': self.api_field_path,
            'db_column_name': self.db_column_name,
            'db_column_type': self.db_column_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ExecutionLog(db.Model):
    """Execution log for scheduled API fetches"""
    
    __tablename__ = 'api_scheduler_execution_log'
    
    id = Column(Integer, primary_key=True)
    config_id = Column(Integer, ForeignKey('api_scheduler_configuration.id'), nullable=False)
    executed_at = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String(50), nullable=False)
    message = Column(Text)
    records_inserted = Column(Integer, default=0)
    
    # Relationship
    config = relationship('APIConfiguration', back_populates='execution_logs')
    
    def __repr__(self):
        return f'<ExecutionLog {self.config_id} - {self.status}>'
    
    def to_dict(self):
        """Convert to dictionary for JSON responses"""
        return {
            'id': self.id,
            'config_id': self.config_id,
            'executed_at': self.executed_at.isoformat() if self.executed_at else None,
            'status': self.status,
            'message': self.message,
            'records_inserted': self.records_inserted
        }


# Data type mapping for PostgreSQL
ALLOWED_COLUMN_TYPES = {
    'VARCHAR(255)': String(255),
    'TEXT': Text,
    'INTEGER': Integer,
    'DECIMAL(10,2)': db.Numeric(10, 2),
    'BOOLEAN': Boolean,
    'TIMESTAMP': DateTime,
    'JSONB': db.JSON
}