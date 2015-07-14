from datetime import timedelta

FLASK_APP_PORT = 8088

ROW_LIMIT = 10000
SQLALCHEMY_DATABASE_URI = "sqlite:////tmp/panoramix.db"

DRUID_HOST = '10.181.47.80'
DRUID_PORT = 8080
DRUID_BASE_ENDPOINT = 'druid/v2'

COORDINATOR_HOST = '10.168.176.249'
COORDINATOR_PORT = '8080'
COORDINATOR_BASE_ENDPOINT = 'druid/coordinator/v1'

since_l = {
    '1hour': timedelta(hours=1),
    '1day': timedelta(days=1),
    '7days': timedelta(days=7),
    '28days': timedelta(days=28),
    'all': timedelta(days=365*100)
}

def get_pydruid_client():
    from pydruid import client
    return client.PyDruid(
        "http://{0}:{1}/".format(DRUID_HOST, DRUID_PORT),
        DRUID_BASE_ENDPOINT)
