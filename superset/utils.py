# -*- coding: utf-8 -*-
"""Utility functions used across Superset"""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from builtins import object
from datetime import date, datetime, time, timedelta
import decimal
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate
import functools
import json
import logging
import os
import signal
import smtplib
import sys
import uuid
import zlib

import bleach
import celery
from dateutil.parser import parse
from flask import flash, Markup, redirect, render_template, request, url_for
from flask_appbuilder._compat import as_unicode
from flask_appbuilder.const import (
    FLAMSG_ERR_SEC_ACCESS_DENIED,
    LOGMSG_ERR_SEC_ACCESS_DENIED,
    PERMISSION_PREFIX,
)
from flask_babel import gettext as __
from flask_cache import Cache
import markdown as md
import numpy
import pandas as pd
import parsedatetime
from past.builtins import basestring
from pydruid.utils.having import Having
import pytz
import sqlalchemy as sa
from sqlalchemy import event, exc, select
from sqlalchemy.types import TEXT, TypeDecorator

from superset.exceptions import SupersetException, SupersetTimeoutException


logging.getLogger('MARKDOWN').setLevel(logging.INFO)

PY3K = sys.version_info >= (3, 0)
EPOCH = datetime(1970, 1, 1)
DTTM_ALIAS = '__timestamp'


def can_access(sm, permission_name, view_name, user):
    """Protecting from has_access failing from missing perms/view"""
    if user.is_anonymous():
        return sm.is_item_public(permission_name, view_name)
    return sm._has_view_access(user, permission_name, view_name)


def flasher(msg, severity=None):
    """Flask's flash if available, logging call if not"""
    try:
        flash(msg, severity)
    except RuntimeError:
        if severity == 'danger':
            logging.error(msg)
        else:
            logging.info(msg)


class _memoized(object):  # noqa
    """Decorator that caches a function's return value each time it is called

    If called later with the same arguments, the cached value is returned, and
    not re-evaluated.

    Define ``watch`` as a tuple of attribute names if this Decorator
    should account for instance variable changes.
    """

    def __init__(self, func, watch=()):
        self.func = func
        self.cache = {}
        self.is_method = False
        self.watch = watch

    def __call__(self, *args, **kwargs):
        key = [args, frozenset(kwargs.items())]
        if self.is_method:
            key.append(tuple([getattr(args[0], v, None) for v in self.watch]))
        key = tuple(key)
        if key in self.cache:
            return self.cache[key]
        try:
            value = self.func(*args, **kwargs)
            self.cache[key] = value
            return value
        except TypeError:
            # uncachable -- for instance, passing a list as an argument.
            # Better to not cache than to blow up entirely.
            return self.func(*args, **kwargs)

    def __repr__(self):
        """Return the function's docstring."""
        return self.func.__doc__

    def __get__(self, obj, objtype):
        if not self.is_method:
            self.is_method = True
        """Support instance methods."""
        return functools.partial(self.__call__, obj)


def memoized(func=None, watch=None):
    if func:
        return _memoized(func)
    else:
        def wrapper(f):
            return _memoized(f, watch)
        return wrapper


def js_string_to_python(item):
    return None if item in ('null', 'undefined') else item


def string_to_num(s):
    """Converts a string to an int/float

    Returns ``None`` if it can't be converted

    >>> string_to_num('5')
    5
    >>> string_to_num('5.2')
    5.2
    >>> string_to_num(10)
    10
    >>> string_to_num(10.1)
    10.1
    >>> string_to_num('this is not a string') is None
    True
    """
    if isinstance(s, (int, float)):
        return s
    if s.isdigit():
        return int(s)
    try:
        return float(s)
    except ValueError:
        return None


class DimSelector(Having):
    def __init__(self, **args):
        # Just a hack to prevent any exceptions
        Having.__init__(self, type='equalTo', aggregation=None, value=None)

        self.having = {
            'having': {
                'type': 'dimSelector',
                'dimension': args['dimension'],
                'value': args['value'],
            },
        }


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
    >>> parse_human_datetime('now') <= datetime.now()
    True
    >>> parse_human_datetime('yesterday') <= datetime.now()
    True
    >>> date.today() - timedelta(1) == parse_human_datetime('yesterday').date()
    True
    >>> year_ago_1 = parse_human_datetime('one year ago').date()
    >>> year_ago_2 = (datetime.now() - relativedelta(years=1) ).date()
    >>> year_ago_1 == year_ago_2
    True
    """
    if not s:
        return None
    try:
        dttm = parse(s)
    except Exception:
        try:
            cal = parsedatetime.Calendar()
            parsed_dttm, parsed_flags = cal.parseDT(s)
            # when time is not extracted, we 'reset to midnight'
            if parsed_flags & 2 == 0:
                parsed_dttm = parsed_dttm.replace(hour=0, minute=0, second=0)
            dttm = dttm_from_timtuple(parsed_dttm.utctimetuple())
        except Exception as e:
            logging.exception(e)
            raise ValueError("Couldn't parse date string [{}]".format(s))
    return dttm


def dttm_from_timtuple(d):
    return datetime(
        d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)


def decode_dashboards(o):
    """
    Function to be passed into json.loads obj_hook parameter
    Recreates the dashboard object from a json representation.
    """
    import superset.models.core as models
    from superset.connectors.sqla.models import (
        SqlaTable, SqlMetric, TableColumn,
    )

    if '__Dashboard__' in o:
        d = models.Dashboard()
        d.__dict__.update(o['__Dashboard__'])
        return d
    elif '__Slice__' in o:
        d = models.Slice()
        d.__dict__.update(o['__Slice__'])
        return d
    elif '__TableColumn__' in o:
        d = TableColumn()
        d.__dict__.update(o['__TableColumn__'])
        return d
    elif '__SqlaTable__' in o:
        d = SqlaTable()
        d.__dict__.update(o['__SqlaTable__'])
        return d
    elif '__SqlMetric__' in o:
        d = SqlMetric()
        d.__dict__.update(o['__SqlMetric__'])
        return d
    elif '__datetime__' in o:
        return datetime.strptime(o['__datetime__'], '%Y-%m-%dT%H:%M:%S')
    else:
        return o


class DashboardEncoder(json.JSONEncoder):
    # pylint: disable=E0202
    def default(self, o):
        try:
            vals = {
                k: v for k, v in o.__dict__.items() if k != '_sa_instance_state'}
            return {'__{}__'.format(o.__class__.__name__): vals}
        except Exception:
            if type(o) == datetime:
                return {'__datetime__': o.replace(microsecond=0).isoformat()}
            return json.JSONEncoder.default(self, o)


def parse_human_timedelta(s):
    """
    Returns ``datetime.datetime`` from natural language time deltas

    >>> parse_human_datetime('now') <= datetime.now()
    True
    """
    cal = parsedatetime.Calendar()
    dttm = dttm_from_timtuple(datetime.now().timetuple())
    d = cal.parse(s, dttm)[0]
    d = datetime(d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)
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


def datetime_f(dttm):
    """Formats datetime to take less room when it is recent"""
    if dttm:
        dttm = dttm.isoformat()
        now_iso = datetime.now().isoformat()
        if now_iso[:10] == dttm[:10]:
            dttm = dttm[11:]
        elif now_iso[:4] == dttm[:4]:
            dttm = dttm[5:]
    return '<nobr>{}</nobr>'.format(dttm)


def base_json_conv(obj):

    if isinstance(obj, numpy.int64):
        return int(obj)
    elif isinstance(obj, numpy.bool_):
        return bool(obj)
    elif isinstance(obj, set):
        return list(obj)
    elif isinstance(obj, decimal.Decimal):
        return float(obj)
    elif isinstance(obj, uuid.UUID):
        return str(obj)
    elif isinstance(obj, timedelta):
        return str(obj)


def json_iso_dttm_ser(obj, pessimistic=False):
    """
    json serializer that deals with dates

    >>> dttm = datetime(1970, 1, 1)
    >>> json.dumps({'dttm': dttm}, default=json_iso_dttm_ser)
    '{"dttm": "1970-01-01T00:00:00"}'
    """
    val = base_json_conv(obj)
    if val is not None:
        return val
    if isinstance(obj, (datetime, date, time, pd.Timestamp)):
        obj = obj.isoformat()
    else:
        if pessimistic:
            return 'Unserializable [{}]'.format(type(obj))
        else:
            raise TypeError(
                'Unserializable object {} of type {}'.format(obj, type(obj)))
    return obj


def pessimistic_json_iso_dttm_ser(obj):
    """Proxy to call json_iso_dttm_ser in a pessimistic way

    If one of object is not serializable to json, it will still succeed"""
    return json_iso_dttm_ser(obj, pessimistic=True)


def datetime_to_epoch(dttm):
    if dttm.tzinfo:
        epoch_with_tz = pytz.utc.localize(EPOCH)
        return (dttm - epoch_with_tz).total_seconds() * 1000
    return (dttm - EPOCH).total_seconds() * 1000


def now_as_float():
    return datetime_to_epoch(datetime.utcnow())


def json_int_dttm_ser(obj):
    """json serializer that deals with dates"""
    val = base_json_conv(obj)
    if val is not None:
        return val
    if isinstance(obj, (datetime, pd.Timestamp)):
        obj = datetime_to_epoch(obj)
    elif isinstance(obj, date):
        obj = (obj - EPOCH.date()).total_seconds() * 1000
    else:
        raise TypeError(
            'Unserializable object {} of type {}'.format(obj, type(obj)))
    return obj


def json_dumps_w_dates(payload):
    return json.dumps(payload, default=json_int_dttm_ser)


def error_msg_from_exception(e):
    """Translate exception into error message

    Database have different ways to handle exception. This function attempts
    to make sense of the exception object and construct a human readable
    sentence.

    TODO(bkyryliuk): parse the Presto error message from the connection
                     created via create_engine.
    engine = create_engine('presto://localhost:3506/silver') -
      gives an e.message as the str(dict)
    presto.connect('localhost', port=3506, catalog='silver') - as a dict.
    The latter version is parsed correctly by this function.
    """
    msg = ''
    if hasattr(e, 'message'):
        if isinstance(e.message, dict):
            msg = e.message.get('message')
        elif e.message:
            msg = '{}'.format(e.message)
    return msg or '{}'.format(e)


def markdown(s, markup_wrap=False):
    safe_markdown_tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i',
                          'strong', 'em', 'tt', 'p', 'br', 'span',
                          'div', 'blockquote', 'code', 'hr', 'ul', 'ol',
                          'li', 'dd', 'dt', 'img', 'a']
    safe_markdown_attrs = {'img': ['src', 'alt', 'title'],
                           'a': ['href', 'alt', 'title']}
    s = md.markdown(s or '', [
        'markdown.extensions.tables',
        'markdown.extensions.fenced_code',
        'markdown.extensions.codehilite',
    ])
    s = bleach.clean(s, safe_markdown_tags, safe_markdown_attrs)
    if markup_wrap:
        s = Markup(s)
    return s


def readfile(file_path):
    with open(file_path) as f:
        content = f.read()
    return content


def generic_find_constraint_name(table, columns, referenced, db):
    """Utility to find a constraint name in alembic migrations"""
    t = sa.Table(table, db.metadata, autoload=True, autoload_with=db.engine)

    for fk in t.foreign_key_constraints:
        if fk.referred_table.name == referenced and set(fk.column_keys) == columns:
            return fk.name


def generic_find_fk_constraint_name(table, columns, referenced, insp):
    """Utility to find a foreign-key constraint name in alembic migrations"""
    for fk in insp.get_foreign_keys(table):
        if fk['referred_table'] == referenced and set(fk['referred_columns']) == columns:
            return fk['name']


def generic_find_fk_constraint_names(table, columns, referenced, insp):
    """Utility to find foreign-key constraint names in alembic migrations"""
    names = set()

    for fk in insp.get_foreign_keys(table):
        if fk['referred_table'] == referenced and set(fk['referred_columns']) == columns:
            names.add(fk['name'])

    return names


def generic_find_uq_constraint_name(table, columns, insp):
    """Utility to find a unique constraint name in alembic migrations"""

    for uq in insp.get_unique_constraints(table):
        if columns == set(uq['column_names']):
            return uq['name']


def get_datasource_full_name(database_name, datasource_name, schema=None):
    if not schema:
        return '[{}].[{}]'.format(database_name, datasource_name)
    return '[{}].[{}].[{}]'.format(database_name, schema, datasource_name)


def get_schema_perm(database, schema):
    if schema:
        return '[{}].[{}]'.format(database, schema)


def validate_json(obj):
    if obj:
        try:
            json.loads(obj)
        except Exception:
            raise SupersetException('JSON is not valid')


def table_has_constraint(table, name, db):
    """Utility to find a constraint name in alembic migrations"""
    t = sa.Table(table, db.metadata, autoload=True, autoload_with=db.engine)

    for c in t.constraints:
        if c.name == name:
            return True
    return False


class timeout(object):
    """
    To be used in a ``with`` block and timeout its content.
    """

    def __init__(self, seconds=1, error_message='Timeout'):
        self.seconds = seconds
        self.error_message = error_message

    def handle_timeout(self, signum, frame):
        logging.error('Process timed out')
        raise SupersetTimeoutException(self.error_message)

    def __enter__(self):
        try:
            signal.signal(signal.SIGALRM, self.handle_timeout)
            signal.alarm(self.seconds)
        except ValueError as e:
            logging.warning("timeout can't be used in the current context")
            logging.exception(e)

    def __exit__(self, type, value, traceback):
        try:
            signal.alarm(0)
        except ValueError as e:
            logging.warning("timeout can't be used in the current context")
            logging.exception(e)


def pessimistic_connection_handling(some_engine):
    @event.listens_for(some_engine, 'engine_connect')
    def ping_connection(connection, branch):
        if branch:
            # 'branch' refers to a sub-connection of a connection,
            # we don't want to bother pinging on these.
            return

        # turn off 'close with result'.  This flag is only used with
        # 'connectionless' execution, otherwise will be False in any case
        save_should_close_with_result = connection.should_close_with_result
        connection.should_close_with_result = False

        try:
            # run a SELECT 1.   use a core select() so that
            # the SELECT of a scalar value without a table is
            # appropriately formatted for the backend
            connection.scalar(select([1]))
        except exc.DBAPIError as err:
            # catch SQLAlchemy's DBAPIError, which is a wrapper
            # for the DBAPI's exception.  It includes a .connection_invalidated
            # attribute which specifies if this connection is a 'disconnect'
            # condition, which is based on inspection of the original exception
            # by the dialect in use.
            if err.connection_invalidated:
                # run the same SELECT again - the connection will re-validate
                # itself and establish a new connection.  The disconnect detection
                # here also causes the whole connection pool to be invalidated
                # so that all stale connections are discarded.
                connection.scalar(select([1]))
            else:
                raise
        finally:
            # restore 'close with result'
            connection.should_close_with_result = save_should_close_with_result


class QueryStatus(object):
    """Enum-type class for query statuses"""

    STOPPED = 'stopped'
    FAILED = 'failed'
    PENDING = 'pending'
    RUNNING = 'running'
    SCHEDULED = 'scheduled'
    SUCCESS = 'success'
    TIMED_OUT = 'timed_out'


def notify_user_about_perm_udate(
        granter, user, role, datasource, tpl_name, config):
    msg = render_template(tpl_name, granter=granter, user=user, role=role,
                          datasource=datasource)
    logging.info(msg)
    subject = __('[Superset] Access to the datasource %(name)s was granted',
                 name=datasource.full_name)
    send_email_smtp(user.email, subject, msg, config, bcc=granter.email,
                    dryrun=not config.get('EMAIL_NOTIFICATIONS'))


def send_email_smtp(to, subject, html_content, config, files=None,
                    dryrun=False, cc=None, bcc=None, mime_subtype='mixed'):
    """
    Send an email with html content, eg:
    send_email_smtp(
        'test@example.com', 'foo', '<b>Foo</b> bar',['/dev/null'], dryrun=True)
    """
    smtp_mail_from = config.get('SMTP_MAIL_FROM')

    to = get_email_address_list(to)

    msg = MIMEMultipart(mime_subtype)
    msg['Subject'] = subject
    msg['From'] = smtp_mail_from
    msg['To'] = ', '.join(to)
    recipients = to
    if cc:
        cc = get_email_address_list(cc)
        msg['CC'] = ', '.join(cc)
        recipients = recipients + cc

    if bcc:
        # don't add bcc in header
        bcc = get_email_address_list(bcc)
        recipients = recipients + bcc

    msg['Date'] = formatdate(localtime=True)
    mime_text = MIMEText(html_content, 'html')
    msg.attach(mime_text)

    for fname in files or []:
        basename = os.path.basename(fname)
        with open(fname, 'rb') as f:
            msg.attach(
                MIMEApplication(
                    f.read(),
                    Content_Disposition="attachment; filename='%s'" % basename,
                    Name=basename))

    send_MIME_email(smtp_mail_from, recipients, msg, config, dryrun=dryrun)


def send_MIME_email(e_from, e_to, mime_msg, config, dryrun=False):
    SMTP_HOST = config.get('SMTP_HOST')
    SMTP_PORT = config.get('SMTP_PORT')
    SMTP_USER = config.get('SMTP_USER')
    SMTP_PASSWORD = config.get('SMTP_PASSWORD')
    SMTP_STARTTLS = config.get('SMTP_STARTTLS')
    SMTP_SSL = config.get('SMTP_SSL')

    if not dryrun:
        s = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) if SMTP_SSL else \
            smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        if SMTP_STARTTLS:
            s.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            s.login(SMTP_USER, SMTP_PASSWORD)
        logging.info('Sent an alert email to ' + str(e_to))
        s.sendmail(e_from, e_to, mime_msg.as_string())
        s.quit()
    else:
        logging.info('Dryrun enabled, email notification content is below:')
        logging.info(mime_msg.as_string())


def get_email_address_list(address_string):
    if isinstance(address_string, basestring):
        if ',' in address_string:
            address_string = address_string.split(',')
        elif ';' in address_string:
            address_string = address_string.split(';')
        else:
            address_string = [address_string]
    return address_string


def has_access(f):
    """
        Use this decorator to enable granular security permissions to your
        methods. Permissions will be associated to a role, and roles are
        associated to users.

        By default the permission's name is the methods name.

        Forked from the flask_appbuilder.security.decorators
        TODO(bkyryliuk): contribute it back to FAB
    """
    if hasattr(f, '_permission_name'):
        permission_str = f._permission_name
    else:
        permission_str = f.__name__

    def wraps(self, *args, **kwargs):
        permission_str = PERMISSION_PREFIX + f._permission_name
        if self.appbuilder.sm.has_access(permission_str,
                                         self.__class__.__name__):
            return f(self, *args, **kwargs)
        else:
            logging.warning(
                LOGMSG_ERR_SEC_ACCESS_DENIED.format(permission_str,
                                                    self.__class__.__name__))
            flash(as_unicode(FLAMSG_ERR_SEC_ACCESS_DENIED), 'danger')
        # adds next arg to forward to the original path once user is logged in.
        return redirect(
            url_for(
                self.appbuilder.sm.auth_view.__class__.__name__ + '.login',
                next=request.full_path))

    f._permission_name = permission_str
    return functools.update_wrapper(wraps, f)


def choicify(values):
    """Takes an iterable and makes an iterable of tuples with it"""
    return [(v, v) for v in values]


def setup_cache(app, cache_config):
    """Setup the flask-cache on a flask app"""
    if cache_config and cache_config.get('CACHE_TYPE') != 'null':
        return Cache(app, config=cache_config)


def zlib_compress(data):
    """
    Compress things in a py2/3 safe fashion
    >>> json_str = '{"test": 1}'
    >>> blob = zlib_compress(json_str)
    """
    if PY3K:
        if isinstance(data, str):
            return zlib.compress(bytes(data, 'utf-8'))
        return zlib.compress(data)
    return zlib.compress(data)


def zlib_decompress_to_string(blob):
    """
    Decompress things to a string in a py2/3 safe fashion
    >>> json_str = '{"test": 1}'
    >>> blob = zlib_compress(json_str)
    >>> got_str = zlib_decompress_to_string(blob)
    >>> got_str == json_str
    True
    """
    if PY3K:
        if isinstance(blob, bytes):
            decompressed = zlib.decompress(blob)
        else:
            decompressed = zlib.decompress(bytes(blob, 'utf-8'))
        return decompressed.decode('utf-8')
    return zlib.decompress(blob)


_celery_app = None


def get_celery_app(config):
    global _celery_app
    if _celery_app:
        return _celery_app
    _celery_app = celery.Celery(config_source=config.get('CELERY_CONFIG'))
    return _celery_app


def merge_extra_filters(form_data):
    # extra_filters are temporary/contextual filters that are external
    # to the slice definition. We use those for dynamic interactive
    # filters like the ones emitted by the "Filter Box" visualization
    if 'extra_filters' in form_data:
        # __form and __to are special extra_filters that target time
        # boundaries. The rest of extra_filters are simple
        # [column_name in list_of_values]. `__` prefix is there to avoid
        # potential conflicts with column that would be named `from` or `to`
        if 'filters' not in form_data:
            form_data['filters'] = []
        date_options = {
            '__from': 'since',
            '__to': 'until',
            '__time_col': 'granularity_sqla',
            '__time_grain': 'time_grain_sqla',
            '__time_origin': 'druid_time_origin',
            '__granularity': 'granularity',
        }
        # Grab list of existing filters 'keyed' on the column and operator

        def get_filter_key(f):
            return f['col'] + '__' + f['op']
        existing_filters = {}
        for existing in form_data['filters']:
            if existing['col'] is not None:
                existing_filters[get_filter_key(existing)] = existing['val']
        for filtr in form_data['extra_filters']:
            # Pull out time filters/options and merge into form data
            if date_options.get(filtr['col']):
                if filtr.get('val'):
                    form_data[date_options[filtr['col']]] = filtr['val']
            elif filtr['val'] and len(filtr['val']):
                # Merge column filters
                filter_key = get_filter_key(filtr)
                if filter_key in existing_filters:
                    # Check if the filter already exists
                    if isinstance(filtr['val'], list):
                        if isinstance(existing_filters[filter_key], list):
                            # Add filters for unequal lists
                            # order doesn't matter
                            if (
                                sorted(existing_filters[filter_key]) !=
                                sorted(filtr['val'])
                            ):
                                form_data['filters'] += [filtr]
                        else:
                            form_data['filters'] += [filtr]
                    else:
                        # Do not add filter if same value already exists
                        if filtr['val'] != existing_filters[filter_key]:
                            form_data['filters'] += [filtr]
                else:
                    # Filter not found, add it
                    form_data['filters'] += [filtr]
        # Remove extra filters from the form data since no longer needed
        del form_data['extra_filters']


def merge_request_params(form_data, params):
    url_params = {}
    for key, value in params.items():
        if key in ('form_data', 'r'):
            continue
        url_params[key] = value
    form_data['url_params'] = url_params


def get_update_perms_flag():
    val = os.environ.get('SUPERSET_UPDATE_PERMS')
    return val.lower() not in ('0', 'false', 'no') if val else True


def user_label(user):
    """Given a user ORM FAB object, returns a label"""
    if user:
        if user.first_name and user.last_name:
            return user.first_name + ' ' + user.last_name
        else:
            return user.username
