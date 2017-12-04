import json

from .processor import validate_config

from crontab import CronTab
from datetime import timedelta


def is_valid_crontab_str(crontab_str):
    """Validates a crontab expression"""
    try:
        CronTab(crontab_str)
    except ValueError:
        return False
    return True


def round_time(dt, roundTo=60):
    """Rounds a datetime to, by default, the nearest minute"""
    seconds = (dt.replace(tzinfo=None) - dt.min).seconds
    rounding = (seconds + roundTo/2) // roundTo * roundTo
    return dt + timedelta(0, rounding - seconds, -dt.microsecond)


def is_valid_task_config(config):
    """Performs basic JSON validation and then
    passes the object for task validation"""
    try:
        config_json = json.loads(config)
    except ValueError:
        return False
    return validate_config(config_json)
