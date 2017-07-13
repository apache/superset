# pylint: disable=missing-docstring, too-few-public-methods
import datetime


class NewDate(datetime.date):
    @classmethod
    def today(cls):
        return cls(2010, 1, 1)


class Next(object):
    def __init__(self):
        datetime.date = NewDate
