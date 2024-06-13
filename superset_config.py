import smtplib
import os
from email.mime.text import MIMEText

# Superset specific config
ROW_LIMIT = 5000

# Flask App Builder configuration
# Your App secret key will be used for securely signing the session cookie
# and encrypting sensitive information on the database
# Make sure you are changing this key for your deployment with a strong key.
# Alternatively you can set it with `SUPERSET_SECRET_KEY` environment variable.
# You MUST set this for production environments or the server will refuse
# to start and you will see an error in the logs accordingly.


SECRET_KEY='dahm4pFDIe9yREpJLSmagZmiMpT9yOXl3GwNvp3zJaBcfP+SvHnK5yQm'
# The SQLAlchemy connection string to your database backend
# This connection defines the path to the database that stores your
# superset metadata (slices, connections, tables, dashboards, ...).
# Note that the connection information to connect to the datasources
# you want to explore are managed directly in the web UI
# The check_same_thread=false property ensures the sqlite client does not attempt
# to enforce single-threaded access, which may be problematic in some edge cases
#SQLALCHEMY_DATABASE_URI = 'sqlite:////home/reports/project/apachesuperset/superset/superset.db?charset=utf8'
# Flask-WTF flag for CSRF
WTF_CSRF_ENABLED = False
# Add endpoints that need to be exempt from CSRF protection
WTF_CSRF_EXEMPT_LIST = []
# A CSRF token that expires in 1 year
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 365

# Set this API key to enable Mapbox visualizations
MAPBOX_API_KEY = 'pk.eyJ1Ijoic3VwcmFhZG1pbiIsImEiOiJjbHhibDlpeTkwZ3lpMmxzM3RtYzE2bzRkIn0.kQnZj_sVLaRr6-ZcM_dBgw'
APP_NAME = "My Reporting Application"
APP_ICON = "/static/assets/images/favicon-16x16.png"

# Setting it to '/' would take the user to '/superset/welcome/'
LOGO_TARGET_PATH = '/'

# Specify tooltip that should appear when hovering over the App Icon/Logo
LOGO_TOOLTIP = "Supra Controls Pvt.Ltd"

# Specify any text that should appear to the right of the logo
LOGO_RIGHT_TEXT = "Supra Controls Pvt.Ltd"
FAVICONS=[{
    "href":"/static/assets/images/favicon-16x16.png",
    "sizes":"16*16",
    "type":"images/png",
    "rel":"icon",
},
{
    "href":"/static/assets/images/favicon-32x32.png",
    "sizes":"32*32",
    "type":"images/png",
    "rel":"icon",
}
]

ENABLE_ALERTS = True
ENABLE_SCHEDULED_EMAIL_REPORTS = True
ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
DEFAULT_FEATURE_FLAGS = {
  'ALERT_REPORTS': True,
  "ALLOW_ADHOC_SUBQUERY": True,
}

from celery.schedules import crontab

FEATURE_FLAGS = {
    "ALERT_REPORTS": True
}

REDIS_HOST = "localhost"
REDIS_PORT = "6379"


class CeleryConfig:
    broker_url = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    imports = (
        "superset.sql_lab",
        "superset.tasks.scheduler",
    )
    result_backend = f"redis://{REDIS_HOST}:{REDIS_PORT}/0"
    worker_prefetch_multiplier = 10
    task_acks_late = True
    task_annotations = {
        "sql_lab.get_sql_results": {
            "rate_limit": "100/s",
        },
    }
    beat_schedule = {
        "reports.scheduler": {
            "task": "reports.scheduler",
            "schedule": crontab(minute="*", hour="*"),
        },
        "reports.prune_log": {
            "task": "reports.prune_log",
            "schedule": crontab(minute=0, hour=0),
        },
    }
CELERY_CONFIG = CeleryConfig



SCREENSHOT_LOCATE_WAIT = 100
SCREENSHOT_LOAD_WAIT = 100
# EMAIL_PAGE_RENDER_WAIT = 10000
# Slack configuration
SLACK_API_TOKEN = "xoxb-"

# Email configuration
SMTP_HOST = "smtp.zoho.com" # change to your host
SMTP_PORT = 587 # your port, e.g. 587
SMTP_STARTTLS = True
SMTP_SSL_SERVER_AUTH = True # If your using an SMTP server with a valid certificate
SMTP_SSL = False
SMTP_USER = "jenisha@supracontrols.com" # use the empty string "" if using an unauthenticated SMTP server
SMTP_PASSWORD = "jeni@supra" # use the empty string "" if using an unauthenticated SMTP server
SMTP_MAIL_FROM = "jenisha@supracontrols.com"
EMAIL_REPORTS_SUBJECT_PREFIX = "[Superset] " # optional - overwrites default value in config.py of "[Report] "

# WebDriver configuration
CHROMEDRIVER_PATH = "/usr/lib/chromedriver"
# SCREENSHOT_LOCATE_WAIT = 100
# SCREENSHOT_LOAD_WAIT = 300

# Webdriver settings
WEBDRIVER_BASEURL = "http://localhost:8088"
WEBDRIVER_TYPE = "chrome"
WEBDRIVER_OPTION_ARGS = [
    "--force-device-scale-factor=1",
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-setuid-sandbox",
    "--disable-software-rasterizer",
    "--disable-web-security",
    "--disable-extensions",
    "--remote-debugging-port=9222",
    "--window-size=1920x1080",
]

# Adding CHROMEDRIVER_PATH to PATH
os.environ["PATH"] += os.pathsep + CHROMEDRIVER_PATH

# This is for internal use, you can keep http
#EBDRIVER_BASEURL = "http://localhost:8080"
# This is the link sent to the recipient. Change to your domain, e.g. https://superset.mydomain.com
WEBDRIVER_BASEURL_USER_FRIENDLY = "http://localhost:8080"
