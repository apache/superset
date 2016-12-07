# Global variables should be availbale to root user after swithching to root.
alias sudo='sudo -E'

# ---------------------------------------------------------
# Server specific config
# ---------------------------------------------------------
# Uncomment following lines only for production configuration.
export WEBSERVER_THREADS=30
export SUPERSET_WORKERS=10
export SUPERSET_WEBSERVER_TIMEOUT=300

# ---------------------------------------------------------
# App specific config
# ---------------------------------------------------------
# Secuirty Configuration
export SECRET_KEY='secretkeygoeshere'
export CSRF_ENABLED=True

# ---------------------------------------------------------
# Personlisation 
# ---------------------------------------------------------
# Applicaiton name and icon configuration
export APP_NAME="Gowtham Sai"
export APP_ICON='https://gowtham-sai.com/favicon.gif'

# ---------------------------------------------------------
# Celery Configuration
# ---------------------------------------------------------
# Secuirty Configuration
export C_FORCE_ROOT=True

# ---------------------------------------------------------
# Cache Configuration
# ---------------------------------------------------------
# Make sure redis is installed and running.
export CACHE_CONFIG="{\"CACHE_TYPE\": \"redis\", \"CACHE_DEFAULT_TIMEOUT\": 300, \"CACHE_KEY_PREFIX\": \"caravel_\", \"CACHE_REDIS_HOST\": \"127.0.0.1\", \"CACHE_REDIS_PORT\": 6379, \"CACHE_REDIS_DB\": 1, \"CACHE_REDIS_URL\": \"redis://localhost:6379/1\"}"

# ---------------------------------------------------------
# Database Configuration
# ---------------------------------------------------------
# Mysql Default Configuration
export SQLALCHEMY_DATABASE_URI='mysql://bi:!nsight3@localhost:3306/superset'