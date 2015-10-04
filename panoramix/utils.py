from datetime import date, datetime, timedelta
from dateutil.parser import parse
import hashlib
from sqlalchemy.types import TypeDecorator, TEXT
import json
import parsedatetime
import functools
from panoramix import db


class memoized(object):
   """Decorator that caches a function's return value each time it is called.
   If called later with the same arguments, the cached value is returned, and
   not re-evaluated.
   """
   def __init__(self, func):
      self.func = func
      self.cache = {}
   def __call__(self, *args):
      try:
         return self.cache[args]
      except KeyError:
         value = self.func(*args)
         self.cache[args] = value
         return value
      except TypeError:
         # uncachable -- for instance, passing a list as an argument.
         # Better to not cache than to blow up entirely.
         return self.func(*args)
   def __repr__(self):
      """Return the function's docstring."""
      return self.func.__doc__
   def __get__(self, obj, objtype):
      """Support instance methods."""
      return functools.partial(self.__call__, obj)


def parse_human_datetime(s):
    """
    Use the parsedatetime lib to return ``datetime.datetime`` from human
    generated strings

    >>> parse_human_datetime('2015-04-03')
    datetime.datetime(2015, 4, 3, 0, 0)
    >>> parse_human_datetime('2/3/1969')
    datetime.datetime(1969, 2, 3, 0, 0)
    >>> parse_human_datetime("now") <= datetime.now()
    True
    >>> parse_human_datetime("yesterday") <= datetime.now()
    >>> date.today() - timedelta(1) == parse_human_datetime('yesterday').date()
    True
    """
    try:
        dttm = parse(s)
    except:
        cal = parsedatetime.Calendar()
        dttm = dttm_from_timtuple(cal.parse(s)[0])
    return dttm


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


class JSONEncodedDict(TypeDecorator):
    """Represents an immutable structure as a json-encoded string."""
    impl = TEXT
    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)

        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value


def color(s):
    """
    Get a consistent color from the same string using a hash function

    >>> color("foo")
    '#FF5A5F'
    """
    colors = [
        "#FF5A5F", "#007A87", "#7B0051", "#00D1C1", "#8CE071", "#FFB400",
        "#FFAA91", "#B4A76C", "#9CA299", "#565A5C",
        "#A14D83", "#4FA3AB", "#4EDED2", "#4EDED2", "#FFCA4F", "#FFC4B3",
        "#C9BF97", "#C9BF97", "#898C8C",
    ]
    h = hashlib.md5(s)
    i = int(h.hexdigest(), 16)
    return colors[i % len(colors)]


def init():
    """
    Inits the Panoramix application with security roles and such
    """
    from panoramix import appbuilder
    sm = appbuilder.sm
    alpha = sm.add_role("Alpha")
    from flask_appbuilder.security.sqla import models
    perms = db.session.query(models.PermissionView).all()
    for perm in perms:
        if perm.view_menu.name not in (
                'UserDBModelView', 'RoleModelView', 'ResetPasswordView',
                'Security'):
            sm.add_permission_role(alpha, perm)
    gamma = sm.add_role("Gamma")
    for perm in perms:
        s = perm.permission.name
        if(
                perm.view_menu.name not in (
                    'UserDBModelView',
                    'RoleModelView',
                    'ResetPasswordView',
                    'Security') and
                perm.permission.name not in (
                    'can_edit',
                    'can_add',
                    'can_save',
                    'can_download',
                    'muldelete',
                )):
            sm.add_permission_role(gamma, perm)
    session = db.session()
    for i in range(100):
        print(type(models.Table))
    for table in session.query(models.Table).all():
        print table
