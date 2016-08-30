from caravel.config import *

AUTH_USER_REGISTRATION_ROLE = 'alpha'
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'unittests.db')
DEBUG = True
CARAVEL_WEBSERVER_PORT = 8081

# Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# continuous integration
if 'CARAVEL__SQLALCHEMY_DATABASE_URI' in os.environ:
    SQLALCHEMY_DATABASE_URI = os.environ.get('CARAVEL__SQLALCHEMY_DATABASE_URI')

SQL_CELERY_DB_FILE_PATH =  os.path.join(DATA_DIR, 'celerydb.sqlite')
SQL_CELERY_RESULTS_DB_FILE_PATH =  os.path.join(DATA_DIR, 'celery_results.sqlite')
SQL_SELECT_AS_CTA = True
SQL_MAX_ROW = 666

TESTING = True
CSRF_ENABLED = False
SECRET_KEY = 'thisismyscretkey'
WTF_CSRF_ENABLED = False
PUBLIC_ROLE_LIKE_GAMMA = True


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:///' + SQL_CELERY_DB_FILE_PATH
    CELERY_IMPORTS = ('caravel.sql_lab', )
    CELERY_RESULT_BACKEND = 'db+sqlite:///' + SQL_CELERY_RESULTS_DB_FILE_PATH
    CELERY_ANNOTATIONS = {'sql_lab.add': {'rate_limit': '10/s'}}
    CONCURRENCY = 1
CELERY_CONFIG = CeleryConfig
