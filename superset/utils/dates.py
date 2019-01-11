from datetime import datetime

import pytz

EPOCH = datetime(1970, 1, 1)


def datetime_to_epoch(dttm):
    if dttm.tzinfo:
        dttm = dttm.replace(tzinfo=pytz.utc)
        epoch_with_tz = pytz.utc.localize(EPOCH)
        return (dttm - epoch_with_tz).total_seconds() * 1000
    return (dttm - EPOCH).total_seconds() * 1000


def now_as_float():
    return datetime_to_epoch(datetime.utcnow())
