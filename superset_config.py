from celery.schedules import crontab
from cachelib.redis import RedisCache

# Superset specific config
ROW_LIMIT = 5000

SUPERSET_WEBSERVER_PORT = 8088

SECRET_KEY = '6M9tGysqSvHs9iz+z2koC1wFzoQY1uKoePCiw1rbCbxQ3bnQUVIfl1cT'

POSTGRES_USER = 'bi'
POSTGRES_PASSWORD = '7kOS0E5ptCC^'
POSTGRES_HOST = 'zorp-prod.czqbkdy3uwjz.ap-south-1.rds.amazonaws.com'
POSTGRES_PORT = '5432'  # default is 5432
POSTGRES_DB = 'bi'
SQLALCHEMY_DATABASE_URI = f'postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}'

CACHE_CONFIG = {
    'CACHE_TYPE': 'SupersetMetastoreCache',
    'CACHE_DEFAULT_TIMEOUT': 1800,
    'CACHE_KEY_PREFIX': 'superset_metadata_cache_',
    'CACHE_REDIS_URL': 'redis://:zorpprodredispassword@prodredis.zorp.one:6379/2',
}

FILTER_STATE_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_filter_cache_',
    'CACHE_REDIS_URL': 'redis://:zorpprodredispassword@prodredis.zorp.one:6379/2'
}

DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_data_cache_',
    'CACHE_REDIS_URL': 'redis://:zorpprodredispassword@prodredis.zorp.one:6379/2'
}


FEATURE_FLAGS = {
    "ALERT_REPORTS": True
}

EXPLORE_FORM_DATA_CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_KEY_PREFIX': 'superset_formdata_cache_',
    'CACHE_REDIS_URL': 'redis://:zorpprodredispassword@prodredis.zorp.one:6379/2'
}


class CeleryConfig(object):
    broker_url = 'redis://:zorpprodredispassword@prodredis.zorp.one:6379/3'
    imports = (
        'superset.sql_lab',
        'superset.tasks',
	'superset.tasks.thumbnails',
    )
    result_backend = 'redis://:zorpprodredispassword@prodredis.zorp.one:6379/3'
    worker_log_level = 'INFO'
    worker_prefetch_multiplier = 10
    task_acks_late = True
    task_annotations = {
        'sql_lab.get_sql_results': {
            'rate_limit': '100/s',
        },
        'email_reports.send': {
            'rate_limit': '1/s',
            'time_limit': 120,
            'soft_time_limit': 150,
            'ignore_result': True,
        },
    }
    beat_schedule = {
       'reports.scheduler': {
            'task': 'reports.scheduler',
            'schedule': crontab(minute='*', hour='*'),
        },
        'reports.prune_log': {
            'task': 'reports.prune_log',
            'schedule': crontab(minute=0, hour=0),
        },
    }

CELERY_CONFIG = CeleryConfig

ALERT_REPORTS_NOTIFICATION_DRY_RUN = False
SCREENSHOT_LOCATE_WAIT = 100
SCREENSHOT_LOAD_WAIT = 600

# Slack configuration
SLACK_API_TOKEN = "xoxb-2149933522689-5214867547943-m39KC945sEnAKpYXScsWF7je"

# Email configuration
SMTP_HOST = "email-smtp.ap-south-1.amazonaws.com" 
SMTP_PORT = 465 
SMTP_STARTTLS = False
SMTP_SSL_SERVER_AUTH = False # If your using an SMTP server with a valid certificate
SMTP_SSL = True
SMTP_USER = "AKIAQUV53OZJ3KW7WME6" # use the empty string "" if using an unauthenticated SMTP server
SMTP_PASSWORD = "BLdPCx7JFqcPMu/qPNwPJksZYL3f4bc1rTL2suTbAHYv" # use the empty string "" if using an unauthenticated SMTP server
SMTP_MAIL_FROM = "notifications@zorphq.com"
EMAIL_REPORTS_SUBJECT_PREFIX = "[Zorp Alerts] " # optional - overwrites default value in config.py of "[Report] "

WEBDRIVER_TYPE = "chrome"
WEBDRIVER_OPTION_ARGS = [
    "--force-device-scale-factor=2.0",
    "--high-dpi-support=2.0",
    "--headless",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-extensions",
]

# This is for internal use, you can keep http
WEBDRIVER_BASEURL = "https://bi.zorp.one"
# This is the link sent to the recipient. Change to your domain, e.g. https://superset.mydomain.com
WEBDRIVER_BASEURL_USER_FRIENDLY = "https://bi.zorp.one"

THUMBNAIL_SELENIUM_USER = 'zorp'

RESULTS_BACKEND = RedisCache(
    host='prodredis.zorp.one', password = 'zorpprodredispassword', port=6379, key_prefix='superset_results', db=3)

# Flask-WTF flag for CSRF
WTF_CSRF_ENABLED = True
# Add endpoints that need to be exempt from CSRF protection
WTF_CSRF_EXEMPT_LIST = []
# A CSRF token that expires in 1 year
WTF_CSRF_TIME_LIMIT = 60 * 60 * 24 * 365

# Set this API key to enable Mapbox visualizations
MAPBOX_API_KEY = ''

SUPERSET_APP_NAME = "Zorp BI"
APP_NAME = "Zorp BI"
APP_ICON = "https://zorp-assets.s3.ap-south-1.amazonaws.com/LogoMain.svg"
FAVICONS = [{"href": "https://app.zorp.one/static/media/Logo.7295ec2c.svg"}]

LOGO_TARGET_PATH = "https://bi.zorp.one"

# Query timeout to 5 seconds
SUPERSET_WEBSERVER_TIMEOUT = 5
