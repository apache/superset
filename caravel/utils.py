"""Utility functions used across Caravel"""

from datetime import datetime
import hashlib
import functools
import json
import logging

from dateutil.parser import parse
from sqlalchemy.types import TypeDecorator, TEXT
from markdown import markdown as md
import parsedatetime
from flask_appbuilder.security.sqla import models as ab_models


class memoized(object):  # noqa

    """Decorator that caches a function's return value each time it is called

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


def list_minus(l, minus):
    """Returns l without what is in minus

    >>> list_minus([1, 2, 3], [2])
    [1, 3]
    """
    return [o for o in l if o not in minus]


def parse_human_datetime(s):
    """
    Returns ``datetime.datetime`` from human readable strings

    >>> from datetime import date, timedelta
    >>> from dateutil.relativedelta import relativedelta
    >>> parse_human_datetime('2015-04-03')
    datetime.datetime(2015, 4, 3, 0, 0)
    >>> parse_human_datetime('2/3/1969')
    datetime.datetime(1969, 2, 3, 0, 0)
    >>> parse_human_datetime("now") <= datetime.now()
    True
    >>> parse_human_datetime("yesterday") <= datetime.now()
    True
    >>> date.today() - timedelta(1) == parse_human_datetime('yesterday').date()
    True
    >>> year_ago_1 = parse_human_datetime('one year ago').date()
    >>> year_ago_2 = (datetime.now() - relativedelta(years=1) ).date()
    >>> year_ago_1 == year_ago_2
    True
    """
    try:
        dttm = parse(s)
    except Exception:
        try:
            cal = parsedatetime.Calendar()
            dttm = dttm_from_timtuple(cal.parse(s)[0])
        except Exception as e:
            logging.exception(e)
            raise ValueError("Couldn't parse date string [{}]".format(s))
    return dttm


def dttm_from_timtuple(d):
    return datetime(
        d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)


def merge_perm(sm, permission_name, view_menu_name):
    pv = sm.find_permission_view_menu(permission_name, view_menu_name)
    if not pv:
        sm.add_permission_view_menu(permission_name, view_menu_name)


def parse_human_timedelta(s):
    """
    Returns ``datetime.datetime`` from natural language time deltas

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


class ColorFactory(object):

    """Used to generated arrays of colors server side"""

    BNB_COLORS = [
        # rausch    hackb      kazan      babu      lima        beach     barol
        '#ff5a5f', '#7b0051', '#007A87', '#00d1c1', '#8ce071', '#ffb400', '#b4a76c',
        '#ff8083', '#cc0086', '#00a1b3', '#00ffeb', '#bbedab', '#ffd266', '#cbc29a',
        '#ff3339', '#ff1ab1', '#005c66', '#00b3a5', '#55d12e', '#b37e00', '#988b4e',
    ]

    def __init__(self, hash_based=False):
        self.d = {}
        self.hash_based = hash_based

    def get(self, s):
        """Gets a color from a string and memoize the association

        >>> cf = ColorFactory()
        >>> cf.get('item_1')
        '#ff5a5f'
        >>> cf.get('item_2')
        '#7b0051'
        >>> cf.get('item_1')
        '#ff5a5f'
        """
        if self.hash_based:
            s = s.encode('utf-8')
            h = hashlib.md5(s)
            i = int(h.hexdigest(), 16)
        else:
            if s not in self.d:
                self.d[s] = len(self.d)
            i = self.d[s]
        return self.BNB_COLORS[i % len(self.BNB_COLORS)]


def init(caravel):
    """Inits the Caravel application with security roles and such"""
    db = caravel.db
    models = caravel.models
    sm = caravel.appbuilder.sm
    alpha = sm.add_role("Alpha")
    admin = sm.add_role("Admin")

    merge_perm(sm, 'all_datasource_access', 'all_datasource_access')

    perms = db.session.query(ab_models.PermissionView).all()
    for perm in perms:
        if perm.permission.name == 'datasource_access':
            continue
        if perm.view_menu and perm.view_menu.name not in (
                'UserDBModelView', 'RoleModelView', 'ResetPasswordView',
                'Security'):
            sm.add_permission_role(alpha, perm)
        sm.add_permission_role(admin, perm)
    gamma = sm.add_role("Gamma")
    for perm in perms:
        if(
                perm.view_menu and perm.view_menu.name not in (
                    'ResetPasswordView',
                    'RoleModelView',
                    'UserDBModelView',
                    'Security') and
                perm.permission.name not in (
                    'all_datasource_access',
                    'can_add',
                    'can_download',
                    'can_delete',
                    'can_edit',
                    'can_save',
                    'datasource_access',
                    'muldelete',
                )):
            sm.add_permission_role(gamma, perm)
    session = db.session()
    table_perms = [
        table.perm for table in session.query(models.SqlaTable).all()]
    table_perms += [
        table.perm for table in session.query(models.DruidDatasource).all()]
    for table_perm in table_perms:
        merge_perm(sm, 'datasource_access', table_perm)


def datetime_f(dttm):
    """Formats datetime to take less room when it is recent"""
    if dttm:
        dttm = dttm.isoformat()
        now_iso = datetime.now().isoformat()
        if now_iso[:10] == dttm[:10]:
            dttm = dttm[11:]
        elif now_iso[:4] == dttm[:4]:
            dttm = dttm[5:]
    return "<nobr>{}</nobr>".format(dttm)


def json_iso_dttm_ser(obj):
    """
    json serializer that deals with dates

    >>> dttm = datetime(1970, 1, 1)
    >>> json.dumps({'dttm': dttm}, default=json_iso_dttm_ser)
    '{"dttm": "1970-01-01T00:00:00"}'
    """
    if isinstance(obj, datetime):
        obj = obj.isoformat()
    return obj


def markdown(s):
    s = s or ''
    return md(s, [
        'markdown.extensions.tables',
        'markdown.extensions.fenced_code',
        'markdown.extensions.codehilite',
    ])


def readfile(filepath):
    with open(filepath) as f:
        content = f.read()
    return content
