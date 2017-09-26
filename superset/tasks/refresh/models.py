import json

from flask_appbuilder import Model

from sqlalchemy import (
    Column, String, Text, Integer,
    DateTime
)

from superset.utils import memoized
from superset.models.helpers import AuditMixinNullable

from datetime import datetime
from time import time
from crontab import CronTab

from .utils import round_time


class RefreshTask(Model, AuditMixinNullable):
    """Represents a scheduled refresh task for a datasource"""

    __tablename__ = 'refresh_tasks'
    id = Column(Integer, primary_key=True)
    crontab_str = Column(String(120), nullable=False)
    config = Column(Text, nullable=False)
    description = Column(String(250), nullable=True)

    def __repr__(self):
        return "{}: {}".format(str(self.id), self.crontab_str)

    def is_repeating(self):
        return True

    @memoized
    def config_json(self):
        return json.loads(config)

    @memoized
    def crontab_obj(self):
        entry = CronTab(self.crontab_str)
        return entry

    def time_to_execution(self):
        """Returns the time in seconds until this task executes"""
        return self.crontab_obj().next()

    def time_to_execution_nearest_sec(self):
        return round(self.time_to_execution())

    def abs_execution_time(self):
        # rounded to nearest second
        return round(self.time_to_execution() + time())

    def next_execution_date(self):
        """Returns the `datetime` of the next execution"""
        timestamp = self.time_to_execution() + time()
        date = datetime.fromtimestamp(timestamp)
        return round_time(date)

    def __cmp__(self, other):
        return cmp(other.abs_execution_time(), self.abs_execution_time())

    def run_task(self):
        print("THE TIME IS {}".format(str(round_time(datetime.now()))))
        print("RUNNING TASK {} SCHEDULED WITH {}".format(str(self.id), self.crontab_str))
