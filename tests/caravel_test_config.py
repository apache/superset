from caravel.config import *

AUTH_USER_REGISTRATION_ROLE = 'alpha'
SQLALCHEMY_DATABASE_URI = 'sqlite:////tmp/caravel_unittests.db'
DEBUG = True
CARAVEL_WEBSERVER_PORT = 8081

# Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# continuous integration
if 'CARAVEL__SQLALCHEMY_DATABASE_URI' in os.environ:
    SQLALCHEMY_DATABASE_URI = os.environ.get('CARAVEL__SQLALCHEMY_DATABASE_URI')


class CeleryConfig(object):
    BROKER_URL = 'sqla+sqlite:////tmp/celerydb.sqlite'
    CELERY_IMPORTS = ('caravel.tasks', )
    CELERY_RESULT_BACKEND = 'db+sqlite:////tmp/celery_results.sqlite'
    CELERY_ANNOTATIONS = {'tasks.add': {'rate_limit': '1/s'}}
    CONCURRENCY = 1
CELERY_CONFIG = CeleryConfig
