import config
from datetime import timedelta, datetime
import parsedatetime

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


def parse_human_datetime(s):
    """
    Use the parsedatetime lib to return ``datetime.datetime`` from human
    generated strings

    >>> parse_human_datetime("now") <= datetime.now()
    True
    """
    cal = parsedatetime.Calendar()
    d = cal.parse(s)[0]
    return datetime(
        d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)
