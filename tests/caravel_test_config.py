from caravel.config import *

AUTH_USER_REGISTRATION_ROLE = 'alpha'
SQLALCHEMY_DATABASE_URI = 'sqlite:////tmp/caravel_unittests.db'
# MySQL connection string for unit tests:
# SQLALCHEMY_DATABASE_URI = 'mysql://root:@localhost/caravel_db'
DEBUG = True
CARAVEL_WEBSERVER_PORT = 8081

# Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# continuous integration
if 'CARAVEL__SQLALCHEMY_DATABASE_URI' in os.environ:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'CARAVEL__SQLALCHEMY_DATABASE_URI')

SQL_CELERY_DB_FILE_PATH = '/tmp/celerydb.sqlite'
SQL_CELERY_RESULTS_DB_FILE_PATH = '/tmp/celery_results.sqlite'
SQL_SELECT_AS_CTA = True


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:///' + SQL_CELERY_DB_FILE_PATH
    CELERY_IMPORTS = ('caravel.tasks', )
    CELERY_RESULT_BACKEND = 'db+sqlite:///' + SQL_CELERY_RESULTS_DB_FILE_PATH
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '10/s'}}
    CONCURRENCY = 1
CELERY_CONFIG = CeleryConfig

