from celery import task
from superset import db
from .models import APIConfiguration, ExecutionLog
import requests

@task(bind=True)
def fetch_api_data(self, config_id):
    """Celery task - APScheduler yerine"""
    config = APIConfiguration.query.get(config_id)
    
    try:
        response = requests.get(config.api_url, timeout=30)
        data = response.json()
        
        # Data'yı veritabanına kaydet
        # ... insert logic ...
        
        log = ExecutionLog(
            config_id=config_id,
            status='success',
            message=f'Fetched {len(data)} records'
        )
        db.session.add(log)
        db.session.commit()
        
    except Exception as e:
        log = ExecutionLog(
            config_id=config_id,
            status='error',
            message=str(e)
        )
        db.session.add(log)
        db.session.commit()

# Periodic task schedule (superset_config.py'ye ekleyin)
CELERYBEAT_SCHEDULE = {
    'api-scheduler-fetch': {
        'task': 'superset.views.api_scheduler.tasks.fetch_api_data',
        'schedule': 30.0,  # 30 saniyede bir
    }
}