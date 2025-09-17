# superset_config.py
import os
import datetime
import logging
import json
import traceback
from flask import request, redirect, url_for, g
from superset.security import SupersetSecurityManager
# Removed Flask-JWT-Extended - using Azure AD token validation instead
import hmac
import hashlib
import base64
import requests

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
 
SECRET_KEY = os.getenv("SUPERSET_SECRET_KEY")
SQLALCHEMY_DATABASE_URI = os.getenv("SUPERSET_DB_URI")
 
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

# Replay protection cache for JWT jti values
REPLAY_CACHE = RedisCache(
    host=REDIS_HOST,
    port=int(REDIS_PORT),
    key_prefix="superset_jti_",
    db=3
)

# Visual Customizations (Modern Method)
FAVICONS = [{"href": "/static/assets/custom/RMC_100.png"}]
APP_FAB_UI_BRAND_INFO = {
    "logo_icon": "/static/assets/custom/RMC_100.png",
    "logo_icon_width": 200,
    "logo_icon_target_path": "http://www.rockymountaincare.com/",
    "logo_icon_tooltip": "rockymountaincare.com",
    "brand_text": "RMC SUPERSET APP",
}

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

 
# Unified OAuth + JWT Configuration
from flask_appbuilder.security.manager import AUTH_OAUTH

# Primary authentication: OAuth with Azure AD (auto-redirect to Microsoft)
AUTH_TYPE = AUTH_OAUTH
AUTH_USER_REGISTRATION = True
AUTH_USER_REGISTRATION_ROLE = "myportaluser"

PUBLIC_ROLE_LIKE = None  # Disable anonymous/public access
AUTH_ROLE_PUBLIC = None  # No public role

# Production security settings
ENABLE_PROXY_FIX = True  # Handle reverse proxy headers
WTF_CSRF_ENABLED = True  # CSRF protection
# Session configuration consolidated with CORS settings below

# Azure OAuth Configuration
OAUTH_PROVIDERS = [
    {
        'name': 'azure',
        'token_key': 'access_token',
        'icon': 'fa-microsoft',
        'remote_app': {
            'client_id': os.getenv('AZURE_CLIENT_ID'),
            'client_secret': os.getenv('AZURE_CLIENT_SECRET'),
            'api_base_url': 'https://graph.microsoft.com/v1.0/',
            'client_kwargs': {
                'scope': 'openid email profile User.Read Group.Read.All'
            },
            'access_token_url': f'https://login.microsoftonline.com/{os.getenv("AZURE_TENANT_ID")}/oauth2/v2.0/token',
            'authorize_url': f'https://login.microsoftonline.com/{os.getenv("AZURE_TENANT_ID")}/oauth2/v2.0/authorize',
        }
    }
]

# Azure AD Configuration for OBO Token Validation
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "9b461294-9d11-4314-928e-277398086f19")
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "39ad4e02-9a76-4464-810b-eac74dbc0950")
AZURE_AD_CONFIG = {
    "tenant_id": AZURE_TENANT_ID,
    "client_id": AZURE_CLIENT_ID,
    "jwks_url": f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/discovery/v2.0/keys",
    "issuer": f"https://sts.windows.net/{AZURE_TENANT_ID}/",
    "audience": f"api://{AZURE_CLIENT_ID}",
    "leeway": 10,  # 10 seconds clock skew tolerance
    "cache_ttl": 24 * 3600,  # 24 hours
    "refresh_threshold": 0.75,  # Refresh at 75% TTL
}

# JWT Processing Configuration
JWT_IDENTITY_CLAIM = 'upn'
JWT_QUERY_STRING_NAME = 'proof'

# Legacy JWT settings (kept for compatibility)
FLASK_ENV = 'development'
FLASK_DEBUG = True

# Azure AD Token Validator
import jwt
import requests
import redis
import json
import time
from datetime import datetime, timedelta
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

class AzureADTokenValidator:
    def __init__(self, config):
        self.config = config
        self.redis_client = None
        try:
            self.redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
            self.redis_client.ping()  # Test connection
            logging.info("Azure AD Token Validator: Redis connection established")
        except Exception as e:
            logging.warning(f"Azure AD Token Validator: Redis unavailable, using memory cache: {e}")
            self._memory_cache = {}
    
    def _get_cache_key(self):
        return f"azure_ad_keys:{self.config['tenant_id']}"
    
    def _get_cached_keys(self):
        """Get JWKS keys from cache (Redis or memory fallback)"""
        if self.redis_client:
            try:
                cached_data = self.redis_client.get(self._get_cache_key())
                if cached_data:
                    return json.loads(cached_data)
            except Exception as e:
                logging.warning(f"Redis cache read failed: {e}")
        
        # Memory fallback
        if hasattr(self, '_memory_cache'):
            return self._memory_cache.get(self._get_cache_key())
        
        return None
    
    def _set_cached_keys(self, keys_data):
        """Set JWKS keys in cache with TTL"""
        cache_data = {
            "keys": keys_data,
            "cached_at": time.time(),
            "expires_at": time.time() + self.config['cache_ttl']
        }
        
        if self.redis_client:
            try:
                self.redis_client.setex(
                    self._get_cache_key(),
                    self.config['cache_ttl'],
                    json.dumps(cache_data)
                )
                return
            except Exception as e:
                logging.warning(f"Redis cache write failed: {e}")
        
        # Memory fallback
        if hasattr(self, '_memory_cache'):
            self._memory_cache[self._get_cache_key()] = cache_data
    
    def _fetch_jwks_keys(self):
        """Fetch JWKS keys from Microsoft with retry logic"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(
                    self.config['jwks_url'],
                    timeout=10,
                    headers={'User-Agent': 'Superset-Azure-AD-Validator/1.0'}
                )
                response.raise_for_status()
                jwks_data = response.json()
                
                # Parse and cache RSA keys
                parsed_keys = {}
                for key_data in jwks_data.get('keys', []):
                    if key_data.get('kty') == 'RSA' and key_data.get('use') == 'sig':
                        kid = key_data.get('kid')
                        if kid:
                            parsed_keys[kid] = key_data
                
                logging.info(f"Fetched {len(parsed_keys)} JWKS keys from Azure AD")
                self._set_cached_keys(parsed_keys)
                return parsed_keys
                
            except Exception as e:
                logging.warning(f"JWKS fetch attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt == max_retries - 1:
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff
        
        return {}
    
    def _get_signing_keys(self):
        """Get signing keys with caching and refresh logic"""
        cached_data = self._get_cached_keys()
        
        if cached_data:
            expires_at = cached_data.get('expires_at', 0)
            refresh_time = expires_at - (self.config['cache_ttl'] * (1 - self.config['refresh_threshold']))
            
            # Use cached keys if still valid
            if time.time() < expires_at:
                # Background refresh if approaching expiration
                if time.time() > refresh_time:
                    try:
                        self._fetch_jwks_keys()  # Background refresh
                    except Exception as e:
                        logging.warning(f"Background JWKS refresh failed: {e}")
                
                return cached_data['keys']
            else:
                logging.warning("Cached JWKS keys expired, fetching fresh keys")
        
        # Fetch fresh keys if cache miss or expired
        try:
            return self._fetch_jwks_keys()
        except Exception as e:
            logging.error(f"Failed to fetch JWKS keys: {e}")
            
            # Return expired cached keys as last resort
            if cached_data and cached_data.get('keys'):
                logging.warning("Using expired JWKS keys as fallback")
                return cached_data['keys']
            
            raise Exception("No JWKS keys available")
    
    def validate_token(self, token):
        """Validate Azure AD OBO token and return claims"""
        try:
            # Decode header to get key ID
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            if not kid:
                raise ValueError("Token missing 'kid' (key ID) in header")
            
            # Get signing keys
            signing_keys = self._get_signing_keys()
            
            if kid not in signing_keys:
                raise ValueError(f"Unknown key ID: {kid}")
            
            # Convert JWK to PEM format for PyJWT
            key_data = signing_keys[kid]
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
            
            # Validate token with full verification
            decoded_token = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                audience=self.config['audience'],
                issuer=self.config['issuer'],
                leeway=self.config['leeway']
            )
            
            logging.info(f"Token validated successfully for user: {decoded_token.get('upn', 'unknown')}")
            return decoded_token
            
        except jwt.ExpiredSignatureError:
            logging.warning("Token validation failed: Token expired")
            raise ValueError("Token expired")
        except jwt.InvalidAudienceError:
            logging.warning(f"Token validation failed: Invalid audience (expected: {self.config['audience']})")
            raise ValueError("Invalid token audience")
        except jwt.InvalidIssuerError:
            logging.warning(f"Token validation failed: Invalid issuer (expected: {self.config['issuer']})")
            raise ValueError("Invalid token issuer")
        except jwt.InvalidTokenError as e:
            logging.warning(f"Token validation failed: Invalid token - {e}")
            raise ValueError(f"Invalid token: {e}")
        except Exception as e:
            logging.error(f"Token validation error: {e}")
            raise ValueError(f"Token validation failed: {e}")

# Initialize global token validator
azure_token_validator = AzureADTokenValidator(AZURE_AD_CONFIG)

class UnifiedSecurityManager(SupersetSecurityManager):
    def __init__(self, appbuilder):
        super(UnifiedSecurityManager, self).__init__(appbuilder)
        logging.critical("Unified Security Manager initialized with OAuth + JWT support")
        self.auth_user_jwt_username_key = JWT_IDENTITY_CLAIM
       
        logging.critical(f"Using '{self.auth_user_jwt_username_key}' as the JWT username key")
 
    def auth_user_oauth(self, userinfo):
        """
        OAuth authentication path - called when user authenticates via Azure AD OAuth
        This creates the same user identity as JWT authentication for session continuity
        """
        logging.critical("========== AUTH_USER_OAUTH METHOD CALLED ==========")
        logging.critical(f"OAuth userinfo: {userinfo}")
        
        try:
            user_id = userinfo.get('userPrincipalName') or userinfo.get('upn') or userinfo.get('unique_name')
            if not user_id:
                logging.critical("No user identifier found in OAuth userinfo")
                return None
                
            # Get user groups from Microsoft Graph API
            azure_groups = self._get_user_groups_from_graph(userinfo.get('access_token'))
            
            # Use same user creation/update logic as JWT authentication
            return self._create_or_update_user(
                user_id=user_id,
                user_info={
                    'name': userinfo.get('displayName') or userinfo.get('name') or user_id,
                    'email': user_id,  # UPN serves as email address
                    'given_name': userinfo.get('given_name', ''),
                    'family_name': userinfo.get('family_name', ''),
                    'groups': azure_groups
                },
                auth_source='oauth'
            )
            
        except Exception as e:
            logging.critical(f"Error in auth_user_oauth: {str(e)}")
            logging.critical(f"OAuth auth traceback: {traceback.format_exc()}")
            return None
    
    def _get_user_groups_from_graph(self, access_token):
        """
        Retrieve user's groups from Microsoft Graph API with retry logic
        """
        import time
        
        if not access_token:
            logging.critical("No access token available for Graph API call")
            return []
            
        headers = {'Authorization': f'Bearer {access_token}'}
        url = 'https://graph.microsoft.com/v1.0/me/memberOf'
        
        # Retry logic with exponential backoff
        max_retries = 3
        base_delay = 1
        
        for attempt in range(max_retries):
            try:
                logging.critical(f"Graph API call attempt {attempt + 1}/{max_retries}")
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    groups_data = response.json()
                    group_ids = [group['id'] for group in groups_data.get('value', [])]
                    logging.critical(f"Retrieved {len(group_ids)} groups from Graph API")
                    return group_ids
                    
                elif response.status_code in [429, 503, 502, 504]:  # Retryable errors
                    delay = base_delay * (2 ** attempt)
                    logging.critical(f"Graph API retryable error {response.status_code}, retrying in {delay}s")
                    if attempt < max_retries - 1:
                        time.sleep(delay)
                        continue
                    
                else:  # Non-retryable errors
                    logging.critical(f"Graph API non-retryable error: {response.status_code} - {response.text}")
                    return []
                    
            except requests.exceptions.Timeout:
                delay = base_delay * (2 ** attempt)
                logging.critical(f"Graph API timeout on attempt {attempt + 1}, retrying in {delay}s")
                if attempt < max_retries - 1:
                    time.sleep(delay)
                    continue
                    
            except Exception as e:
                logging.critical(f"Graph API error on attempt {attempt + 1}: {str(e)}")
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    time.sleep(delay)
                    continue
        
        logging.critical("Graph API failed after all retry attempts")
        return []

    def auth_user_jwt(self, token):
        """
        JWT authentication path - called when WordPress provides OBO token
        This creates the same user identity as OAuth authentication for session continuity
        """
        logging.critical("========== AUTH_USER_JWT METHOD CALLED ==========")
        logging.critical(f"Token first 10 chars: {token[:10] if token else 'None'}")
       
        try:
            decoded_token = azure_token_validator.validate_token(token)
            logging.critical(f"Token decoded successfully")
           
            try:
                jti = decoded_token.get('jti')
                exp = decoded_token.get('exp')
                if not jti or not exp:
                    logging.critical("JWT missing jti or exp claims - replay protection not possible")
                    return None
                    
                if REPLAY_CACHE.get(jti):
                    logging.critical(f"SECURITY VIOLATION: Replay detected for jti={jti}")
                    return None
                    
                ttl = max(int(exp - datetime.datetime.now().timestamp()), 60)
                REPLAY_CACHE.set(jti, 1, timeout=ttl)
                logging.critical(f"JTI {jti} stored in replay cache with TTL {ttl}")
                
            except Exception as replay_err:
                logging.critical(f"SECURITY ERROR: Replay cache failure: {str(replay_err)}")
                logging.critical("SECURITY: Redis unavailable - failing JWT validation for security")
                return None  
                
            # Map identity and basic profile from Azure AD OBO token
            user_id = decoded_token.get(self.auth_user_jwt_username_key)  # upn
            azure_groups = decoded_token.get('groups', [])
            logging.critical(f"User ID from token: {user_id}")
            logging.critical(f"Groups from token: {len(azure_groups)}")
            logging.critical(f"Available token fields: {list(decoded_token.keys())}")
 
            if not user_id:
                logging.critical("No user identifier found in JWT.")
                return None
                
            # Use same user creation/update logic as OAuth authentication
            return self._create_or_update_user(
                user_id=user_id,
                user_info={
                    'name': decoded_token.get('name') or user_id,
                    'email': user_id,  # UPN serves as email address
                    'given_name': decoded_token.get('given_name', ''),
                    'family_name': decoded_token.get('family_name', ''),
                    'groups': azure_groups
                },
                auth_source='jwt'
            )
            
        except Exception as e:
            logging.critical(f"Error in auth_user_jwt: {str(e)}")
            logging.critical(f"JWT auth traceback: {traceback.format_exc()}")
            return None
    
    def _create_or_update_user(self, user_id, user_info, auth_source):
        """
        Unified user creation/update logic used by both OAuth and JWT authentication
        Ensures consistent user identity and role assignment regardless of auth path
        """
        logging.critical(f"========== UNIFIED USER CREATION ({auth_source.upper()}) ==========")
        logging.critical(f"User ID: {user_id}")
        logging.critical(f"User info: {user_info}")
        # Set replay protection context for JWT tokens
        if auth_source == 'jwt':
            # Note: Replay protection will be handled in the auth_user_jwt method
            pass
        
        user = self.find_user(username=user_id)
        if user:
            logging.critical(f"Existing user found: {user.username}")
        else:
            logging.critical(f"User '{user_id}' not found. Creating...")
            user_name = user_info['name']
            email = user_info['email']
            logging.critical(f"User details - Name: {user_name}, Email: {email}")
 
            first_name = user_info.get('given_name') or ''
            last_name = user_info.get('family_name') or ''
            
            if not first_name and not last_name:
                try:
                    first_name, last_name = user_name.split(" ", 1)
                except (ValueError, AttributeError):
                    first_name = user_id.split('@')[0]  # Use part before @ as fallback
                    last_name = ""
                    
            logging.critical(f"User names - First: '{first_name}', Last: '{last_name}'")
                
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
               
        logging.critical(f"User {user.username} confirmed - processing roles")

        superset_roles = []

        resolved_role_names: list[str] = []
        try:
            azure_groups = user_info.get('groups', [])
            if not isinstance(azure_groups, list):
                azure_groups = []
            mapping_db_uri = os.getenv('AZURE_ROLE_DB_URI')
            mapping_table = os.getenv('AZURE_ROLE_MAPPING_TABLE', 'dbo.ActiveEntraGroups')
            mapping_group_col = os.getenv('AZURE_ROLE_MAPPING_GROUP_COL', 'GroupId')
            mapping_role_col = os.getenv('AZURE_ROLE_MAPPING_ROLE_COL', 'DisplayName')
            
            logging.critical(f"Processing {len(azure_groups)} Azure groups for role mapping")
            
            if mapping_db_uri and azure_groups:
                from sqlalchemy import create_engine, text
                engine = create_engine(mapping_db_uri, pool_pre_ping=True)
                # Chunk guids to avoid parameter limits
                chunk_size = int(os.getenv('AZURE_ROLE_MAPPING_CHUNK', '100'))
                for i in range(0, len(azure_groups), chunk_size):
                    chunk = azure_groups[i:i+chunk_size]
                    placeholders = ','.join([f":g{j}" for j in range(len(chunk))])
                    sql = text(
                        f"SELECT {mapping_role_col} AS role_name FROM {mapping_table} WHERE {mapping_group_col} IN ({placeholders})"
                    )
                    params = {f"g{j}": chunk[j] for j in range(len(chunk))}
                    with engine.connect() as conn:
                        rows = conn.execute(sql, params).fetchall()
                        resolved_role_names.extend([r.role_name for r in rows])
                        
                logging.critical(f"Resolved {len(resolved_role_names)} roles from Azure SQL mapping")
                
            # If no DB mapping, default to using Azure group GUIDs verbatim as role names
            if not resolved_role_names and azure_groups:
                resolved_role_names = list(azure_groups)
                logging.critical(f"Using Azure group GUIDs as role names: {len(resolved_role_names)}")
                
        except Exception as map_err:
            logging.critical(f"Azure SQL role mapping error: {str(map_err)}")

        # Apply naming filters: keep roles that start with 'dashboard' or contain 'myportal' / 'beta myportal'
        try:
            filtered: list[str] = []
            for rn in resolved_role_names:
                lower = (rn or '').lower()
                if lower.startswith('dashboard') or ('myportal' in lower) or ('beta myportal' in lower):
                    filtered.append(rn)
            if filtered:
                resolved_role_names = filtered
                logging.critical(f"Filtered to {len(resolved_role_names)} roles after name filtering")
        except Exception as _:
            pass

        # Ensure default myportaluser
        default_role_name = os.getenv('DEFAULT_PORTAL_ROLE', 'myportaluser')
        if default_role_name not in resolved_role_names:
            resolved_role_names.append(default_role_name)
            
        logging.critical(f"Final role list: {resolved_role_names}")

        # Create/attach roles
        for role_name in resolved_role_names:
            try:
                role = self.find_role(role_name)
                if not role:
                    role = self.add_role(role_name)
                    logging.critical(f"Created role: {role_name}")
                superset_roles.append(role)
            except Exception as role_error:
                logging.critical(f"Error ensuring role {role_name}: {str(role_error)}")
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
            login_user(user, remember=True)  # Remember for cross-domain session sharing
            logging.critical(f"User logged in via flask_login.login_user(): {user.username}")
        except Exception as login_error:
            logging.critical(f"Error in flask_login: {str(login_error)}")
            logging.critical(f"Login error traceback: {traceback.format_exc()}")
        
        logging.critical(f"Unified auth successful ({auth_source}) - returning user: {user.username}")
        return user
 
    def handle_invalid_token(self, error_string=None):
        """Handle JWT token errors more gracefully."""
        logging.critical(f"Invalid JWT token: {error_string}")
        return None
    
    # def login_url(self, next_url=None):  # Commented out for JWT-only testing
    #     from flask import url_for
    #     logging.critical("login_url called - forcing OAuth redirect")
    #     
    #     oauth_login_url = url_for('AuthOAuthView.login', provider='azure')
    #     if next_url:
    #         oauth_login_url += f'?next={next_url}'
    #     
    #     logging.critical(f"Redirecting to OAuth: {oauth_login_url}")
    #     return oauth_login_url
 
 
CUSTOM_SECURITY_MANAGER = UnifiedSecurityManager
 
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
            decoded = azure_token_validator.validate_token(token)
            username = decoded.get(JWT_IDENTITY_CLAIM)  # Use 'upn' not 'username'
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
            decoded = azure_token_validator.validate_token(token)
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
 
# Unified SSO Session Configuration
# Session configuration moved to CORS section for consolidation

# MyPortal Configuration
TALISMAN_CONFIG = {
    'content_security_policy': {
        'frame-ancestors': ["'self'", "https://beta.myportal.rmcare.com", "https://myportal.rmcare.com", "https://stg-dashboards.rmcare.com"],
    },
    'force_https': False,
    'session_cookie_secure': False,
}
ENABLE_CORS = True
CORS_OPTIONS = {
  'supports_credentials': True,
  'allow_headers': ['Content-Type', 'Authorization', 'X-Requested-With'],
  'expose_headers': ['Set-Cookie'],
  'resources': {'*': {'origins': ['https://beta.myportal.rmcare.com', 'https://myportal.rmcare.com', 'https://stg-dashboards.rmcare.com']}},
}

# Session Configuration for Cross-Domain Support
SESSION_COOKIE_DOMAIN = '.rmcare.com'  # Shared across WordPress and Superset
SESSION_COOKIE_SECURE = True  # HTTPS only in production
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'None'  # Required for iframe embedding
SESSION_PERMANENT = False
PERMANENT_SESSION_LIFETIME = 3600  # 1 hour session timeout
 
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
                decoded = azure_token_validator.validate_token(token)
                username = decoded.get(JWT_IDENTITY_CLAIM)  # Use 'upn' not 'username'
               
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

    @app.route('/api/rmc/sso/init', methods=['POST'])
    def rmc_sso_init():
        try:
            data = request.get_json(silent=True) or {}
            payload_b64 = data.get('payload')
            sig = data.get('sig')
            if not payload_b64 or not sig:
                return (json.dumps({'error': 'missing payload or sig'}), 400, {'Content-Type': 'application/json'})

            shared = os.getenv('WP_SSO_SHARED_SECRET', '')
            if not shared:
                return (json.dumps({'error': 'server not configured'}), 500, {'Content-Type': 'application/json'})

            computed = hmac.new(shared.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(computed, sig):
                return (json.dumps({'error': 'invalid signature'}), 401, {'Content-Type': 'application/json'})

            try:
                payload_json = base64.urlsafe_b64decode(payload_b64 + '===').decode('utf-8')
                pointer = json.loads(payload_json)
            except Exception as e:
                logging.critical(f"Pointer decode error: {str(e)}")
                return (json.dumps({'error': 'bad payload'}), 400, {'Content-Type': 'application/json'})

            upn = pointer.get('upn') or pointer.get('email')
            name = pointer.get('name') or upn
            email = pointer.get('email') or upn
            if not upn:
                return (json.dumps({'error': 'missing upn'}), 400, {'Content-Type': 'application/json'})

            exchange_url = os.getenv('WP_SSO_EXCHANGE_URL', '')
            if exchange_url:
                try:
                    resp = requests.post(exchange_url, json={'payload': payload_b64, 'sig': sig}, timeout=5)
                    if resp.status_code == 200:
                        extra = resp.json()
                        upn = extra.get('upn', upn)
                        name = extra.get('name', name)
                        email = extra.get('email', email)
                except Exception as ex_err:
                    logging.critical(f"WP exchange error: {str(ex_err)}")

            resolved_role_names: list[str] = []
            try:
                mapping_db_uri = os.getenv('AZURE_ROLE_DB_URI')
                if mapping_db_uri:
                    from sqlalchemy import create_engine, text
                    engine = create_engine(mapping_db_uri, pool_pre_ping=True)
                    groups = pointer.get('groups') or []
                    if isinstance(groups, list) and groups:
                        # Map GUIDs to DisplayName
                        group_table = os.getenv('AZURE_ROLE_MAPPING_TABLE', 'AAD_Groups')
                        group_id_col = os.getenv('AZURE_ROLE_MAPPING_GROUP_COL', 'group_id')
                        group_name_col = os.getenv('AZURE_ROLE_MAPPING_ROLE_COL', 'DisplayName')
                        placeholders = ','.join([f":g{j}" for j in range(len(groups))])
                        sql = text(
                            f"SELECT {group_name_col} AS role_name FROM {group_table} WHERE {group_id_col} IN ({placeholders})"
                        )
                        params = {f"g{j}": groups[j] for j in range(len(groups))}
                        with engine.connect() as conn:
                            rows = conn.execute(sql, params).fetchall()
                            resolved_role_names.extend([r.role_name for r in rows])
                    else:
                        # Fallback to UPN→role mapping view
                        upn_table = os.getenv('AZURE_UPN_ROLE_VIEW', 'UserGroupMembershipView')
                        upn_col = os.getenv('AZURE_ROLE_MAPPING_UPN_COL', 'upn')
                        role_col = os.getenv('AZURE_ROLE_MAPPING_ROLE_COL', 'role_name')
                        sql = text(
                            f"SELECT {role_col} AS role_name FROM {upn_table} WHERE {upn_col} = :upn"
                        )
                        with engine.connect() as conn:
                            rows = conn.execute(sql, {'upn': upn}).fetchall()
                            resolved_role_names.extend([r.role_name for r in rows])
            except Exception as map_err:
                logging.critical(f"UPN role mapping error: {str(map_err)}")

            default_role_name = os.getenv('DEFAULT_PORTAL_ROLE', 'myportaluser')
            if default_role_name not in resolved_role_names:
                resolved_role_names.append(default_role_name)

            # Apply naming filters: startwith 'dashboard' or contains 'myportal'/'beta myportal'
            try:
                filtered: list[str] = []
                for rn in resolved_role_names:
                    lower = (rn or '').lower()
                    if lower.startswith('dashboard') or ('myportal' in lower) or ('beta myportal' in lower):
                        filtered.append(rn)
                if filtered:
                    resolved_role_names = filtered
            except Exception as _:
                pass

            # Ensure user and roles
            try:
                sm = app.appbuilder.sm
                user = sm.find_user(username=upn)
                first_name = name.split(' ', 1)[0] if name else upn
                last_name = name.split(' ', 1)[1] if name and ' ' in name else ''
                role_objects = []
                for rn in resolved_role_names:
                    role = sm.find_role(rn)
                    if not role:
                        role = sm.add_role(rn)
                        logging.critical(f"Created role: {rn}")
                    role_objects.append(role)
                if not user:
                    user = sm.add_user(
                        username=upn,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        role=role_objects[0] if role_objects else None
                    )
                else:
                    user.roles = role_objects
                # Log in
                from flask_login import login_user
                login_user(user)
                g.user = user
                return (json.dumps({'status': 'ok', 'user': upn, 'roles': [r.name for r in user.roles]}), 200, {'Content-Type': 'application/json'})
            except Exception as user_err:
                logging.critical(f"User setup error: {str(user_err)}")
                return (json.dumps({'error': 'user setup failed'}), 500, {'Content-Type': 'application/json'})
        except Exception as e:
            logging.critical(f"SSO init error: {str(e)}")
            return (json.dumps({'error': 'server error'}), 500, {'Content-Type': 'application/json'})
    @app.route('/debug-jwt')
    def debug_jwt():
        token = request.args.get('proof')
        result = {"received_token": False}
        if token:
            result["received_token"] = True
            result["token_length"] = len(token)
            try:
                decoded = azure_token_validator.validate_token(token)
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
                decoded = azure_token_validator.validate_token(test_token)
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
RECAPTCHA_PUBLIC_KEY = ""
