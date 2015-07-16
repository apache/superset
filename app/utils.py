import config
from datetime import timedelta

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
        "http://{0}:{1}/".format(config.DRUID_HOST, config.DRUID_PORT),
        config.DRUID_BASE_ENDPOINT)


