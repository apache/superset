from caravel.config import *

AUTH_USER_REGISTRATION_ROLE = 'alpha'
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(DATA_DIR, 'unittests.db')
DEBUG = True
CARAVEL_WEBSERVER_PORT = 8081

# Allowing SQLALCHEMY_DATABASE_URI to be defined as an env var for
# continuous integration
if 'CARAVEL__SQLALCHEMY_DATABASE_URI' in os.environ:
    SQLALCHEMY_DATABASE_URI = os.environ.get('CARAVEL__SQLALCHEMY_DATABASE_URI')
