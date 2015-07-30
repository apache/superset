import config
from datetime import datetime
import parsedatetime
from app import db




def parse_human_datetime(s):
    """
    Use the parsedatetime lib to return ``datetime.datetime`` from human
    generated strings

    >>> parse_human_datetime("now") <= datetime.now()
    True
    """
    cal = parsedatetime.Calendar()
    return dttm_from_timtuple(cal.parse(s)[0])


def dttm_from_timtuple(d):
    return datetime(
        d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)


def parse_human_timedelta(s):
    """
    Use the parsedatetime lib to return ``datetime.datetime`` from human
    generated strings

    >>> parse_human_datetime("now") <= datetime.now()
    True
    """
    cal = parsedatetime.Calendar()
    dttm = dttm_from_timtuple(datetime.now().timetuple())
    d = cal.parse(s, dttm)[0]
    d = datetime(
        d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)
    return d - dttm
