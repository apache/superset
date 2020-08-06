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
"""Utility functions used across Superset"""
import decimal
import errno
import functools
import hashlib
import json
import logging
import os
import re
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
from timeit import default_timer
from types import TracebackType
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    Iterator,
    List,
    NamedTuple,
    Optional,
    Sequence,
    Set,
    Tuple,
    Type,
    TYPE_CHECKING,
    Union,
)
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
from flask import current_app, flash, g, Markup, render_template
from flask_appbuilder import SQLA
from flask_appbuilder.security.sqla.models import Role, User
from flask_babel import gettext as __, lazy_gettext as _
from sqlalchemy import event, exc, select, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql.type_api import Variant
from sqlalchemy.types import TEXT, TypeDecorator

from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
    CertificateException,
    SupersetException,
    SupersetTimeoutException,
)
from superset.typing import FlaskResponse, FormData, Metric
from superset.utils.dates import datetime_to_epoch, EPOCH

try:
    from pydruid.utils.having import Having
except ImportError:
    pass

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseDatasource
    from superset.models.core import Database


logging.getLogger("MARKDOWN").setLevel(logging.INFO)
logger = logging.getLogger(__name__)

DTTM_ALIAS = "__timestamp"
ADHOC_METRIC_EXPRESSION_TYPES = {"SIMPLE": "SIMPLE", "SQL": "SQL"}

JS_MAX_INTEGER = 9007199254740991  # Largest int Java Script can handle 2^53-1

try:
    # Having might not have been imported.
    class DimSelector(Having):
        def __init__(self, **args: Any) -> None:
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


def flasher(msg: str, severity: str = "message") -> None:
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

    def __init__(
        self, func: Callable[..., Any], watch: Optional[Tuple[str, ...]] = None
    ) -> None:
        self.func = func
        self.cache: Dict[Any, Any] = {}
        self.is_method = False
        self.watch = watch or ()

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        key = [args, frozenset(kwargs.items())]
        if self.is_method:
            key.append(tuple([getattr(args[0], v, None) for v in self.watch]))
        key = tuple(key)  # type: ignore
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

    def __repr__(self) -> str:
        """Return the function's docstring."""
        return self.func.__doc__ or ""

    def __get__(
        self, obj: Any, objtype: Type[Any]
    ) -> functools.partial:  # type: ignore
        if not self.is_method:
            self.is_method = True
        # Support instance methods.
        return functools.partial(self.__call__, obj)


def memoized(
    func: Optional[Callable[..., Any]] = None, watch: Optional[Tuple[str, ...]] = None
) -> Callable[..., Any]:
    if func:
        return _memoized(func)

    def wrapper(f: Callable[..., Any]) -> Callable[..., Any]:
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


def cast_to_num(value: Union[float, int, str]) -> Optional[Union[float, int]]:
    """Casts a value to an int/float

    >>> cast_to_num('5')
    5
    >>> cast_to_num('5.2')
    5.2
    >>> cast_to_num(10)
    10
    >>> cast_to_num(10.1)
    10.1
    >>> cast_to_num('this is not a string') is None
    True

    :param value: value to be converted to numeric representation
    :returns: value cast to `int` if value is all digits, `float` if `value` is
              decimal value and `None`` if it can't be converted
    """
    if isinstance(value, (int, float)):
        return value
    if value.isdigit():
        return int(value)
    try:
        return float(value)
    except ValueError:
        return None


def list_minus(l: List[Any], minus: List[Any]) -> List[Any]:
    """Returns l without what is in minus

    >>> list_minus([1, 2, 3], [2])
    [1, 3]
    """
    return [o for o in l if o not in minus]


def parse_human_datetime(human_readable: str) -> datetime:
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
    try:
        dttm = parse(human_readable)
    except Exception:  # pylint: disable=broad-except
        try:
            cal = parsedatetime.Calendar()
            parsed_dttm, parsed_flags = cal.parseDT(human_readable)
            # when time is not extracted, we 'reset to midnight'
            if parsed_flags & 2 == 0:
                parsed_dttm = parsed_dttm.replace(hour=0, minute=0, second=0)
            dttm = dttm_from_timetuple(parsed_dttm.utctimetuple())
        except Exception as ex:
            logger.exception(ex)
            raise ValueError("Couldn't parse date string [{}]".format(human_readable))
    return dttm


def dttm_from_timetuple(date_: struct_time) -> datetime:
    return datetime(
        date_.tm_year,
        date_.tm_mon,
        date_.tm_mday,
        date_.tm_hour,
        date_.tm_min,
        date_.tm_sec,
    )


def md5_hex(data: str) -> str:
    return hashlib.md5(data.encode()).hexdigest()


class DashboardEncoder(json.JSONEncoder):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.sort_keys = True

    # pylint: disable=E0202
    def default(self, o: Any) -> Dict[Any, Any]:
        try:
            vals = {k: v for k, v in o.__dict__.items() if k != "_sa_instance_state"}
            return {"__{}__".format(o.__class__.__name__): vals}
        except Exception:  # pylint: disable=broad-except
            if isinstance(o, datetime):
                return {"__datetime__": o.replace(microsecond=0).isoformat()}
            return json.JSONEncoder(sort_keys=True).default(o)


def parse_human_timedelta(human_readable: Optional[str]) -> timedelta:
    """
    Returns ``datetime.datetime`` from natural language time deltas

    >>> parse_human_datetime('now') <= datetime.now()
    True
    """
    cal = parsedatetime.Calendar()
    dttm = dttm_from_timetuple(datetime.now().timetuple())
    date_ = cal.parse(human_readable or "", dttm)[0]
    date_ = datetime(
        date_.tm_year,
        date_.tm_mon,
        date_.tm_mday,
        date_.tm_hour,
        date_.tm_min,
        date_.tm_sec,
    )
    return date_ - dttm


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


class JSONEncodedDict(TypeDecorator):  # pylint: disable=abstract-method
    """Represents an immutable structure as a json-encoded string."""

    impl = TEXT

    def process_bind_param(
        self, value: Optional[Dict[Any, Any]], dialect: str
    ) -> Optional[str]:
        return json.dumps(value) if value is not None else None

    def process_result_value(
        self, value: Optional[str], dialect: str
    ) -> Optional[Dict[Any, Any]]:
        return json.loads(value) if value is not None else None


def format_timedelta(time_delta: timedelta) -> str:
    """
    Ensures negative time deltas are easily interpreted by humans

    >>> td = timedelta(0) - timedelta(days=1, hours=5,minutes=6)
    >>> str(td)
    '-2 days, 18:54:00'
    >>> format_timedelta(td)
    '-1 day, 5:06:00'
    """
    if time_delta < timedelta(0):
        return "-" + str(abs(time_delta))

    # Change this to format positive time deltas the way you want
    return str(time_delta)


def base_json_conv(  # pylint: disable=inconsistent-return-statements,too-many-return-statements
    obj: Any,
) -> Any:
    if isinstance(obj, memoryview):
        obj = obj.tobytes()
    if isinstance(obj, np.int64):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, timedelta):
        return format_timedelta(obj)
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except Exception:  # pylint: disable=broad-except
            return "[bytes]"


def json_iso_dttm_ser(obj: Any, pessimistic: bool = False) -> str:
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

        raise TypeError("Unserializable object {} of type {}".format(obj, type(obj)))
    return obj


def pessimistic_json_iso_dttm_ser(obj: Any) -> str:
    """Proxy to call json_iso_dttm_ser in a pessimistic way

    If one of object is not serializable to json, it will still succeed"""
    return json_iso_dttm_ser(obj, pessimistic=True)


def json_int_dttm_ser(obj: Any) -> float:
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


def json_dumps_w_dates(payload: Dict[Any, Any]) -> str:
    return json.dumps(payload, default=json_int_dttm_ser)


def error_msg_from_exception(ex: Exception) -> str:
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
    if hasattr(ex, "message"):
        if isinstance(ex.message, dict):  # type: ignore
            msg = ex.message.get("message")  # type: ignore
        elif ex.message:  # type: ignore
            msg = ex.message  # type: ignore
    return msg or str(ex)


def markdown(raw: str, markup_wrap: Optional[bool] = False) -> str:
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
    safe = md.markdown(
        raw or "",
        extensions=[
            "markdown.extensions.tables",
            "markdown.extensions.fenced_code",
            "markdown.extensions.codehilite",
        ],
    )
    safe = bleach.clean(safe, safe_markdown_tags, safe_markdown_attrs)
    if markup_wrap:
        safe = Markup(safe)
    return safe


def readfile(file_path: str) -> Optional[str]:
    with open(file_path) as f:
        content = f.read()
    return content


def generic_find_constraint_name(
    table: str, columns: Set[str], referenced: str, database: SQLA
) -> Optional[str]:
    """Utility to find a constraint name in alembic migrations"""
    tbl = sa.Table(
        table, database.metadata, autoload=True, autoload_with=database.engine
    )

    for fk in tbl.foreign_key_constraints:
        if fk.referred_table.name == referenced and set(fk.column_keys) == columns:
            return fk.name

    return None


def generic_find_fk_constraint_name(  # pylint: disable=invalid-name
    table: str, columns: Set[str], referenced: str, insp: Inspector
) -> Optional[str]:
    """Utility to find a foreign-key constraint name in alembic migrations"""
    for fk in insp.get_foreign_keys(table):
        if (
            fk["referred_table"] == referenced
            and set(fk["referred_columns"]) == columns
        ):
            return fk["name"]

    return None


def generic_find_fk_constraint_names(  # pylint: disable=invalid-name
    table: str, columns: Set[str], referenced: str, insp: Inspector
) -> Set[str]:
    """Utility to find foreign-key constraint names in alembic migrations"""
    names = set()

    for fk in insp.get_foreign_keys(table):
        if (
            fk["referred_table"] == referenced
            and set(fk["referred_columns"]) == columns
        ):
            names.add(fk["name"])

    return names


def generic_find_uq_constraint_name(
    table: str, columns: Set[str], insp: Inspector
) -> Optional[str]:
    """Utility to find a unique constraint name in alembic migrations"""

    for uq in insp.get_unique_constraints(table):
        if columns == set(uq["column_names"]):
            return uq["name"]

    return None


def get_datasource_full_name(
    database_name: str, datasource_name: str, schema: Optional[str] = None
) -> str:
    if not schema:
        return "[{}].[{}]".format(database_name, datasource_name)
    return "[{}].[{}].[{}]".format(database_name, schema, datasource_name)


def validate_json(obj: Union[bytes, bytearray, str]) -> None:
    if obj:
        try:
            json.loads(obj)
        except Exception as ex:
            logger.error("JSON is not valid %s", str(ex))
            raise SupersetException("JSON is not valid")


class timeout:  # pylint: disable=invalid-name
    """
    To be used in a ``with`` block and timeout its content.
    """

    def __init__(self, seconds: int = 1, error_message: str = "Timeout") -> None:
        self.seconds = seconds
        self.error_message = error_message

    def handle_timeout(  # pylint: disable=unused-argument
        self, signum: int, frame: Any
    ) -> None:
        logger.error("Process timed out")
        raise SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message=self.error_message,
            level=ErrorLevel.ERROR,
            extra={"timeout": self.seconds},
        )

    def __enter__(self) -> None:
        try:
            signal.signal(signal.SIGALRM, self.handle_timeout)
            signal.alarm(self.seconds)
        except ValueError as ex:
            logger.warning("timeout can't be used in the current context")
            logger.exception(ex)

    def __exit__(  # pylint: disable=redefined-outer-name,unused-variable,redefined-builtin
        self, type: Any, value: Any, traceback: TracebackType
    ) -> None:
        try:
            signal.alarm(0)
        except ValueError as ex:
            logger.warning("timeout can't be used in the current context")
            logger.exception(ex)


def pessimistic_connection_handling(some_engine: Engine) -> None:
    @event.listens_for(some_engine, "engine_connect")
    def ping_connection(  # pylint: disable=unused-variable
        connection: Connection, branch: bool
    ) -> None:
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


class QueryStatus:  # pylint: disable=too-few-public-methods
    """Enum-type class for query statuses"""

    STOPPED: str = "stopped"
    FAILED: str = "failed"
    PENDING: str = "pending"
    RUNNING: str = "running"
    SCHEDULED: str = "scheduled"
    SUCCESS: str = "success"
    TIMED_OUT: str = "timed_out"


def notify_user_about_perm_udate(  # pylint: disable=too-many-arguments
    granter: User,
    user: User,
    role: Role,
    datasource: "BaseDatasource",
    tpl_name: str,
    config: Dict[str, Any],
) -> None:
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


def send_email_smtp(  # pylint: disable=invalid-name,too-many-arguments,too-many-locals
    to: str,
    subject: str,
    html_content: str,
    config: Dict[str, Any],
    files: Optional[List[str]] = None,
    data: Optional[Dict[str, str]] = None,
    images: Optional[Dict[str, bytes]] = None,
    dryrun: bool = False,
    cc: Optional[str] = None,
    bcc: Optional[str] = None,
    mime_subtype: str = "mixed",
) -> None:
    """
    Send an email with html content, eg:
    send_email_smtp(
        'test@example.com', 'foo', '<b>Foo</b> bar',['/dev/null'], dryrun=True)
    """
    smtp_mail_from = config["SMTP_MAIL_FROM"]
    smtp_mail_to = get_email_address_list(to)

    msg = MIMEMultipart(mime_subtype)
    msg["Subject"] = subject
    msg["From"] = smtp_mail_from
    msg["To"] = ", ".join(smtp_mail_to)
    msg.preamble = "This is a multi-part message in MIME format."

    recipients = smtp_mail_to
    if cc:
        smtp_mail_cc = get_email_address_list(cc)
        msg["CC"] = ", ".join(smtp_mail_cc)
        recipients = recipients + smtp_mail_cc

    if bcc:
        # don't add bcc in header
        smtp_mail_bcc = get_email_address_list(bcc)
        recipients = recipients + smtp_mail_bcc

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
    for msgid, imgdata in (images or {}).items():
        image = MIMEImage(imgdata)
        image.add_header("Content-ID", "<%s>" % msgid)
        image.add_header("Content-Disposition", "inline")
        msg.attach(image)

    send_mime_email(smtp_mail_from, recipients, msg, config, dryrun=dryrun)


def send_mime_email(
    e_from: str,
    e_to: List[str],
    mime_msg: MIMEMultipart,
    config: Dict[str, Any],
    dryrun: bool = False,
) -> None:
    smtp_host = config["SMTP_HOST"]
    smtp_port = config["SMTP_PORT"]
    smtp_user = config["SMTP_USER"]
    smtp_password = config["SMTP_PASSWORD"]
    smtp_starttls = config["SMTP_STARTTLS"]
    smtp_ssl = config["SMTP_SSL"]

    if not dryrun:
        smtp = (
            smtplib.SMTP_SSL(smtp_host, smtp_port)
            if smtp_ssl
            else smtplib.SMTP(smtp_host, smtp_port)
        )
        if smtp_starttls:
            smtp.starttls()
        if smtp_user and smtp_password:
            smtp.login(smtp_user, smtp_password)
        logger.info("Sent an email to %s", str(e_to))
        smtp.sendmail(e_from, e_to, mime_msg.as_string())
        smtp.quit()
    else:
        logger.info("Dryrun enabled, email notification content is below:")
        logger.info(mime_msg.as_string())


def get_email_address_list(address_string: str) -> List[str]:
    address_string_list: List[str] = []
    if isinstance(address_string, str):
        address_string_list = re.split(r",|\s|;", address_string)
    return [x.strip() for x in address_string_list if x.strip()]


def get_email_address_str(address_string: str) -> str:
    address_list = get_email_address_list(address_string)
    address_list_str = ", ".join(address_list)

    return address_list_str


def choicify(values: Iterable[Any]) -> List[Tuple[Any, Any]]:
    """Takes an iterable and makes an iterable of tuples with it"""
    return [(v, v) for v in values]


def zlib_compress(data: Union[bytes, str]) -> bytes:
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


def to_adhoc(
    filt: Dict[str, Any], expression_type: str = "SIMPLE", clause: str = "where"
) -> Dict[str, Any]:
    result = {
        "clause": clause.upper(),
        "expressionType": expression_type,
        "filterOptionName": str(uuid.uuid4()),
        "isExtra": bool(filt.get("isExtra")),
    }

    if expression_type == "SIMPLE":
        result.update(
            {
                "comparator": filt.get("val"),
                "operator": filt.get("op"),
                "subject": filt.get("col"),
            }
        )
    elif expression_type == "SQL":
        result.update({"sqlExpression": filt.get(clause)})

    return result


def merge_extra_filters(  # pylint: disable=too-many-branches
    form_data: Dict[str, Any]
) -> None:
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

        def get_filter_key(f: Dict[str, Any]) -> str:
            if "expressionType" in f:
                return "{}__{}".format(f["subject"], f["operator"])

            return "{}__{}".format(f["col"], f["op"])

        existing_filters = {}
        for existing in form_data["adhoc_filters"]:
            if (
                existing["expressionType"] == "SIMPLE"
                and existing["comparator"] is not None
                and existing["subject"] is not None
            ):
                existing_filters[get_filter_key(existing)] = existing["comparator"]

        for filtr in form_data[  # pylint: disable=too-many-nested-blocks
            "extra_filters"
        ]:
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

        return user.username

    return None


def get_or_create_db(
    database_name: str, sqlalchemy_uri: str, *args: Any, **kwargs: Any
) -> "Database":
    from superset import db
    from superset.models import core as models

    database = (
        db.session.query(models.Database).filter_by(database_name=database_name).first()
    )

    if not database:
        logger.info("Creating database reference for %s", database_name)
        database = models.Database(database_name=database_name, *args, **kwargs)
        db.session.add(database)

    database.set_sqlalchemy_uri(sqlalchemy_uri)
    db.session.commit()
    return database


def get_example_database() -> "Database":
    from superset import conf

    db_uri = conf.get("SQLALCHEMY_EXAMPLES_URI") or conf.get("SQLALCHEMY_DATABASE_URI")
    return get_or_create_db("examples", db_uri)


def get_main_database() -> "Database":
    from superset import conf

    db_uri = conf.get("SQLALCHEMY_DATABASE_URI")
    return get_or_create_db("main", db_uri)


def is_adhoc_metric(metric: Metric) -> bool:
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


def get_metric_name(metric: Metric) -> str:
    return metric["label"] if is_adhoc_metric(metric) else metric  # type: ignore


def get_metric_names(metrics: Sequence[Metric]) -> List[str]:
    return [get_metric_name(metric) for metric in metrics]


def ensure_path_exists(path: str) -> None:
    try:
        os.makedirs(path)
    except OSError as exc:
        if not (os.path.isdir(path) and exc.errno == errno.EEXIST):
            raise


def get_since_until(  # pylint: disable=too-many-arguments
    time_range: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    time_shift: Optional[str] = None,
    relative_start: Optional[str] = None,
    relative_end: Optional[str] = None,
) -> Tuple[Optional[datetime], Optional[datetime]]:
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
    relative_start = parse_human_datetime(  # type: ignore
        relative_start if relative_start else "today"
    )
    relative_end = parse_human_datetime(  # type: ignore
        relative_end if relative_end else "today"
    )
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
            since = parse_human_datetime(since) if since else None  # type: ignore
            until = parse_human_datetime(until) if until else None  # type: ignore
        elif time_range in common_time_frames:
            since, until = common_time_frames[time_range]
        elif time_range == "No filter":
            since = until = None
        else:
            rel, num, grain = time_range.split()
            if rel == "Last":
                since = relative_start - relativedelta(  # type: ignore
                    **{grain: int(num)}  # type: ignore
                )
                until = relative_end
            else:  # rel == 'Next'
                since = relative_start
                until = relative_end + relativedelta(  # type: ignore
                    **{grain: int(num)}  # type: ignore
                )
    else:
        since = since or ""
        if since:
            since = add_ago_to_since(since)
        since = parse_human_datetime(since) if since else None  # type: ignore
        until = parse_human_datetime(until) if until else relative_end  # type: ignore

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


def convert_legacy_filters_into_adhoc(  # pylint: disable=invalid-name
    form_data: FormData,
) -> None:
    mapping = {"having": "having_filters", "where": "filters"}

    if not form_data.get("adhoc_filters"):
        form_data["adhoc_filters"] = []

        for clause, filters in mapping.items():
            if clause in form_data and form_data[clause] != "":
                form_data["adhoc_filters"].append(to_adhoc(form_data, "SQL", clause))

            if filters in form_data:
                for filt in filter(lambda x: x is not None, form_data[filters]):
                    form_data["adhoc_filters"].append(to_adhoc(filt, "SIMPLE", clause))

    for key in ("filters", "having", "having_filters", "where"):
        if key in form_data:
            del form_data[key]


def split_adhoc_filters_into_base_filters(  # pylint: disable=invalid-name
    form_data: FormData,
) -> None:
    """
    Mutates form data to restructure the adhoc filters in the form of the four base
    filters, `where`, `having`, `filters`, and `having_filters` which represent
    free form where sql, free form having sql, structured where clauses and structured
    having clauses.
    """
    adhoc_filters = form_data.get("adhoc_filters")
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
        form_data["where"] = " AND ".join(
            ["({})".format(sql) for sql in sql_where_filters]
        )
        form_data["having"] = " AND ".join(
            ["({})".format(sql) for sql in sql_having_filters]
        )
        form_data["having_filters"] = simple_having_filters
        form_data["filters"] = simple_where_filters


def get_username() -> Optional[str]:
    """Get username if within the flask context, otherwise return noffin'"""
    try:
        return g.user.username
    except Exception:  # pylint: disable=broad-except
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
    except ValueError:
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


def time_function(
    func: Callable[..., FlaskResponse], *args: Any, **kwargs: Any
) -> Tuple[float, Any]:
    """
    Measures the amount of time a function takes to execute in ms

    :param func: The function execution time to measure
    :param args: args to be passed to the function
    :param kwargs: kwargs to be passed to the function
    :return: A tuple with the duration and response from the function
    """
    start = default_timer()
    response = func(*args, **kwargs)
    stop = default_timer()
    return (stop - start) * 1000.0, response


def MediumText() -> Variant:  # pylint:disable=invalid-name
    return Text().with_variant(MEDIUMTEXT(), "mysql")


def shortid() -> str:
    return "{}".format(uuid.uuid4())[-12:]


class DatasourceName(NamedTuple):
    table: str
    schema: str


def get_stacktrace() -> Optional[str]:
    if current_app.config["SHOW_STACKTRACE"]:
        return traceback.format_exc()
    return None


def split(
    string: str, delimiter: str = " ", quote: str = '"', escaped_quote: str = r"\""
) -> Iterator[str]:
    """
    A split function that is aware of quotes and parentheses.

    :param string: string to split
    :param delimiter: string defining where to split, usually a comma or space
    :param quote: string, either a single or a double quote
    :param escaped_quote: string representing an escaped quote
    :return: list of strings
    """
    parens = 0
    quotes = False
    i = 0
    for j, character in enumerate(string):
        complete = parens == 0 and not quotes
        if complete and character == delimiter:
            yield string[i:j]
            i = j + len(delimiter)
        elif character == "(":
            parens += 1
        elif character == ")":
            parens -= 1
        elif character == quote:
            if quotes and string[j - len(escaped_quote) + 1 : j + 1] != escaped_quote:
                quotes = False
            elif not quotes:
                quotes = True
    yield string[i:]


def get_iterable(x: Any) -> List[Any]:
    """
    Get an iterable (list) representation of the object.

    :param x: The object
    :returns: An iterable representation
    """

    return x if isinstance(x, list) else [x]


class LenientEnum(Enum):
    """Enums that do not raise ValueError when value is invalid"""

    @classmethod
    def get(cls, value: Any) -> Any:
        try:
            return super().__new__(cls, value)
        except ValueError:
            return None


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


class QueryMode(str, LenientEnum):
    """
    Whether the query runs on aggregate or returns raw records
    """

    RAW = "raw"
    AGGREGATE = "aggregate"


class FilterOperator(str, Enum):
    """
    Operators used filter controls
    """

    EQUALS = "=="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_THAN_OR_EQUALS = ">="
    LESS_THAN_OR_EQUALS = "<="
    LIKE = "LIKE"
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    IN = "IN"  # pylint: disable=invalid-name
    NOT_IN = "NOT IN"
    REGEX = "REGEX"


class ChartDataResultType(str, Enum):
    """
    Chart data response type
    """

    FULL = "full"
    QUERY = "query"
    RESULTS = "results"
    SAMPLES = "samples"


class ChartDataResultFormat(str, Enum):
    """
    Chart data response format
    """

    CSV = "csv"
    JSON = "json"


class TemporalType(str, Enum):
    """
    Supported temporal types
    """

    DATE = "DATE"
    DATETIME = "DATETIME"
    SMALLDATETIME = "SMALLDATETIME"
    TEXT = "TEXT"
    TIME = "TIME"
    TIMESTAMP = "TIMESTAMP"


class PostProcessingContributionOrientation(str, Enum):
    """
    Calculate cell contibution to row/column total
    """

    ROW = "row"
    COLUMN = "column"
