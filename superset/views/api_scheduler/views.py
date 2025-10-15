# superset/views/api_scheduler/views.py
"""
API Scheduler Views for Apache Superset
Provides routes for scheduled API data fetching management
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, abort
from superset import db
from .models import APIConfiguration, FieldMapping, ExecutionLog, ALLOWED_COLUMN_TYPES
import requests
import json
import re
from datetime import datetime
from sqlalchemy import text
import ipaddress

# Blueprint oluştur (login gerektirmeyen public routes)
api_scheduler_bp = Blueprint(
    'api_scheduler',
    __name__,
    url_prefix='/api-scheduler',
    template_folder='../../templates/api_scheduler', 
    static_folder='../../static/assets/api_scheduler'
)
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import pytz
import logging
logger = logging.getLogger(__name__)
# Global scheduler instance
scheduler = BackgroundScheduler(timezone=pytz.UTC)
scheduler_started = False
_app_instance = None  # EKLE: Global app instance
@api_scheduler_bp.record_once
def on_load(state):
    """Blueprint yüklendiğinde app instance'ını sakla"""
    global _app_instance
    _app_instance = state.app
    logger.info("API Scheduler blueprint loaded, app instance captured")

# ============== DASHBOARD ==============
@api_scheduler_bp.route('/')
@api_scheduler_bp.route('/dashboard')
def dashboard():
    """Ana dashboard - Tüm konfigürasyonları listele"""
    configs = db.session.query(APIConfiguration).all()
    
    # Her config için son execution ve next run bilgisini al
    for config in configs:
        # Last execution
        last_log = db.session.query(ExecutionLog)\
            .filter_by(config_id=config.id)\
            .order_by(ExecutionLog.executed_at.desc())\
            .first()
        config.last_execution = last_log
        
        # Next run time from scheduler
        config.next_run_time = None
        if config.is_active:
            job = scheduler.get_job(f'api_fetch_{config.id}')
            if job:
                config.next_run_time = job.next_run_time
    
    return render_template('api_scheduler/dashboard.html', configs=configs)


# ============== CONFIG CRUD ==============
@api_scheduler_bp.route('/config/new', methods=['GET', 'POST'])
def new_config():
    """Yeni API configuration oluştur"""
    if request.method == 'POST':
        try:
            # Validate SSRF
            api_url = request.form.get('api_url', '').strip()
            if not validate_url_safe(api_url):
                flash('Invalid URL or private IP address detected', 'danger')
                return render_template('api_scheduler/config_form.html')
            
            # Parse headers
            headers_str = request.form.get('api_headers', '').strip()
            if headers_str and headers_str != 'None':
                try:
                    json.loads(headers_str)
                except json.JSONDecodeError:
                    flash('Invalid JSON format for headers', 'danger')
                    return render_template('api_scheduler/config_form.html')
            else:
                headers_str = None
            
            config = APIConfiguration(
                name=request.form['name'],
                target_table='api_scheduler_' + request.form['target_table'],
                api_url=api_url,
                api_method=request.form.get('api_method', 'GET'),
                api_headers=headers_str,
                api_key=request.form.get('api_key'),
                schedule_interval=int(request.form.get('schedule_interval', 300)),
                is_active=False
            )
            
            db.session.add(config)
            db.session.commit()
            
            flash(f'Configuration "{config.name}" created successfully!', 'success')
            return redirect(url_for('api_scheduler.edit_mappings', config_id=config.id))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error creating configuration: {str(e)}', 'danger')
    
    return render_template('api_scheduler/config_form.html',config=None)


@api_scheduler_bp.route('/config/<int:config_id>/edit', methods=['GET', 'POST'])
def edit_config(config_id):
    """Config düzenle"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        abort(404)
    
    if request.method == 'POST':
        try:
            api_url = request.form.get('api_url', '').strip()
            if not validate_url_safe(api_url):
                flash('Invalid URL or private IP address detected', 'danger')
                return render_template('api_scheduler/config_form.html', config=config)
            
            config.name = request.form['name']
            config.target_table = 'api_scheduler_' + request.form['target_table'].replace('api_scheduler_', '')
            config.api_url = api_url
            config.api_method = request.form.get('api_method', 'GET')
            config.api_headers = request.form.get('api_headers')
            config.api_key = request.form.get('api_key')
            config.schedule_interval = int(request.form.get('schedule_interval', 300))
            
            db.session.commit()
            flash('Configuration updated successfully!', 'success')
            return redirect(url_for('api_scheduler.dashboard'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating configuration: {str(e)}', 'danger')
    
    return render_template('api_scheduler/config_form.html', config=config)


@api_scheduler_bp.route('/config/<int:config_id>/delete', methods=['POST'])
def delete_config(config_id):
    """Config sil"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        abort(404)
    
    try:
        # Drop table if exists
        try:
            db.session.execute(text(f'DROP TABLE IF EXISTS {config.target_table}'))
            db.session.commit()
        except:
            pass
        
        db.session.delete(config)
        db.session.commit()
        flash(f'Configuration "{config.name}" deleted successfully!', 'success')
        schedule_jobs()
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting configuration: {str(e)}', 'danger')
    
    return redirect(url_for('api_scheduler.dashboard'))


# ============== FIELD MAPPINGS ==============
@api_scheduler_bp.route('/config/<int:config_id>/mappings', methods=['GET', 'POST'])
def edit_mappings(config_id):
    """Field mapping'leri düzenle"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        abort(404)
    
    if request.method == 'POST':
        try:
            # Önceki mapping'leri sil
            old_mappings = db.session.query(FieldMapping).filter_by(config_id=config_id).all()
            for mapping in old_mappings:
                db.session.delete(mapping)
            # Array'leri al
            api_field_paths = request.form.getlist('api_field_path[]')
            db_column_names = request.form.getlist('db_column_name[]')
            db_column_types = request.form.getlist('db_column_type[]')
            
            # Her mapping için kaydet
            for i in range(len(api_field_paths)):
                mapping = FieldMapping(
                    config_id=config_id,
                    api_field_path=api_field_paths[i],
                    db_column_name=db_column_names[i].lower(),
                    db_column_type=db_column_types[i]
                )
                db.session.add(mapping)
            
            db.session.commit()
            flash('Field mappings saved!', 'success')
            return redirect(url_for('api_scheduler.sql_preview', config_id=config_id))
            
        except Exception as e:
            db.session.rollback()
            flash(f'Error adding mapping: {str(e)}', 'danger')
    
    mappings = db.session.query(FieldMapping).filter_by(config_id=config_id).all()
    return render_template('api_scheduler/mappings.html', 
                         config=config, 
                         mappings=mappings,
                         column_types=ALLOWED_COLUMN_TYPES.keys())


@api_scheduler_bp.route('/mapping/<int:mapping_id>/delete', methods=['POST'])
def delete_mapping(mapping_id):
    """Mapping sil"""
    mapping = db.session.query(FieldMapping).get(mapping_id)
    if not mapping:
        abort(404)
    
    config_id = mapping.config_id
    db.session.delete(mapping)
    db.session.commit()
    
    flash('Field mapping deleted!', 'success')
    return redirect(url_for('api_scheduler.edit_mappings', config_id=config_id))


# ============== API TEST ==============
@api_scheduler_bp.route('/config/<int:config_id>/test', methods=['POST'])
def test_api(config_id):
    """API'yi test et ve response döndür"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        return jsonify({'success': False, 'error': 'Configuration not found'}), 404
    
    try:
        headers = {}
        if config.api_headers:
            try:
                headers = json.loads(config.api_headers)
            except:
                pass
        
        if config.api_key:
            headers['Authorization'] = f'Bearer {config.api_key}'
        
        response = requests.request(
            method=config.api_method,
            url=config.api_url,
            headers=headers,
            timeout=30
        )
        
        response.raise_for_status()
        data = response.json()
        
        return jsonify({
            'success': True,
            'data': data,
            'status_code': response.status_code
        })
        
    except requests.exceptions.JSONDecodeError as e:
        return jsonify({
            'success': False,
            'error': f'Invalid JSON response: {str(e)}',
            'raw_response': response.text[:500] if 'response' in locals() else 'No response'
        }), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


# ============== SQL PREVIEW & EXECUTE ==============
@api_scheduler_bp.route('/config/<int:config_id>/sql-preview')
def sql_preview(config_id):
    """CREATE TABLE SQL önizleme"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        abort(404)
    
    mappings = db.session.query(FieldMapping).filter_by(config_id=config_id).all()
    
    if not mappings:
        flash('Please add at least one field mapping first', 'warning')
        return redirect(url_for('api_scheduler.edit_mappings', config_id=config_id))
    
    sql = generate_create_table_sql(config, mappings)
    return render_template('api_scheduler/sql_preview.html', config=config, sql=sql)


@api_scheduler_bp.route('/config/<int:config_id>/execute-sql', methods=['POST'])
def execute_sql(config_id):
    """SQL'i çalıştır ve tabloyu oluştur"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        abort(404)
    
    custom_sql = request.form.get('custom_sql', '').strip()
    
    # Validate SQL
    if not validate_custom_sql(custom_sql, config.target_table):
        flash('Invalid or dangerous SQL detected!', 'danger')
        return redirect(url_for('api_scheduler.sql_preview', config_id=config_id))
    
    try:
        # Drop if exists
        db.session.execute(text(f'DROP TABLE IF EXISTS {config.target_table}'))
        
        # Execute CREATE TABLE
        db.session.execute(text(custom_sql))
        db.session.commit()
        
        flash(f'Table "{config.target_table}" created successfully!', 'success')
        return redirect(url_for('api_scheduler.dashboard'))
        
    except Exception as e:
        db.session.rollback()
        flash(f'Error creating table: {str(e)}', 'danger')
        return redirect(url_for('api_scheduler.sql_preview', config_id=config_id))


# ============== TOGGLE ACTIVE ==============
@api_scheduler_bp.route('/config/<int:config_id>/toggle', methods=['POST'])
def toggle_active(config_id):
    """Config'i aktif/pasif yap"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        return jsonify({'success': False, 'error': 'Not found'}), 404
    
    config.is_active = not config.is_active
    db.session.commit()
    schedule_jobs()
    return jsonify({'success': True, 'is_active': config.is_active})


# ============== LOGS ==============
@api_scheduler_bp.route('/config/<int:config_id>/logs')
def view_logs(config_id):
    """Execution loglarını göster"""
    config = db.session.query(APIConfiguration).get(config_id)
    if not config:
        abort(404)
    
    logs = db.session.query(ExecutionLog)\
        .filter_by(config_id=config_id)\
        .order_by(ExecutionLog.executed_at.desc())\
        .limit(50)\
        .all()
    
    return render_template('api_scheduler/logs.html', config=config, logs=logs)


# ============== HELPER FUNCTIONS ==============
def validate_url_safe(url):
    """SSRF koruması - private IP'leri engelle"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        hostname = parsed.hostname
        
        if not hostname:
            return False
        
        # IP adresini resolve et
        import socket
        ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(ip)
        
        # Private IP'leri engelle
        if ip_obj.is_private or ip_obj.is_loopback:
            return False
        
        return True
    except:
        return False


def generate_create_table_sql(config, mappings):
    """CREATE TABLE SQL oluştur"""
    columns = ['id SERIAL PRIMARY KEY', 'fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
    
    for mapping in mappings:
        col_def = f"{mapping.db_column_name} {mapping.db_column_type}"
        columns.append(col_def)
    
    sql = f"CREATE TABLE {config.target_table} (\n"
    sql += ",\n".join(f"  {col}" for col in columns)
    sql += "\n);"
    
    return sql


def validate_custom_sql(sql, expected_table):
    """SQL güvenlik validasyonu"""
    sql_upper = sql.upper()
    
    # Sadece CREATE TABLE izin ver
    if not sql_upper.startswith('CREATE TABLE'):
        return False
    
    # Tehlikeli keyword'leri engelle
    dangerous = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'GRANT', 'REVOKE', ';--', '/*', '*/']
    for keyword in dangerous:
        if keyword in sql_upper.replace('CREATE TABLE', ''):
            return False
    
    # Table ismini kontrol et
    if expected_table.upper() not in sql_upper:
        return False
    
    # ID ve FETCHED_AT zorunlu
    if not re.search(r'\bID\b.*\bSERIAL\b', sql_upper):
        return False
    if not re.search(r'\bFETCHED_AT\b.*\bTIMESTAMP\b', sql_upper):
        return False
    
    return True


# ============== LOG MANAGEMENT ==============
@api_scheduler_bp.route('/logs/<int:log_id>/delete', methods=['POST'])
def delete_log(log_id):
    """Delete a single log entry"""
    try:
        log = db.session.get(ExecutionLog, log_id)
        if not log:
            return jsonify({'success': False, 'error': 'Log not found'}), 404
        
        db.session.delete(log)
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400
@api_scheduler_bp.route('/logs/clear-all', methods=['POST'])
def clear_all_logs():
    """Delete all execution logs"""
    try:
        logs_to_delete = db.session.query(ExecutionLog).all()
        deleted_count = len(logs_to_delete)
        for log in logs_to_delete:
            db.session.delete(log)

        db.session.commit()
        
        return jsonify({'success': True, 'deleted': deleted_count})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 400
    
# ==================== SCHEDULER SETUP ====================


def fetch_api_data(config_id):
    """Fetch data from API and insert into table (with app context)"""
    global _app_instance
    
    if not _app_instance:
        logger.error("App instance not available!")
        return
    
    with _app_instance.app_context():
        config = db.session.get(APIConfiguration, config_id)
        if not config or not config.is_active:
            logger.info(f"Config {config_id} not active or not found, skipping")
            return
        
        try:
            logger.info(f"Starting scheduled fetch for config: {config.name}")
            
            # Prepare headers
            headers = {}
            if config.api_headers:
                try:
                    headers = json.loads(config.api_headers)
                except:
                    pass
            
            if config.api_key:
                headers['Authorization'] = f'Bearer {config.api_key}'
            
            # Fetch API data
            response = requests.request(
                method=config.api_method,
                url=config.api_url,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            # Get field mappings
            mappings = db.session.query(FieldMapping).filter_by(config_id=config.id).all()
            if not mappings:
                raise Exception("No field mappings configured")
            # ARRAY KONTROLÜ EKLE!
            if isinstance(data, list):
                # Array ise her eleman için işle
                records_inserted = 0
                for item in data:
                    row_data = {}
                    for mapping in mappings:
                        value = item
                        for key in mapping.api_field_path.split('.'):
                            value = value.get(key) if isinstance(value, dict) else None
                            if value is None:
                                break
                        
                        # Convert value to target type
                        if value is not None:
                            if mapping.db_column_type == 'JSONB':
                                row_data[mapping.db_column_name] = json.dumps(value) if not isinstance(value, str) else value
                            elif mapping.db_column_type == 'INTEGER':
                                row_data[mapping.db_column_name] = int(value)
                            elif mapping.db_column_type == 'FLOAT':
                                row_data[mapping.db_column_name] = float(value)
                            elif mapping.db_column_type == 'BOOLEAN':
                                row_data[mapping.db_column_name] = bool(value)
                            else:
                                row_data[mapping.db_column_name] = str(value)
                    
                    # Insert into table
                    if row_data:
                        # columns = ', '.join(row_data.keys()) + ', fetched_at'
                        # placeholders = ', '.join(['%s'] * len(row_data)) + ', NOW()'
                        # sql = f"INSERT INTO {config.target_table} ({columns}) VALUES ({placeholders})"
                        
                        # db.session.execute(text(sql), list(row_data.values()))
                        columns = ', '.join(row_data.keys()) + ', fetched_at'
                        placeholders = ', '.join([f":{key}" for key in row_data.keys()]) + ', NOW()'
                        sql = f"INSERT INTO {config.target_table} ({columns}) VALUES ({placeholders})"
                        db.session.execute(text(sql), row_data)

                        records_inserted += 1
                
                db.session.commit()
                
                # Log success
                log = ExecutionLog(
                    config_id=config.id,
                    status='success',
                    message=f'Successfully fetched and inserted {records_inserted} records',
                    records_inserted=records_inserted
                )
                db.session.add(log)
                db.session.commit()
                
                logger.info(f"✓ Scheduled job executed successfully for config: {config.name} ({records_inserted} records)")

            # Extract values from API response
            row_data = {}
            for mapping in mappings:
                value = data
                for key in mapping.api_field_path.split('.'):
                    value = value.get(key) if isinstance(value, dict) else None
                    if value is None:
                        break
                
                # Convert value to target type
                if value is not None:
                    if mapping.db_column_type == 'JSONB':
                        row_data[mapping.db_column_name] = json.dumps(value) if not isinstance(value, str) else value
                    elif mapping.db_column_type == 'INTEGER':
                        row_data[mapping.db_column_name] = int(value)
                    elif mapping.db_column_type == 'FLOAT':
                        row_data[mapping.db_column_name] = float(value)
                    elif mapping.db_column_type == 'BOOLEAN':
                        row_data[mapping.db_column_name] = bool(value)
                    else:
                        row_data[mapping.db_column_name] = str(value)
            
            # Insert into table
            if row_data:
                columns = ', '.join(row_data.keys()) + ', fetched_at'
                placeholders = ', '.join(['%s'] * len(row_data)) + ', NOW()'
                sql = f"INSERT INTO {config.target_table} ({columns}) VALUES ({placeholders})"
                
                db.session.execute(text(sql), list(row_data.values()))
                db.session.commit()
            
            # Log success
            log = ExecutionLog(
                config_id=config.id,
                status='success',
                message=f'Successfully fetched and inserted {len(row_data)} fields',
                records_inserted=1
            )
            db.session.add(log)
            db.session.commit()
            
            logger.info(f"✓ Scheduled job executed successfully for config: {config.name}")
            
        except Exception as e:
            # Log error
            error_msg = str(e)
            log = ExecutionLog(
                config_id=config.id,
                status='error',
                message=error_msg,
                records_inserted=0
            )
            db.session.add(log)
            db.session.commit()
            logger.error(f"✗ Scheduled job failed for config {config.name}: {error_msg}")
def schedule_jobs():
    """Schedule jobs for all active configurations"""
    global scheduler_started
    
    # Clear existing jobs
    scheduler.remove_all_jobs()
    
    # Add jobs for active configs
    configs = db.session.query(APIConfiguration).filter_by(is_active=True).all()
    for config in configs:
        scheduler.add_job(
            func=fetch_api_data,
            trigger=IntervalTrigger(seconds=config.schedule_interval),
            args=[config.id],
            id=f'api_fetch_{config.id}',
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=30
        )
        logger.info(f"✓ Scheduled job for config '{config.name}' every {config.schedule_interval}s")
    
    # Start scheduler if not started
    if not scheduler_started:
        try:
            scheduler.start()
            scheduler_started = True
            logger.info("✓ APScheduler started successfully")
        except Exception as e:
            logger.error(f"Failed to start scheduler: {e}")
# Initialize scheduler when blueprint is registered
try:
    schedule_jobs()
    logger.info("Scheduler initialized on blueprint load")
except Exception as e:
    logger.warning(f"Could not initialize scheduler on load: {e}")    