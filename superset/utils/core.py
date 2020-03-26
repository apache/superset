# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=C,R,W
"""Utility functions used across Superset"""
import decimal
import errno
import functools
import hashlib
import json
import logging
import os
import signal
import smtplib
import tempfile
import traceback
import uuid
import zlib
from datetime import date, datetime, time, timedelta
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate
from enum import Enum
from time import struct_time
from typing import Any, Dict, Iterator, List, NamedTuple, Optional, Set, Tuple, Union
from urllib.parse import unquote_plus

import bleach
import markdown as md
import numpy as np
import pandas as pd
import parsedatetime
import sqlalchemy as sa
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.backends.openssl.x509 import _Certificate
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta
from flask import current_app, flash, Flask, g, Markup, render_template
from flask_appbuilder import SQLA
from flask_appbuilder.security.sqla.models import User
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy import event, exc, select, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.sql.type_api import Variant
from sqlalchemy.types import TEXT, TypeDecorator

from superset.exceptions import (
    CertificateException,
    SupersetException,
    SupersetTimeoutException,
)
from superset.utils.dates import datetime_to_epoch, EPOCH

try:
    from pydruid.utils.having import Having
except ImportError:
    pass


logging.getLogger("MARKDOWN").setLevel(logging.INFO)
logger = logging.getLogger(__name__)

DTTM_ALIAS = "__timestamp"
ADHOC_METRIC_EXPRESSION_TYPES = {"SIMPLE": "SIMPLE", "SQL": "SQL"}

JS_MAX_INTEGER = 9007199254740991  # Largest int Java Script can handle 2^53-1

try:
    # Having might not have been imported.
    class DimSelector(Having):
        def __init__(self, **args):
            # Just a hack to prevent any exceptions
            Having.__init__(self, type="equalTo", aggregation=None, value=None)

            self.having = {
                "having": {
                    "type": "dimSelector",
                    "dimension": args["dimension"],
                    "value": args["value"],
                }
            }


except NameError:
    pass


def flasher(msg, severity=None):
    """Flask's flash if available, logging call if not"""
    try:
        flash(msg, severity)
    except RuntimeError:
        if severity == "danger":
            logger.error(msg)
        else:
            logger.info(msg)


class _memoized:
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


def parse_js_uri_path_item(
    item: Optional[str], unquote: bool = True, eval_undefined: bool = False
) -> Optional[str]:
    """Parse a uri path item made with js.

    :param item: a uri path component
    :param unquote: Perform unquoting of string using urllib.parse.unquote_plus()
    :param eval_undefined: When set to True and item is either 'null'  or 'undefined',
    assume item is undefined and return None.
    :return: Either None, the original item or unquoted item
    """
    item = None if eval_undefined and item in ("null", "undefined") else item
    return unquote_plus(item) if unquote and item else item


def string_to_num(s: str):
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


def list_minus(l: List, minus: List) -> List:
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
            dttm = dttm_from_timetuple(parsed_dttm.utctimetuple())
        except Exception as e:
            logger.exception(e)
            raise ValueError("Couldn't parse date string [{}]".format(s))
    return dttm


def dttm_from_timetuple(d: struct_time) -> datetime:
    return datetime(d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)


class DashboardEncoder(json.JSONEncoder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sort_keys = True

    # pylint: disable=E0202
    def default(self, o):
        try:
            vals = {k: v for k, v in o.__dict__.items() if k != "_sa_instance_state"}
            return {"__{}__".format(o.__class__.__name__): vals}
        except Exception:
            if type(o) == datetime:
                return {"__datetime__": o.replace(microsecond=0).isoformat()}
            return json.JSONEncoder(sort_keys=True).default(self, o)


def parse_human_timedelta(s: Optional[str]) -> timedelta:
    """
    Returns ``datetime.datetime`` from natural language time deltas

    >>> parse_human_datetime('now') <= datetime.now()
    True
    """
    cal = parsedatetime.Calendar()
    dttm = dttm_from_timetuple(datetime.now().timetuple())
    d = cal.parse(s or "", dttm)[0]
    d = datetime(d.tm_year, d.tm_mon, d.tm_mday, d.tm_hour, d.tm_min, d.tm_sec)
    return d - dttm


def parse_past_timedelta(delta_str: str) -> timedelta:
    """
    Takes a delta like '1 year' and finds the timedelta for that period in
    the past, then represents that past timedelta in positive terms.

    parse_human_timedelta('1 year') find the timedelta 1 year in the future.
    parse_past_timedelta('1 year') returns -datetime.timedelta(-365)
    or datetime.timedelta(365).
    """
    return -parse_human_timedelta(
        delta_str if delta_str.startswith("-") else f"-{delta_str}"
    )


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
    return "<nobr>{}</nobr>".format(dttm)


def format_timedelta(td: timedelta) -> str:
    """
    Ensures negative time deltas are easily interpreted by humans

    >>> td = timedelta(0) - timedelta(days=1, hours=5,minutes=6)
    >>> str(td)
    '-2 days, 18:54:00'
    >>> format_timedelta(td)
    '-1 day, 5:06:00'
    """
    if td < timedelta(0):
        return "-" + str(abs(td))
    else:
        # Change this to format positive time deltas the way you want
        return str(td)


def base_json_conv(obj):
    if isinstance(obj, memoryview):
        obj = obj.tobytes()
    if isinstance(obj, np.int64):
        return int(obj)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, set):
        return list(obj)
    elif isinstance(obj, decimal.Decimal):
        return float(obj)
    elif isinstance(obj, uuid.UUID):
        return str(obj)
    elif isinstance(obj, timedelta):
        return format_timedelta(obj)
    elif isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except Exception:
            return "[bytes]"


def json_iso_dttm_ser(obj, pessimistic: Optional[bool] = False):
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
            return "Unserializable [{}]".format(type(obj))
        else:
            raise TypeError(
                "Unserializable object {} of type {}".format(obj, type(obj))
            )
    return obj


def pessimistic_json_iso_dttm_ser(obj):
    """Proxy to call json_iso_dttm_ser in a pessimistic way

    If one of object is not serializable to json, it will still succeed"""
    return json_iso_dttm_ser(obj, pessimistic=True)


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
        raise TypeError("Unserializable object {} of type {}".format(obj, type(obj)))
    return obj


def json_dumps_w_dates(payload):
    return json.dumps(payload, default=json_int_dttm_ser)


def error_msg_from_exception(e: Exception) -> str:
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
    msg = ""
    if hasattr(e, "message"):
        if isinstance(e.message, dict):  # type: ignore
            msg = e.message.get("message")  # type: ignore
        elif e.message:  # type: ignore
            msg = e.message  # type: ignore
    return msg or str(e)


def markdown(s: str, markup_wrap: Optional[bool] = False) -> str:
    safe_markdown_tags = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "b",
        "i",
        "strong",
        "em",
        "tt",
        "p",
        "br",
        "span",
        "div",
        "blockquote",
        "code",
        "hr",
        "ul",
        "ol",
        "li",
        "dd",
        "dt",
        "img",
        "a",
    ]
    safe_markdown_attrs = {
        "img": ["src", "alt", "title"],
        "a": ["href", "alt", "title"],
    }
    s = md.markdown(
        s or "",
        extensions=[
            "markdown.extensions.tables",
            "markdown.extensions.fenced_code",
            "markdown.extensions.codehilite",
        ],
    )
    s = bleach.clean(s, safe_markdown_tags, safe_markdown_attrs)
    if markup_wrap:
        s = Markup(s)
    return s


def readfile(file_path: str) -> Optional[str]:
    with open(file_path) as f:
        content = f.read()
    return content


def generic_find_constraint_name(
    table: str, columns: Set[str], referenced: str, db: SQLA
):
    """Utility to find a constraint name in alembic migrations"""
    t = sa.Table(table, db.metadata, autoload=True, autoload_with=db.engine)

    for fk in t.foreign_key_constraints:
        if fk.referred_table.name == referenced and set(fk.column_keys) == columns:
            return fk.name


def generic_find_fk_constraint_name(
    table: str, columns: Set[str], referenced: str, insp
):
    """Utility to find a foreign-key constraint name in alembic migrations"""
    for fk in insp.get_foreign_keys(table):
        if (
            fk["referred_table"] == referenced
            and set(fk["referred_columns"]) == columns
        ):
            return fk["name"]


def generic_find_fk_constraint_names(table, columns, referenced, insp):
    """Utility to find foreign-key constraint names in alembic migrations"""
    names = set()

    for fk in insp.get_foreign_keys(table):
        if (
            fk["referred_table"] == referenced
            and set(fk["referred_columns"]) == columns
        ):
            names.add(fk["name"])

    return names


def generic_find_uq_constraint_name(table, columns, insp):
    """Utility to find a unique constraint name in alembic migrations"""

    for uq in insp.get_unique_constraints(table):
        if columns == set(uq["column_names"]):
            return uq["name"]


def get_datasource_full_name(database_name, datasource_name, schema=None):
    if not schema:
        return "[{}].[{}]".format(database_name, datasource_name)
    return "[{}].[{}].[{}]".format(database_name, schema, datasource_name)


def validate_json(obj):
    if obj:
        try:
            json.loads(obj)
        except Exception as e:
            logger.error(f"JSON is not valid {e}")
            raise SupersetException("JSON is not valid")


def table_has_constraint(table, name, db):
    """Utility to find a constraint name in alembic migrations"""
    t = sa.Table(table, db.metadata, autoload=True, autoload_with=db.engine)

    for c in t.constraints:
        if c.name == name:
            return True
    return False


class timeout:
    """
    To be used in a ``with`` block and timeout its content.
    """

    def __init__(self, seconds=1, error_message="Timeout"):
        self.seconds = seconds
        self.error_message = error_message

    def handle_timeout(self, signum, frame):
        logger.error("Process timed out")
        raise SupersetTimeoutException(self.error_message)

    def __enter__(self):
        try:
            signal.signal(signal.SIGALRM, self.handle_timeout)
            signal.alarm(self.seconds)
        except ValueError as e:
            logger.warning("timeout can't be used in the current context")
            logger.exception(e)

    def __exit__(self, type, value, traceback):
        try:
            signal.alarm(0)
        except ValueError as e:
            logger.warning("timeout can't be used in the current context")
            logger.exception(e)


def pessimistic_connection_handling(some_engine):
    @event.listens_for(some_engine, "engine_connect")
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


class QueryStatus:
    """Enum-type class for query statuses"""

    STOPPED: str = "stopped"
    FAILED: str = "failed"
    PENDING: str = "pending"
    RUNNING: str = "running"
    SCHEDULED: str = "scheduled"
    SUCCESS: str = "success"
    TIMED_OUT: str = "timed_out"


def notify_user_about_perm_udate(granter, user, role, datasource, tpl_name, config):
    msg = render_template(
        tpl_name, granter=granter, user=user, role=role, datasource=datasource
    )
    logger.info(msg)
    subject = __(
        "[Superset] Access to the datasource %(name)s was granted",
        name=datasource.full_name,
    )
    send_email_smtp(
        user.email,
        subject,
        msg,
        config,
        bcc=granter.email,
        dryrun=not config["EMAIL_NOTIFICATIONS"],
    )


def send_email_smtp(
    to,
    subject,
    html_content,
    config,
    files=None,
    data=None,
    images=None,
    dryrun=False,
    cc=None,
    bcc=None,
    mime_subtype="mixed",
):
    """
    Send an email with html content, eg:
    send_email_smtp(
        'test@example.com', 'foo', '<b>Foo</b> bar',['/dev/null'], dryrun=True)
    """
    smtp_mail_from = config["SMTP_MAIL_FROM"]
    to = get_email_address_list(to)

    msg = MIMEMultipart(mime_subtype)
    msg["Subject"] = subject
    msg["From"] = smtp_mail_from
    msg["To"] = ", ".join(to)
    msg.preamble = "This is a multi-part message in MIME format."

    recipients = to
    if cc:
        cc = get_email_address_list(cc)
        msg["CC"] = ", ".join(cc)
        recipients = recipients + cc

    if bcc:
        # don't add bcc in header
        bcc = get_email_address_list(bcc)
        recipients = recipients + bcc

    msg["Date"] = formatdate(localtime=True)
    mime_text = MIMEText(html_content, "html")
    msg.attach(mime_text)

    # Attach files by reading them from disk
    for fname in files or []:
        basename = os.path.basename(fname)
        with open(fname, "rb") as f:
            msg.attach(
                MIMEApplication(
                    f.read(),
                    Content_Disposition="attachment; filename='%s'" % basename,
                    Name=basename,
                )
            )

    # Attach any files passed directly
    for name, body in (data or {}).items():
        msg.attach(
            MIMEApplication(
                body, Content_Disposition="attachment; filename='%s'" % name, Name=name
            )
        )

    # Attach any inline images, which may be required for display in
    # HTML content (inline)
    for msgid, body in (images or {}).items():
        image = MIMEImage(body)
        image.add_header("Content-ID", "<%s>" % msgid)
        image.add_header("Content-Disposition", "inline")
        msg.attach(image)

    send_MIME_email(smtp_mail_from, recipients, msg, config, dryrun=dryrun)


def send_MIME_email(e_from, e_to, mime_msg, config, dryrun=False):
    SMTP_HOST = config["SMTP_HOST"]
    SMTP_PORT = config["SMTP_PORT"]
    SMTP_USER = config["SMTP_USER"]
    SMTP_PASSWORD = config["SMTP_PASSWORD"]
    SMTP_STARTTLS = config["SMTP_STARTTLS"]
    SMTP_SSL = config["SMTP_SSL"]

    if not dryrun:
        s = (
            smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
            if SMTP_SSL
            else smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        )
        if SMTP_STARTTLS:
            s.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            s.login(SMTP_USER, SMTP_PASSWORD)
        logger.info("Sent an email to " + str(e_to))
        s.sendmail(e_from, e_to, mime_msg.as_string())
        s.quit()
    else:
        logger.info("Dryrun enabled, email notification content is below:")
        logger.info(mime_msg.as_string())


def get_email_address_list(address_string: str) -> List[str]:
    address_string_list: List[str] = []
    if isinstance(address_string, str):
        if "," in address_string:
            address_string_list = address_string.split(",")
        elif "\n" in address_string:
            address_string_list = address_string.split("\n")
        elif ";" in address_string:
            address_string_list = address_string.split(";")
        else:
            address_string_list = [address_string]
    return [x.strip() for x in address_string_list if x.strip()]


def choicify(values):
    """Takes an iterable and makes an iterable of tuples with it"""
    return [(v, v) for v in values]


def zlib_compress(data):
    """
    Compress things in a py2/3 safe fashion
    >>> json_str = '{"test": 1}'
    >>> blob = zlib_compress(json_str)
    """
    if isinstance(data, str):
        return zlib.compress(bytes(data, "utf-8"))
    return zlib.compress(data)


def zlib_decompress(blob: bytes, decode: Optional[bool] = True) -> Union[bytes, str]:
    """
    Decompress things to a string in a py2/3 safe fashion
    >>> json_str = '{"test": 1}'
    >>> blob = zlib_compress(json_str)
    >>> got_str = zlib_decompress(blob)
    >>> got_str == json_str
    True
    """
    if isinstance(blob, bytes):
        decompressed = zlib.decompress(blob)
    else:
        decompressed = zlib.decompress(bytes(blob, "utf-8"))
    return decompressed.decode("utf-8") if decode else decompressed


def to_adhoc(filt, expressionType="SIMPLE", clause="where"):
    result = {
        "clause": clause.upper(),
        "expressionType": expressionType,
        "filterOptionName": str(uuid.uuid4()),
        "isExtra": True if filt.get("isExtra") is True else False,
    }

    if expressionType == "SIMPLE":
        result.update(
            {
                "comparator": filt.get("val"),
                "operator": filt.get("op"),
                "subject": filt.get("col"),
            }
        )
    elif expressionType == "SQL":
        result.update({"sqlExpression": filt.get(clause)})

    return result


def merge_extra_filters(form_data: dict):
    # extra_filters are temporary/contextual filters (using the legacy constructs)
    # that are external to the slice definition. We use those for dynamic
    # interactive filters like the ones emitted by the "Filter Box" visualization.
    # Note extra_filters only support simple filters.
    if "extra_filters" in form_data:
        # __form and __to are special extra_filters that target time
        # boundaries. The rest of extra_filters are simple
        # [column_name in list_of_values]. `__` prefix is there to avoid
        # potential conflicts with column that would be named `from` or `to`
        if "adhoc_filters" not in form_data or not isinstance(
            form_data["adhoc_filters"], list
        ):
            form_data["adhoc_filters"] = []
        date_options = {
            "__time_range": "time_range",
            "__time_col": "granularity_sqla",
            "__time_grain": "time_grain_sqla",
            "__time_origin": "druid_time_origin",
            "__granularity": "granularity",
        }
        # Grab list of existing filters 'keyed' on the column and operator

        def get_filter_key(f):
            if "expressionType" in f:
                return "{}__{}".format(f["subject"], f["operator"])
            else:
                return "{}__{}".format(f["col"], f["op"])

        existing_filters = {}
        for existing in form_data["adhoc_filters"]:
            if (
                existing["expressionType"] == "SIMPLE"
                and existing["comparator"] is not None
                and existing["subject"] is not None
            ):
                existing_filters[get_filter_key(existing)] = existing["comparator"]

        for filtr in form_data["extra_filters"]:
            filtr["isExtra"] = True
            # Pull out time filters/options and merge into form data
            if date_options.get(filtr["col"]):
                if filtr.get("val"):
                    form_data[date_options[filtr["col"]]] = filtr["val"]
            elif filtr["val"]:
                # Merge column filters
                filter_key = get_filter_key(filtr)
                if filter_key in existing_filters:
                    # Check if the filter already exists
                    if isinstance(filtr["val"], list):
                        if isinstance(existing_filters[filter_key], list):
                            # Add filters for unequal lists
                            # order doesn't matter
                            if set(existing_filters[filter_key]) != set(filtr["val"]):
                                form_data["adhoc_filters"].append(to_adhoc(filtr))
                        else:
                            form_data["adhoc_filters"].append(to_adhoc(filtr))
                    else:
                        # Do not add filter if same value already exists
                        if filtr["val"] != existing_filters[filter_key]:
                            form_data["adhoc_filters"].append(to_adhoc(filtr))
                else:
                    # Filter not found, add it
                    form_data["adhoc_filters"].append(to_adhoc(filtr))
        # Remove extra filters from the form data since no longer needed
        del form_data["extra_filters"]


def merge_request_params(form_data: Dict[str, Any], params: Dict[str, Any]) -> None:
    """
    Merge request parameters to the key `url_params` in form_data. Only updates
    or appends parameters to `form_data` that are defined in `params; pre-existing
    parameters not defined in params are left unchanged.

    :param form_data: object to be updated
    :param params: request parameters received via query string
    """
    url_params = form_data.get("url_params", {})
    for key, value in params.items():
        if key in ("form_data", "r"):
            continue
        url_params[key] = value
    form_data["url_params"] = url_params


def user_label(user: User) -> Optional[str]:
    """Given a user ORM FAB object, returns a label"""
    if user:
        if user.first_name and user.last_name:
            return user.first_name + " " + user.last_name
        else:
            return user.username

    return None


def get_or_create_db(database_name, sqlalchemy_uri, *args, **kwargs):
    from superset import db
    from superset.models import core as models

    database = (
        db.session.query(models.Database).filter_by(database_name=database_name).first()
    )

    if not database:
        logger.info(f"Creating database reference for {database_name}")
        database = models.Database(database_name=database_name, *args, **kwargs)
        db.session.add(database)

    database.set_sqlalchemy_uri(sqlalchemy_uri)
    db.session.commit()
    return database


def get_example_database():
    from superset import conf

    db_uri = conf.get("SQLALCHEMY_EXAMPLES_URI") or conf.get("SQLALCHEMY_DATABASE_URI")
    return get_or_create_db("examples", db_uri)


def is_adhoc_metric(metric) -> bool:
    return bool(
        isinstance(metric, dict)
        and (
            (
                metric["expressionType"] == ADHOC_METRIC_EXPRESSION_TYPES["SIMPLE"]
                and metric["column"]
                and metric["aggregate"]
            )
            or (
                metric["expressionType"] == ADHOC_METRIC_EXPRESSION_TYPES["SQL"]
                and metric["sqlExpression"]
            )
        )
        and metric["label"]
    )


def get_metric_name(metric):
    return metric["label"] if is_adhoc_metric(metric) else metric


def get_metric_names(metrics):
    return [get_metric_name(metric) for metric in metrics]


def ensure_path_exists(path: str):
    try:
        os.makedirs(path)
    except OSError as exc:
        if not (os.path.isdir(path) and exc.errno == errno.EEXIST):
            raise


def get_since_until(
    time_range: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    time_shift: Optional[str] = None,
    relative_start: Optional[str] = None,
    relative_end: Optional[str] = None,
) -> Tuple[datetime, datetime]:
    """Return `since` and `until` date time tuple from string representations of
    time_range, since, until and time_shift.

    This functiom supports both reading the keys separately (from `since` and
    `until`), as well as the new `time_range` key. Valid formats are:

        - ISO 8601
        - X days/years/hours/day/year/weeks
        - X days/years/hours/day/year/weeks ago
        - X days/years/hours/day/year/weeks from now
        - freeform

    Additionally, for `time_range` (these specify both `since` and `until`):

        - Last day
        - Last week
        - Last month
        - Last quarter
        - Last year
        - No filter
        - Last X seconds/minutes/hours/days/weeks/months/years
        - Next X seconds/minutes/hours/days/weeks/months/years

    """
    separator = " : "
    relative_start = parse_human_datetime(relative_start if relative_start else "today")
    relative_end = parse_human_datetime(relative_end if relative_end else "today")
    common_time_frames = {
        "Last day": (
            relative_start - relativedelta(days=1),  # type: ignore
            relative_end,
        ),
        "Last week": (
            relative_start - relativedelta(weeks=1),  # type: ignore
            relative_end,
        ),
        "Last month": (
            relative_start - relativedelta(months=1),  # type: ignore
            relative_end,
        ),
        "Last quarter": (
            relative_start - relativedelta(months=3),  # type: ignore
            relative_end,
        ),
        "Last year": (
            relative_start - relativedelta(years=1),  # type: ignore
            relative_end,
        ),
    }

    if time_range:
        if separator in time_range:
            since, until = time_range.split(separator, 1)
            if since and since not in common_time_frames:
                since = add_ago_to_since(since)
            since = parse_human_datetime(since)
            until = parse_human_datetime(until)
        elif time_range in common_time_frames:
            since, until = common_time_frames[time_range]
        elif time_range == "No filter":
            since = until = None
        else:
            rel, num, grain = time_range.split()
            if rel == "Last":
                since = relative_start - relativedelta(  # type: ignore
                    **{grain: int(num)}
                )
                until = relative_end
            else:  # rel == 'Next'
                since = relative_start
                until = relative_end + relativedelta(  # type: ignore
                    **{grain: int(num)}
                )
    else:
        since = since or ""
        if since:
            since = add_ago_to_since(since)
        since = parse_human_datetime(since)
        until = parse_human_datetime(until) if until else relative_end

    if time_shift:
        time_delta = parse_past_timedelta(time_shift)
        since = since if since is None else (since - time_delta)  # type: ignore
        until = until if until is None else (until - time_delta)  # type: ignore

    if since and until and since > until:
        raise ValueError(_("From date cannot be larger than to date"))

    return since, until  # type: ignore


def add_ago_to_since(since: str) -> str:
    """
    Backwards compatibility hack. Without this slices with since: 7 days will
    be treated as 7 days in the future.

    :param str since:
    :returns: Since with ago added if necessary
    :rtype: str
    """
    since_words = since.split(" ")
    grains = ["days", "years", "hours", "day", "year", "weeks"]
    if len(since_words) == 2 and since_words[1] in grains:
        since += " ago"
    return since


def convert_legacy_filters_into_adhoc(fd):
    mapping = {"having": "having_filters", "where": "filters"}

    if not fd.get("adhoc_filters"):
        fd["adhoc_filters"] = []

        for clause, filters in mapping.items():
            if clause in fd and fd[clause] != "":
                fd["adhoc_filters"].append(to_adhoc(fd, "SQL", clause))

            if filters in fd:
                for filt in filter(lambda x: x is not None, fd[filters]):
                    fd["adhoc_filters"].append(to_adhoc(filt, "SIMPLE", clause))

    for key in ("filters", "having", "having_filters", "where"):
        if key in fd:
            del fd[key]


def split_adhoc_filters_into_base_filters(fd):
    """
    Mutates form data to restructure the adhoc filters in the form of the four base
    filters, `where`, `having`, `filters`, and `having_filters` which represent
    free form where sql, free form having sql, structured where clauses and structured
    having clauses.
    """
    adhoc_filters = fd.get("adhoc_filters")
    if isinstance(adhoc_filters, list):
        simple_where_filters = []
        simple_having_filters = []
        sql_where_filters = []
        sql_having_filters = []
        for adhoc_filter in adhoc_filters:
            expression_type = adhoc_filter.get("expressionType")
            clause = adhoc_filter.get("clause")
            if expression_type == "SIMPLE":
                if clause == "WHERE":
                    simple_where_filters.append(
                        {
                            "col": adhoc_filter.get("subject"),
                            "op": adhoc_filter.get("operator"),
                            "val": adhoc_filter.get("comparator"),
                        }
                    )
                elif clause == "HAVING":
                    simple_having_filters.append(
                        {
                            "col": adhoc_filter.get("subject"),
                            "op": adhoc_filter.get("operator"),
                            "val": adhoc_filter.get("comparator"),
                        }
                    )
            elif expression_type == "SQL":
                if clause == "WHERE":
                    sql_where_filters.append(adhoc_filter.get("sqlExpression"))
                elif clause == "HAVING":
                    sql_having_filters.append(adhoc_filter.get("sqlExpression"))
        fd["where"] = " AND ".join(["({})".format(sql) for sql in sql_where_filters])
        fd["having"] = " AND ".join(["({})".format(sql) for sql in sql_having_filters])
        fd["having_filters"] = simple_having_filters
        fd["filters"] = simple_where_filters


def get_username() -> Optional[str]:
    """Get username if within the flask context, otherwise return noffin'"""
    try:
        return g.user.username
    except Exception:
        return None


def parse_ssl_cert(certificate: str) -> _Certificate:
    """
    Parses the contents of a certificate and returns a valid certificate object
    if valid.

    :param certificate: Contents of certificate file
    :return: Valid certificate instance
    :raises CertificateException: If certificate is not valid/unparseable
    """
    try:
        return x509.load_pem_x509_certificate(
            certificate.encode("utf-8"), default_backend()
        )
    except ValueError as e:
        raise CertificateException("Invalid certificate")


def create_ssl_cert_file(certificate: str) -> str:
    """
    This creates a certificate file that can be used to validate HTTPS
    sessions. A certificate is only written to disk once; on subsequent calls,
    only the path of the existing certificate is returned.

    :param certificate: The contents of the certificate
    :return: The path to the certificate file
    :raises CertificateException: If certificate is not valid/unparseable
    """
    filename = f"{hashlib.md5(certificate.encode('utf-8')).hexdigest()}.crt"
    cert_dir = current_app.config["SSL_CERT_PATH"]
    path = cert_dir if cert_dir else tempfile.gettempdir()
    path = os.path.join(path, filename)
    if not os.path.exists(path):
        # Validate certificate prior to persisting to temporary directory
        parse_ssl_cert(certificate)
        cert_file = open(path, "w")
        cert_file.write(certificate)
        cert_file.close()
    return path


def MediumText() -> Variant:
    return Text().with_variant(MEDIUMTEXT(), "mysql")


def shortid() -> str:
    return "{}".format(uuid.uuid4())[-12:]


class DatasourceName(NamedTuple):
    table: str
    schema: str


def get_stacktrace():
    if current_app.config["SHOW_STACKTRACE"]:
        return traceback.format_exc()


def split(
    s: str, delimiter: str = " ", quote: str = '"', escaped_quote: str = r"\""
) -> Iterator[str]:
    """
    A split function that is aware of quotes and parentheses.

    :param s: string to split
    :param delimiter: string defining where to split, usually a comma or space
    :param quote: string, either a single or a double quote
    :param escaped_quote: string representing an escaped quote
    :return: list of strings
    """
    parens = 0
    quotes = False
    i = 0
    for j, c in enumerate(s):
        complete = parens == 0 and not quotes
        if complete and c == delimiter:
            yield s[i:j]
            i = j + len(delimiter)
        elif c == "(":
            parens += 1
        elif c == ")":
            parens -= 1
        elif c == quote:
            if quotes and s[j - len(escaped_quote) + 1 : j + 1] != escaped_quote:
                quotes = False
            elif not quotes:
                quotes = True
    yield s[i:]


def get_iterable(x: Any) -> List:
    """
    Get an iterable (list) representation of the object.

    :param x: The object
    :returns: An iterable representation
    """

    return x if isinstance(x, list) else [x]


class TimeRangeEndpoint(str, Enum):
    """
    The time range endpoint types which represent inclusive, exclusive, or unknown.

    Unknown represents endpoints which are ill-defined as though the interval may be
    [start, end] the filter may behave like (start, end] due to mixed data types and
    lexicographical ordering.

    :see: https://github.com/apache/incubator-superset/issues/6360
    """

    EXCLUSIVE = "exclusive"
    INCLUSIVE = "inclusive"
    UNKNOWN = "unknown"


class ReservedUrlParameters(str, Enum):
    """
    Reserved URL parameters that are used internally by Superset. These will not be
    passed to chart queries, as they control the behavior of the UI.
    """

    STANDALONE = "standalone"
    EDIT_MODE = "edit"


class QuerySource(Enum):
    """
    The source of a SQL query.
    """

    CHART = 0
    DASHBOARD = 1
    SQL_LAB = 2


class DbColumnType(Enum):
    """
    Generic database column type
    """

    NUMERIC = 0
    STRING = 1
    TEMPORAL = 2
