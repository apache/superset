from crontab import CronTab
from datetime import timedelta

def is_valid_crontab_str(crontab_str):
    try:
        CronTab(crontab_str)
    except ValueError:
        return False
    return True

def round_time(dt, roundTo=60):
    seconds = (dt.replace(tzinfo=None) - dt.min).seconds
    rounding = (seconds + roundTo/2) // roundTo * roundTo
    return dt + timedelta(0, rounding - seconds, -dt.microsecond)
