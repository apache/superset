# superset/views/api_scheduler/__init__.py
"""
API Scheduler module for Apache Superset
Provides scheduled API data fetching functionality
"""

from flask import Blueprint

def create_blueprint():
    """Blueprint factory function"""
    from .views import api_scheduler_bp
    return api_scheduler_bp

# Export models for migrations
from .models import APIConfiguration, FieldMapping, ExecutionLog

__all__ = ['APIConfiguration', 'FieldMapping', 'ExecutionLog', 'create_blueprint']