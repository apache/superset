import os
from werkzeug.contrib.cache import RedisCache

MAPBOX_API_KEY = os.getenv('MAPBOX_API_KEY', '')
CACHE_CONFIG = {
    'CACHE_TYPE': 'redis',
    'CACHE_DEFAULT_TIMEOUT': 300,
    'CACHE_KEY_PREFIX': 'superset_',
    'CACHE_REDIS_HOST': 'redis',
    'CACHE_REDIS_PORT': 6379,
    'CACHE_REDIS_DB': 1,
    'CACHE_REDIS_URL': 'redis://redis:6379/1'}
SQLALCHEMY_DATABASE_URI = \
    'postgresql+psycopg2://superset:superset@postgres:5432/superset'
SQLALCHEMY_TRACK_MODIFICATIONS = True
SECRET_KEY = 'thisISaSECRET_1234'


class CeleryConfig(object):
    BROKER_URL = 'redis://redis:6379/0'
    CELERY_IMPORTS = ('superset.sql_lab', )
    CELERY_RESULT_BACKEND = 'redis://redis:6379/0'
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}


CELERY_CONFIG = CeleryConfig
RESULTS_BACKEND = RedisCache(
    host='redis',
    port=6379,
    key_prefix='superset_results'
)
