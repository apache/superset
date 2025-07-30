# superset_config.py
import os
import datetime
import logging
import json
import traceback
from flask import request, redirect, url_for, g
from superset.security import SupersetSecurityManager
from flask_jwt_extended import decode_token

# redis and celery
import os
from cachelib.redis import RedisCache
 
# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logging.getLogger('flask_jwt_extended').setLevel(logging.DEBUG)
logging.getLogger('jwt').setLevel(logging.DEBUG)
logging.getLogger('superset').setLevel(logging.DEBUG)
logging.getLogger('werkzeug').setLevel(logging.DEBUG)
jwt_logger = logging.getLogger('superset.jwt')
jwt_logger.setLevel(logging.DEBUG)
 
# Set SECRET_KEY
SECRET_KEY = os.getenv("SUPERSET_SECRET_KEY")
 
# --- CRITICAL FIX: Set SQLALCHEMY_DATABASE_URI directly ---
SQLALCHEMY_DATABASE_URI = os.getenv("SUPERSET_DB_URI")
 
# Check if the URI is actually set, and provide a helpful error if not:
if not SQLALCHEMY_DATABASE_URI:
    raise RuntimeError(
        "The SUPERSET_DB_URI environment variable is not set! "
        "Please ensure it's defined in your .env file and passed "
        "correctly to the Docker container."
    )

# Redis & Celery configuration
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_CELERY_DB", "0")
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Celery config
class CeleryConfig:
    broker_url = REDIS_URL
    result_backend = REDIS_URL
    imports = ("superset.sql_lab",)
    task_annotations = {"tasks.add": {"rate_limit": "10/s"}}
    task_acks_late = True
    task_reject_on_worker_lost = True
    worker_prefetch_multiplier = 1
    task_soft_time_limit = 300
    task_time_limit = 600
    timezone = "UTC"

CELERY_CONFIG = CeleryConfig

# Caching config
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": REDIS_HOST,
    "CACHE_REDIS_PORT": REDIS_PORT,
    "CACHE_REDIS_DB": 1,
    "CACHE_REDIS_URL": f"redis://{REDIS_HOST}:{REDIS_PORT}/1",
}
DATA_CACHE_CONFIG = CACHE_CONFIG

# Async SQL Lab
RESULTS_BACKEND = RedisCache(
    host=REDIS_HOST,
    port=int(REDIS_PORT),
    key_prefix="superset_results",
    db=2
)

# Visual Customizations
APP_NAME = "RMC_SUPERSET_APP"
APP_ICON = "/static/assets/custom/RMC_100.png"
APP_ICON_WIDTH = 200
# Path for routing when APP_ICON image is clicked
LOGO_TARGET_PATH = 'http://www.rockymountaincare.com/' # Forwards to /superset/welcome/home
LOGO_TOOLTIP = "rockymountaincare.com" # Text displayed when hovering.
FAVICONS = [{"href": "/static/assets/custom/RMC_100.png"}]

# Increase max number of rows included in table views and csv downloads
SQL_MAX_ROW = 50000
VIZ_ROW_LIMIT = 50000
 
# Customizations for the Superset UI to run stored procedures.
ALLOW_DML = True
 
# Enable Security views in Superset UI.
FAB_ADD_SECURITY_VIEWS = True

# Set MapBox API Key
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY")

# Debug MapBox API Key load
print(f"Attempting to get MAPBOX_API_KEY from environment...")
mapbox_key_value = os.getenv("MAPBOX_API_KEY")
# Add a check for None or empty string
if mapbox_key_value:
    print(f"Value FOUND for os.getenv('MAPBOX_API_KEY'): '{mapbox_key_value[:5]}...'") # Print first 5 chars
else:
    print(f"Value NOT FOUND or EMPTY for os.getenv('MAPBOX_API_KEY')")

 
# OAuth Config
AUTH_TYPE = 1
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "mJJWaB@x8mtD!@U6oR4n!85")
JWT_TOKEN_LOCATION = ['headers', 'query_string']
JWT_QUERY_STRING_NAME = 'proof'
JWT_ALGORITHM = 'HS256'
FLASK_ENV = 'development'
FLASK_DEBUG = True
JWT_IDENTITY_CLAIM = 'username'
JWT_DECODE_AUDIENCE = None
JWT_DECODE_LEEWAY = 10
JWT_DECODE_ALGORITHMS = ['HS256']
JWT_ERROR_MESSAGE_KEY = 'message'
JWT_PRIVATE_CLAIMS = ['username', 'email', 'roles']  # Not directly used by FAB, but good for documentation
 
# Enhanced JWT settings
JWT_COOKIE_SECURE = False  # Set to True in production with HTTPS
JWT_COOKIE_CSRF_PROTECT = False  # Set to True in production
JWT_ACCESS_TOKEN_EXPIRES = 3600 * 8  # 8 hours
 
# Custom Security Manager
class CustomSecurityManager(SupersetSecurityManager):
    def __init__(self, appbuilder):
        super(CustomSecurityManager, self).__init__(appbuilder)
        logging.critical("Custom Security Manager initialized")
        self.auth_user_jwt_username_key = JWT_IDENTITY_CLAIM
       
        logging.critical(f"Using '{self.auth_user_jwt_username_key}' as the JWT username key")
 
    def auth_user_jwt(self, token):
        """
        Handles authentication and user/role mapping based on the JWT.
        This method is called *after* the token has been validated.
        """
        logging.critical("========== AUTH_USER_JWT METHOD CALLED ==========")
        logging.critical(f"Token first 10 chars: {token[:10] if token else 'None'}")
       
        try:
            decoded_token = decode_token(token, allow_expired=True)
            logging.critical(f"Token decoded successfully")
           
            user_id = decoded_token.get(self.auth_user_jwt_username_key)
            roles_from_jwt = decoded_token.get('roles', [])
            logging.critical(f"User ID from token: {user_id}")
            logging.critical(f"Roles from token: {roles_from_jwt}")
 
            if not user_id:
                logging.critical("No user identifier found in JWT.")
                return None
 
            user = self.find_user(username=user_id)
            if user:
                logging.critical(f"Existing user found: {user.username}")
            else:
                logging.critical(f"User '{user_id}' not found. Creating...")
                user_name = decoded_token.get('user_name')
                email = decoded_token.get('email')
               
                logging.critical(f"User details - Name: {user_name}, Email: {email}")
 
                try:
                    first_name, last_name = user_name.split(" ", 1)
                except (ValueError, AttributeError):
                    first_name = user_id
                    last_name = ""
                    logging.critical(f"Could not split user_name: {user_name}. Using '{first_name}' and '{last_name}'.")
                
                # Add handling for race condition caused by duplicate iframes
                try:
                    user = self.add_user(
                        username=user_id,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        role=self.find_role('Public')
                    )
                    if user:
                        logging.critical(f"User creation successful: {user.username}")
                    else:
                        logging.critical(f"User creation returned None")
                except Exception as user_create_error:
                    error_msg = str(user_create_error)
                    logging.critical(f"Error creating user: {error_msg}")
                    logging.critical(f"User creation traceback: {traceback.format_exc()}")

                    if 'already exists' in error_msg or 'duplicate key' in error_msg:
                        logging.critical("User already exists in DB, retrying lookup...")
                        user = self.find_user(username=user_id)
                        if user:
                            logging.critical(f"User re-fetched after duplicate insert: {user.username}")
                        else:
                            logging.critical("User still not found after duplicate error")
                    else:
                        return None

            if not user:
                logging.critical("User is still None after attempted creation")
                return None
               
            logging.critical(f"User {user.username} confirmed - adding roles")
           
            superset_roles = []
           
            for role_name in roles_from_jwt:
                role = self.find_role(role_name)
                if role:
                    superset_roles.append(role)
                    logging.critical(f"Adding role {role_name}")
                else:
                    logging.critical(f"Role '{role_name}' not found in Superset")
 
                    try:
                        new_role = self.add_role(role_name)
                        if new_role:
                            superset_roles.append(new_role)
                            logging.critical(f"Created and added new role: {role_name}")
                    except Exception as role_error:
                        logging.critical(f"Error creating role {role_name}: {str(role_error)}")
 
            public_role = self.find_role('Public')
            if public_role and public_role not in superset_roles:
                superset_roles.append(public_role)
                logging.critical("Added 'Public' role to ensure minimal permissions")
 
            try:
                user.roles = superset_roles
                self.update_user(user)  
                logging.critical(f"User roles updated: {[r.name for r in user.roles]}")
            except Exception as role_update_error:
                logging.critical(f"Error updating user roles: {str(role_update_error)}")
                logging.critical(f"Role update traceback: {traceback.format_exc()}")
            
            try:
                g.user = user
                from flask_login import login_user
                login_user(user)
                logging.critical(f"User logged in via flask_login.login_user(): {user.username}")
            except Exception as login_error:
                logging.critical(f"Error in flask_login: {str(login_error)}")
                logging.critical(f"Login error traceback: {traceback.format_exc()}")
            
            logging.critical(f"Auth successful - returning user: {user.username}")
            return user
 
        except Exception as e:
            logging.critical(f"Error in auth_user_jwt: {str(e)}")
            logging.critical(f"Exception type: {type(e).__name__}")
            logging.critical(f"Full traceback: {traceback.format_exc()}")
            return None
 
    def handle_invalid_token(self, error_string=None):
        """Handle JWT token errors more gracefully."""
        logging.critical(f"Invalid JWT token: {error_string}")
        return None
 
 
# CUSTOM_SECURITY_MANAGER = CustomSecurityManager
 
# Set feature flags (enable the use of async queries, Dashboard RBAC)
FEATURE_FLAGS = {
    'ENABLE_TEMPLATE_PROCESSING': True,  # Enables Jinja templating
    'ALLOW_RUN_ASYNC': True,  # Enables async queries
    'DASHBOARD_RBAC': True, # Enables dashboard-level permissions
    "HORIZONTAL_FILTER_BAR": True # Enables switching of dashboard filters from left side to top
}
 
def yesterday_date():
    import datetime
    return (datetime.datetime.now() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
 
def date_calc(days_offset=0, date_format='%Y-%m-%d', base_date=None):
    import datetime
    if base_date:
        try:
            base_dt = datetime.datetime.strptime(base_date, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("Invalid base_date format. Must be YYYY-MM-DD.")
    else:
        base_dt = datetime.datetime.utcnow().date()
    
    target_dt = base_dt + datetime.timedelta(days=days_offset)
    return target_dt.strftime(date_format)
 
def current_username():
    import logging
    from flask import request, g
    
    logging.critical("current_username called")
    
    if hasattr(g, 'user') and g.user and hasattr(g.user, 'username'):
        logging.critical(f"Found username in g.user: {g.user.username}")
        return g.user.username
    
    token = request.args.get('proof')
    if not token and 'Proof' in request.headers:
        token = request.headers.get('Proof')
    if not token and 'Authorization' in request.headers:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if token:
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(token, allow_expired=True)
            username = decoded.get('username')
            logging.critical(f"Found username in JWT: {username}")
            return username
        except Exception as e:
            logging.critical(f"JWT decode error: {str(e)}")
    
    logging.critical("Username not found, returning None")
    return None
 
def current_user_id():
    import logging
    from flask import request, g
    
    logging.critical("current_user_id called")
    
    if hasattr(g, 'user') and g.user and hasattr(g.user, 'id'):
        logging.critical(f"Found user_id in g.user: {g.user.id}")
        return g.user.id
    
    token = request.args.get('proof')
    if not token and 'Proof' in request.headers:
        token = request.headers.get('Proof')
    if not token and 'Authorization' in request.headers:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if token:
        try:
            from flask_jwt_extended import decode_token
            decoded = decode_token(token, allow_expired=True)
            user_id = decoded.get('sub')
            logging.critical(f"Found user_id in JWT: {user_id}")
            return user_id
        except Exception as e:
            logging.critical(f"JWT decode error: {str(e)}")
    
    logging.critical("User ID not found, returning None")
    return None
 
def current_user_role():
    import logging
    from flask import g
    
    logging.critical("current_user_role called")
    
    if hasattr(g, 'user') and g.user and hasattr(g.user, 'roles'):
        roles = [r.name for r in g.user.roles]
        logging.critical(f"Found roles in g.user: {roles}")
        return roles
    
    return []
 
JINJA_CONTEXT_ADDONS = {
    'yesterday': yesterday_date,
    'date_calc': date_calc,
    'current_username': current_username,
    'current_user_id': current_user_id,
    'current_user_role': current_user_role
}

# This new flag sets the horizontal layout as the default for all NEW dashboards
DASHBOARD_HORIZONTAL_FILTER_BAR_DEFAULT = True
 
# MyPortal Configuration
TALISMAN_CONFIG = {
    'content_security_policy': {
        'frame-ancestors': ["'self'", "https://beta.myportal.rmcare.com", "https://myportal.rmcare.com"],
    },
    'force_https': False,
    'session_cookie_secure': False,
}
ENABLE_CORS = True
CORS_OPTIONS = {
  'supports_credentials': True,
  'allow_headers': ['Content-Type', 'Authorization'],
  'resources': {'*': {'origins': '*'}},
}
 
# Colors schemes
EXTRA_CATEGORICAL_COLOR_SCHEMES = [
{
"id": 'Rocky_Mountain_BI_Colors_Contrast_c16',
"description": '',
"label": 'Rocky Mountain BI Colors Contrast c16',
"colors": ['#063457', '#3d3f6c', '#6b4879', '#98507b', '#bd5d75', '#d87168', '#e58e5b', '#e5af55', '#42638a', '#706d98', '#98789f', '#bb85a0', '#d6969e', '#e8ab9d', '#f1c3a1', '#f3ddad']
},
{
"id": 'Rocky_Mountain_BI_Colors_Contrast_c14_Shuffled',
"description": '',
"label": 'Rocky Mountain BI Colors Contrast c14 Shuffled',
"colors": ['#063457', '#7b4a7b', '#d0696d', '#e5af55', '#45416f', '#ab5579', '#e4895d', '#42638a', '#a57ca0', '#e3a39d', '#f3ddad', '#776f9a', '#ca8d9f', '#f0bfa0']
},
{
"id": 'Rocky_Mountain_BI_Colors_Contrast_c12',
"description": '',
"label": 'Rocky Mountain BI Colors Contrast c12',
"isDefault": True,
"colors": ['#063457', '#504373', '#8f4e7c', '#c36073', '#e28260', '#e5af55', '#42638a', '#80729c', '#b582a0', '#da9a9e', '#eeb99e', '#f3ddad']
},
{
"id": 'Rocky_Mountain_BI_Colors_Contrast_c08',
"description": '',
"label": 'Rocky Mountain BI Colors Contrast c8',
"colors": ['#063457', '#7b4a7b', '#d0696d', '#e5af55', '#42638a', '#a57ca0', '#e3a39d', '#f3ddad']
}]
 
EXTRA_SEQUENTIAL_COLOR_SCHEMES = [
{
"id": 'Rocky_Mountain_BI_Colors_Divergent_Universal',
"description": '',
"label": 'Rocky Mountain BI Colors Divergent Universal',
"idDiverging": True,
"colors": ['#00446a', '#5f7995', '#a7b3c2', '#f1f1f1', '#cfb2a8', '#aa7764', '#813e27']
},
{
"id": 'Rocky_Mountain_BI_Colors_Sequential',
"description": '',
"label": 'Rocky Mountain BI Colors Sequential',
"idDiverging": False,
"colors": ['#e5af55', '#e58e5b', '#d87168', '#bd5d75', '#98507b', '#6b4879', '#3d3f6c', '#063457']
}]
 
def flask_app_mutator(app):
    try:
        security_manager = app.appbuilder.sm
        roles_to_create = ["myportaluser", "superset-group1", "superset-group2"]
       
        for role_name in roles_to_create:
            if not security_manager.find_role(role_name):
                logging.info(f"Creating missing role: {role_name}")
                security_manager.add_role(role_name)
            else:
                logging.info(f"Role already exists: {role_name}")
               
        logging.info("Finished checking/creating roles")
    except Exception as e:
        logging.exception(f"Error creating roles: {e}")
       
    @app.before_request
    def process_jwt_for_every_request():
        path = request.path
        logging.critical(f"BEFORE_REQUEST FIRED: {path}")
       
        if path.startswith('/static/') or path.startswith('/healthz'):
            return None
        token = request.args.get('proof')
        if not token and 'Proof' in request.headers:
            token = request.headers.get('Proof')
        if not token and 'Authorization' in request.headers:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
       
        if token:
            logging.critical(f"TOKEN FOUND IN REQUEST: {path}")
           
            try:
                decoded = decode_token(token, allow_expired=True)
                username = decoded.get('username')
               
                if username:
                    logging.critical(f"TOKEN USERNAME: {username}")
                   
                    try:
                        from flask_appbuilder.security.sqla.models import User
                        db = app.appbuilder.get_session
                        existing_user = db.query(User).filter_by(username=username).first()
                       
                        if existing_user:
                            logging.critical(f"USER EXISTS IN DB: {username}")
                        else:
                            logging.critical(f"USER DOES NOT EXIST IN DB, CREATING: {username}")
                    except ImportError as e:
                        logging.critical(f"Import error: {str(e)}")
                        existing_user = app.appbuilder.sm.find_user(username=username)
                        if existing_user:
                            logging.critical(f"USER EXISTS (via SM): {username}")
                        else:
                            logging.critical(f"USER DOES NOT EXIST (via SM): {username}")
                       
                        user_name = decoded.get('user_name', '')
                        email = decoded.get('email', username)
                        roles = decoded.get('roles', [])
                        name_parts = user_name.split(' ', 1)
                        first_name = name_parts[0] if len(name_parts) > 0 else ''
                        last_name = name_parts[1] if len(name_parts) > 1 else ''
                       
                        try:
                            sm = app.appbuilder.sm
                            role_objects = []
                            for role_name in roles:
                                role = sm.find_role(role_name)
                                if not role:
                                    role = sm.add_role(role_name)
                                    logging.critical(f"Created role: {role_name}")
                                role_objects.append(role)
                           
                            public_role = sm.find_role('myportaluser')
                            if public_role and public_role not in role_objects:
                                role_objects.append(public_role)
 
                            # Find or create the user
                            user = sm.find_user(username=username)
                            if not user:
                                user = sm.add_user(
                                    username=username,
                                    first_name=first_name,
                                    last_name=last_name,
                                    email=email,
                                    role=role_objects[0] if role_objects else None # First role is primary
                                )
 
                                logging.critical(f"Created user: {username}")
                                # Add additional roles
                                for role in role_objects[1:]:
                                    sm.add_user_role(new_user, role)
                            else:
                                logging.critical(f"User already exists: {username}")
                                # Update user roles. Important for role changes in the JWT.
                                user.roles = role_objects
                                logging.critical(f"Updated roles for user: {username} with {len(role_objects)} roles")
 
                           # *** CRITICAL: Set the user in the Flask login context ***
                            sm.set_flask_login_user(new_user)
                            logging.critical(f"Auto-logged in new user: {username}")
                           
                        except Exception as user_create_error:
                            logging.critical(f"Error creating user: {str(user_create_error)}")
                            logging.critical(traceback.format_exc())
                   
                    if not g.get('user') or not g.get('user').is_authenticated:
                        try:
                            user = app.appbuilder.sm.auth_user_jwt(token)
                            if user:
                                logging.critical(f"USER AUTHENTICATED: {user.username}")
                        except Exception as auth_error:
                            logging.critical(f"AUTH ERROR: {str(auth_error)}")
               
            except Exception as e:
                logging.critical(f"JWT PROCESSING ERROR: {str(e)}")
                logging.critical(traceback.format_exc())
    @app.route('/debug-jwt')
    def debug_jwt():
        token = request.args.get('proof')
        result = {"received_token": False}
        if token:
            result["received_token"] = True
            result["token_length"] = len(token)
            try:
                decoded = decode_token(token, allow_expired=True)
                result["payload"] = decoded
                current_timestamp = datetime.datetime.now().timestamp()
                if 'exp' in decoded:
                    exp_timestamp = decoded['exp']
                    result["token_expiration"] = {
                        "expires_at": exp_timestamp,
                        "current_time": current_timestamp,
                        "seconds_until_expiry": exp_timestamp - current_timestamp,
                        "is_expired": exp_timestamp <= current_timestamp
                    }
                configured_claim_present = JWT_IDENTITY_CLAIM in decoded
                result["token_identity"] = {
                    "has_username": "username" in decoded,
                    "has_sub": "sub" in decoded,
                    "configured_identity_claim": JWT_IDENTITY_CLAIM,
                    "configured_claim_present": configured_claim_present,
                    "identity_value": decoded.get(JWT_IDENTITY_CLAIM)
                }
                if not configured_claim_present:
                    result["identity_warning"] = f"The configured identity claim '{JWT_IDENTITY_CLAIM}' is missing from token!"
                    alternative_claims = []
                    if "username" in decoded and JWT_IDENTITY_CLAIM != "username":
                        alternative_claims.append("username")
                    if "sub" in decoded and JWT_IDENTITY_CLAIM != "sub":
                        alternative_claims.append("sub")
                    if alternative_claims:
                        result["identity_suggestion"] = f"Consider changing JWT_IDENTITY_CLAIM to one of these available claims: {alternative_claims}"
                logging.info(f"Successfully decoded token with payload: {json.dumps(decoded)}")
            except Exception as e:
                result["decode_error"] = str(e)
                logging.error(f"Error decoding token: {str(e)}")
        return json.dumps(result, indent=2)
 
    @app.route('/jwt-debug-status')
    def jwt_debug_status():
        result = {
            "before_request_registered": True,
            "app_name": app.name,
            "auth_type": app.config.get('AUTH_TYPE'),
            "jwt_settings": {
                "token_location": app.config.get('JWT_TOKEN_LOCATION'),
                "query_string_name": app.config.get('JWT_QUERY_STRING_NAME'),
                "identity_claim": app.config.get('JWT_IDENTITY_CLAIM')
            },
            "custom_sm_active": isinstance(app.appbuilder.sm, CustomSecurityManager),
            "username_key": app.appbuilder.sm.auth_user_jwt_username_key if hasattr(app.appbuilder.sm, 'auth_user_jwt_username_key') else None,
        }
       
        test_token = request.args.get('proof')
        if test_token:
            try:
                decoded = decode_token(test_token, allow_expired=True)
                result["token_test"] = {
                    "decoded": True,
                    "username": decoded.get('username'),
                    "roles": decoded.get('roles')
                }
               
                try:
                    auth_result = app.appbuilder.sm.auth_user_jwt(test_token)
                    result["auth_test"] = {
                        "success": auth_result is not None,
                        "username": auth_result.username if auth_result else None
                    }
                except Exception as auth_e:
                    result["auth_test"] = {
                        "success": False,
                        "error": str(auth_e)
                    }
            except Exception as e:
                result["token_test"] = {
                    "decoded": False,
                    "error": str(e)
                }
       
        return json.dumps(result, indent=2)
 
    @app.route('/check-roles')
    def check_roles():
        if not g.user or not g.user.is_authenticated:
            return json.dumps({"error": "Not authenticated", "status": "Please login with JWT token"})
       
        try:
            roles = [r.name for r in g.user.roles]
            permissions = list(g.user.permissions)
           
            return json.dumps({
                "username": g.user.username,
                "full_name": f"{g.user.first_name} {g.user.last_name}",
                "email": g.user.email,
                "roles": roles,
                "is_admin": g.user.is_admin(),
                "permissions": permissions
            }, indent=2)
        except Exception as e:
            return json.dumps({
                "error": "Error getting user details",
                "message": str(e),
                "traceback": traceback.format_exc()
            }, indent=2)

    @app.route('/test-template-functions')
    def test_template_functions():
        from superset import jinja_context
        import inspect
        import json
        
        result = {
            "available_functions": [],
            "test_results": {}
        }
        
        for name, func in inspect.getmembers(jinja_context, inspect.isfunction):
            result["available_functions"].append(name)
        
        if hasattr(jinja_context, 'current_username'):
            try:
                result["test_results"]["current_username"] = jinja_context.current_username()
            except Exception as e:
                result["test_results"]["current_username_error"] = str(e)
        else:
            result["test_results"]["current_username_error"] = "Function not found in jinja_context"
            
        if hasattr(jinja_context, 'current_user_id'):
            try:
                result["test_results"]["current_user_id"] = jinja_context.current_user_id()
            except Exception as e:
                result["test_results"]["current_user_id_error"] = str(e)
        else:
            result["test_results"]["current_user_id_error"] = "Function not found in jinja_context"
        
        result["jinja_context_addons"] = {k: str(v) for k, v in app.config.get('JINJA_CONTEXT_ADDONS', {}).items()}
        
        return json.dumps(result, indent=2)
 
    return app
 
FLASK_APP_MUTATOR = flask_app_mutator
