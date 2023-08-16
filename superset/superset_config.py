import os
from superset.db_engine_specs.base import BaseEngineSpec


class CustomEngineSpec(BaseEngineSpec):

    @classmethod
    def decrypt_column(cls, column_name, value):
        decryption_key = os.environ.get('DECRYPTION_KEY')
        decrypted_value = f'abcd'
        return decrypted_value

LINK_EXPIRY_TIME = 86400
EMBED_DASHBOARD_ID = "c0cbbe88-7d43-41ed-842b-1c4024c9a315"
BASE_URL = "http://127.0.0.1:8088"
SENDER = "bipin@veefin.com"
APP_PASSWORD = "rvbyliacxhzkqdgt"

LOGGER_PATH = "/home/bipin/reporting-tool/reporting-tool-python/superset/custom/logs/"

USER_NAME = "admin"
USER_PASSWORD = "Infini@123"
FIRST_NAME = "admin"
LAST_NAME = "admin"

# for the IBL - superset ----
DB_USER = "admin"
DB_PASSWORD = "Infini@123"
DB_HOST = "localhost"
DB_NAME = "superset_dev"

PREVIOUS_SECRET_KEY = 'CHANGE_ME_TO_A_COMPLEX_RANDOM_SECRET'
SECRET_KEY = '98cGAjzq9Jj6J1+9ex3dY1zPc/7YMjxRpWit+QGaZ0t5VSI3bmY/PDef'
# SQLALCHEMY_DATABASE_URI = 'mysql://data_user:Infi123!@20.198.109.3/superset_dev'
# SQLALCHEMY_DATABASE_URI = 'mysql://test_user:test123@localhost/superset_local'
# SQLALCHEMY_DATABASE_URI = 'mysql://root:''@localhost/test_db'
SQLALCHEMY_DATABASE_URI = "sqlite:////home/bipin/reporting-tool/reporting-tool-python/superset/superset.db"
FILTER_STATE_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_filter_cache',
    'CACHE_REDIS_URL': 'redis://localhost:8000/0'
}
EXPLORE_FORM_DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_explore_cache',
    'CACHE_REDIS_URL': 'redis://localhost:8001/0'
}

CONTENT_SECURITY_POLICY_WARNING = False

FEATURE_FLAGS = {
    'ENABLE_TEMPLATE_PROCESSING': True,
    'DRILL_TO_DETAIL': True,
    'EMBEDDED_SUPERSET': True
}
SESSION_COOKIE_HTTPONLY = True  # Prevent cookie from being read by frontend JS?
SESSION_COOKIE_SECURE = True  # Prevent cookie from being transmitted over non-tls?
SESSION_COOKIE_SAMESITE = None  # One of [None, 'None', 'Lax', 'Strict']
PUBLIC_ROLE_NAME = "Gamma"
HTTP_HEADERS = {'X-Frame-Options': 'ALLOWALL'}

ENABLE_PROXY_FIX = True
ENABLE_CORS = True
CORS_OPTIONS = {
    'supports_credentials': True,
    'allow_headers': ['*'],
    'resources': ['*'],
    'origins': ['*']
}

WTF_CSRF_ENABLED = False

from superset.custom.email_scheduler import custom_route
def configure_extra_blueprints(app):
    app.register_blueprint(custom_route.email_bp)
    app.register_blueprint(custom_route.download_bp)
    app.register_blueprint(custom_route.token_bp)
FLASK_APP_MUTATOR = configure_extra_blueprints


