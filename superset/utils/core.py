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
# pylint: disable=too-many-lines
import _thread
import collections
import decimal
import errno
import json
import logging
import os
import platform
import re
import signal
import smtplib
import tempfile
import threading
import traceback
import uuid
import zlib
from datetime import date, datetime, time, timedelta
from distutils.util import strtobool
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate
from enum import Enum, IntEnum
from io import BytesIO
from timeit import default_timer
from types import TracebackType
from typing import (
    Any,
    Callable,
    cast,
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
    TypeVar,
    Union,
)
from urllib.parse import unquote_plus
from zipfile import ZipFile

import bleach
import markdown as md
import numpy as np
import pandas as pd
import sqlalchemy as sa
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.backends.openssl.x509 import _Certificate
from flask import current_app, flash, g, Markup, render_template, request
from flask_appbuilder import SQLA
from flask_appbuilder.security.sqla.models import Role, User
from flask_babel import gettext as __
from flask_babel.speaklater import LazyString
from pandas.api.types import infer_dtype
from pandas.core.dtypes.common import is_numeric_dtype
from sqlalchemy import event, exc, inspect, select, Text
from sqlalchemy.dialects.mysql import MEDIUMTEXT
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql.type_api import Variant
from sqlalchemy.types import TEXT, TypeDecorator, TypeEngine
from typing_extensions import TypedDict, TypeGuard

from superset.constants import (
    EXTRA_FORM_DATA_APPEND_KEYS,
    EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
    EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
)
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import (
    CertificateException,
    SupersetException,
    SupersetTimeoutException,
)
from superset.superset_typing import (
    AdhocColumn,
    AdhocMetric,
    AdhocMetricColumn,
    Column,
    FilterValues,
    FlaskResponse,
    FormData,
    Metric,
)
from superset.utils.database import get_example_database
from superset.utils.dates import datetime_to_epoch, EPOCH
from superset.utils.hashing import md5_sha_from_dict, md5_sha_from_str

try:
    from pydruid.utils.having import Having
except ImportError:
    pass

if TYPE_CHECKING:
    from superset.connectors.base.models import BaseColumn, BaseDatasource

logging.getLogger("MARKDOWN").setLevel(logging.INFO)
logger = logging.getLogger(__name__)

DTTM_ALIAS = "__timestamp"

NO_TIME_RANGE = "No filter"

TIME_COMPARISION = "__"

JS_MAX_INTEGER = 9007199254740991  # Largest int Java Script can handle 2^53-1

InputType = TypeVar("InputType")


class LenientEnum(Enum):
    """Enums with a `get` method that convert a enum value to `Enum` if it is a
    valid value."""

    @classmethod
    def get(cls, value: Any) -> Any:
        try:
            return super().__new__(cls, value)
        except ValueError:
            return None


class AdhocMetricExpressionType(str, Enum):
    SIMPLE = "SIMPLE"
    SQL = "SQL"


class AnnotationType(str, Enum):
    FORMULA = "FORMULA"
    INTERVAL = "INTERVAL"
    EVENT = "EVENT"
    TIME_SERIES = "TIME_SERIES"


class GenericDataType(IntEnum):
    """
    Generic database column type that fits both frontend and backend.
    """

    NUMERIC = 0
    STRING = 1
    TEMPORAL = 2
    BOOLEAN = 3
    # ARRAY = 4     # Mapping all the complex data types to STRING for now
    # JSON = 5      # and leaving these as a reminder.
    # MAP = 6
    # ROW = 7


class DatasourceDict(TypedDict):
    type: str
    id: int


class AdhocFilterClause(TypedDict, total=False):
    clause: str
    expressionType: str
    filterOptionName: Optional[str]
    comparator: Optional[FilterValues]
    operator: str
    subject: str
    isExtra: Optional[bool]
    sqlExpression: Optional[str]


class QueryObjectFilterClause(TypedDict, total=False):
    col: str
    op: str  # pylint: disable=invalid-name
    val: Optional[FilterValues]
    grain: Optional[str]
    isExtra: Optional[bool]


class ExtraFiltersTimeColumnType(str, Enum):
    GRANULARITY = "__granularity"
    TIME_COL = "__time_col"
    TIME_GRAIN = "__time_grain"
    TIME_ORIGIN = "__time_origin"
    TIME_RANGE = "__time_range"


class ExtraFiltersReasonType(str, Enum):
    NO_TEMPORAL_COLUMN = "no_temporal_column"
    COL_NOT_IN_DATASOURCE = "not_in_datasource"
    NOT_DRUID_DATASOURCE = "not_druid_datasource"


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
    ILIKE = "ILIKE"
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    IN = "IN"
    NOT_IN = "NOT IN"
    REGEX = "REGEX"
    IS_TRUE = "IS TRUE"
    IS_FALSE = "IS FALSE"


class PostProcessingBoxplotWhiskerType(str, Enum):
    """
    Calculate cell contribution to row/column total
    """

    TUKEY = "tukey"
    MINMAX = "min/max"
    PERCENTILE = "percentile"


class PostProcessingContributionOrientation(str, Enum):
    """
    Calculate cell contribution to row/column total
    """

    ROW = "row"
    COLUMN = "column"


class QueryMode(str, LenientEnum):
    """
    Whether the query runs on aggregate or returns raw records
    """

    RAW = "raw"
    AGGREGATE = "aggregate"


class QuerySource(Enum):
    """
    The source of a SQL query.
    """

    CHART = 0
    DASHBOARD = 1
    SQL_LAB = 2


class QueryStatus(str, Enum):
    """Enum-type class for query statuses"""

    STOPPED: str = "stopped"
    FAILED: str = "failed"
    PENDING: str = "pending"
    RUNNING: str = "running"
    SCHEDULED: str = "scheduled"
    SUCCESS: str = "success"
    FETCHING: str = "fetching"
    TIMED_OUT: str = "timed_out"


class DashboardStatus(str, Enum):
    """Dashboard status used for frontend filters"""

    PUBLISHED = "published"
    DRAFT = "draft"


class ReservedUrlParameters(str, Enum):
    """
    Reserved URL parameters that are used internally by Superset. These will not be
    passed to chart queries, as they control the behavior of the UI.
    """

    STANDALONE = "standalone"
    EDIT_MODE = "edit"

    @staticmethod
    def is_standalone_mode() -> Optional[bool]:
        standalone_param = request.args.get(ReservedUrlParameters.STANDALONE.value)
        standalone: Optional[bool] = bool(
            standalone_param and standalone_param != "false" and standalone_param != "0"
        )
        return standalone


class RowLevelSecurityFilterType(str, Enum):
    REGULAR = "Regular"
    BASE = "Base"


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


class ColumnTypeSource(Enum):
    GET_TABLE = 1
    CURSOR_DESCRIPION = 2


class ColumnSpec(NamedTuple):
    sqla_type: Union[TypeEngine, str]
    generic_type: GenericDataType
    is_dttm: bool
    python_date_format: Optional[str] = None


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
            logger.error(msg, exc_info=True)
        else:
            logger.info(msg)


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


def cast_to_num(value: Optional[Union[float, int, str]]) -> Optional[Union[float, int]]:
    """Casts a value to an int/float

    >>> cast_to_num('1 ')
    1.0
    >>> cast_to_num(' 2')
    2.0
    >>> cast_to_num('5')
    5
    >>> cast_to_num('5.2')
    5.2
    >>> cast_to_num(10)
    10
    >>> cast_to_num(10.1)
    10.1
    >>> cast_to_num(None) is None
    True
    >>> cast_to_num('this is not a string') is None
    True

    :param value: value to be converted to numeric representation
    :returns: value cast to `int` if value is all digits, `float` if `value` is
              decimal value and `None`` if it can't be converted
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value
    if value.isdigit():
        return int(value)
    try:
        return float(value)
    except ValueError:
        return None


def cast_to_boolean(value: Any) -> Optional[bool]:
    """Casts a value to an int/float

    >>> cast_to_boolean(1)
    True
    >>> cast_to_boolean(0)
    False
    >>> cast_to_boolean(0.5)
    True
    >>> cast_to_boolean('true')
    True
    >>> cast_to_boolean('false')
    False
    >>> cast_to_boolean('False')
    False
    >>> cast_to_boolean(None)

    :param value: value to be converted to boolean representation
    :returns: value cast to `bool`. when value is 'true' or value that are not 0
              converted into True. Return `None` if value is `None`
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() == "true"
    return False


def list_minus(l: List[Any], minus: List[Any]) -> List[Any]:
    """Returns l without what is in minus

    >>> list_minus([1, 2, 3], [2])
    [1, 3]
    """
    return [o for o in l if o not in minus]


class DashboardEncoder(json.JSONEncoder):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.sort_keys = True

    def default(self, o: Any) -> Union[Dict[Any, Any], str]:
        if isinstance(o, uuid.UUID):
            return str(o)
        try:
            vals = {k: v for k, v in o.__dict__.items() if k != "_sa_instance_state"}
            return {"__{}__".format(o.__class__.__name__): vals}
        except Exception:  # pylint: disable=broad-except
            if isinstance(o, datetime):
                return {"__datetime__": o.replace(microsecond=0).isoformat()}
            return json.JSONEncoder(sort_keys=True).default(o)


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


def base_json_conv(obj: Any,) -> Any:  # pylint: disable=inconsistent-return-statements
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
    if isinstance(obj, (uuid.UUID, time, LazyString)):
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
    if isinstance(obj, (datetime, date, pd.Timestamp)):
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


def generic_find_fk_constraint_name(
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
            logger.error("JSON is not valid %s", str(ex), exc_info=True)
            raise SupersetException("JSON is not valid") from ex


class SigalrmTimeout:
    """
    To be used in a ``with`` block and timeout its content.
    """

    def __init__(self, seconds: int = 1, error_message: str = "Timeout") -> None:
        self.seconds = seconds
        self.error_message = error_message

    def handle_timeout(  # pylint: disable=unused-argument
        self, signum: int, frame: Any
    ) -> None:
        logger.error("Process timed out", exc_info=True)
        raise SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message=self.error_message,
            level=ErrorLevel.ERROR,
            extra={"timeout": self.seconds},
        )

    def __enter__(self) -> None:
        try:
            if threading.current_thread() == threading.main_thread():
                signal.signal(signal.SIGALRM, self.handle_timeout)
                signal.alarm(self.seconds)
        except ValueError as ex:
            logger.warning("timeout can't be used in the current context")
            logger.exception(ex)

    def __exit__(  # pylint: disable=redefined-outer-name,redefined-builtin
        self, type: Any, value: Any, traceback: TracebackType
    ) -> None:
        try:
            signal.alarm(0)
        except ValueError as ex:
            logger.warning("timeout can't be used in the current context")
            logger.exception(ex)


class TimerTimeout:
    def __init__(self, seconds: int = 1, error_message: str = "Timeout") -> None:
        self.seconds = seconds
        self.error_message = error_message
        self.timer = threading.Timer(seconds, _thread.interrupt_main)

    def __enter__(self) -> None:
        self.timer.start()

    def __exit__(  # pylint: disable=redefined-outer-name,redefined-builtin
        self, type: Any, value: Any, traceback: TracebackType
    ) -> None:
        self.timer.cancel()
        if type is KeyboardInterrupt:  # raised by _thread.interrupt_main
            raise SupersetTimeoutException(
                error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
                message=self.error_message,
                level=ErrorLevel.ERROR,
                extra={"timeout": self.seconds},
            )


# Windows has no support for SIGALRM, so we use the timer based timeout
timeout: Union[Type[TimerTimeout], Type[SigalrmTimeout]] = (
    TimerTimeout if platform.system() == "Windows" else SigalrmTimeout
)


def pessimistic_connection_handling(some_engine: Engine) -> None:
    @event.listens_for(some_engine, "engine_connect")
    def ping_connection(connection: Connection, branch: bool) -> None:
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
        logger.debug("Sent an email to %s", str(e_to))
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


def simple_filter_to_adhoc(
    filter_clause: QueryObjectFilterClause, clause: str = "where",
) -> AdhocFilterClause:
    result: AdhocFilterClause = {
        "clause": clause.upper(),
        "expressionType": "SIMPLE",
        "comparator": filter_clause.get("val"),
        "operator": filter_clause["op"],
        "subject": filter_clause["col"],
    }
    if filter_clause.get("isExtra"):
        result["isExtra"] = True
    result["filterOptionName"] = md5_sha_from_dict(cast(Dict[Any, Any], result))

    return result


def form_data_to_adhoc(form_data: Dict[str, Any], clause: str) -> AdhocFilterClause:
    if clause not in ("where", "having"):
        raise ValueError(__("Unsupported clause type: %(clause)s", clause=clause))
    result: AdhocFilterClause = {
        "clause": clause.upper(),
        "expressionType": "SQL",
        "sqlExpression": form_data.get(clause),
    }
    result["filterOptionName"] = md5_sha_from_dict(cast(Dict[Any, Any], result))

    return result


def merge_extra_form_data(form_data: Dict[str, Any]) -> None:
    """
    Merge extra form data (appends and overrides) into the main payload
    and add applied time extras to the payload.
    """
    filter_keys = ["filters", "adhoc_filters"]
    extra_form_data = form_data.pop("extra_form_data", {})
    append_filters: List[QueryObjectFilterClause] = extra_form_data.get("filters", None)

    # merge append extras
    for key in [key for key in EXTRA_FORM_DATA_APPEND_KEYS if key not in filter_keys]:
        extra_value = getattr(extra_form_data, key, {})
        form_value = getattr(form_data, key, {})
        form_value.update(extra_value)
        if form_value:
            form_data["key"] = extra_value

    # map regular extras that apply to form data properties
    for src_key, target_key in EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS.items():
        value = extra_form_data.get(src_key)
        if value is not None:
            form_data[target_key] = value

    # map extras that apply to form data extra properties
    extras = form_data.get("extras", {})
    for key in EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS:
        value = extra_form_data.get(key)
        if value is not None:
            extras[key] = value
    if extras:
        form_data["extras"] = extras

    adhoc_filters: List[AdhocFilterClause] = form_data.get("adhoc_filters", [])
    form_data["adhoc_filters"] = adhoc_filters
    append_adhoc_filters: List[AdhocFilterClause] = extra_form_data.get(
        "adhoc_filters", []
    )
    adhoc_filters.extend(
        {"isExtra": True, **fltr} for fltr in append_adhoc_filters  # type: ignore
    )
    if append_filters:
        for key, value in form_data.items():
            if re.match("adhoc_filter.*", key):
                value.extend(
                    simple_filter_to_adhoc({"isExtra": True, **fltr})  # type: ignore
                    for fltr in append_filters
                    if fltr
                )


def merge_extra_filters(form_data: Dict[str, Any]) -> None:
    # extra_filters are temporary/contextual filters (using the legacy constructs)
    # that are external to the slice definition. We use those for dynamic
    # interactive filters like the ones emitted by the "Filter Box" visualization.
    # Note extra_filters only support simple filters.
    applied_time_extras: Dict[str, str] = {}
    form_data["applied_time_extras"] = applied_time_extras
    adhoc_filters = form_data.get("adhoc_filters", [])
    form_data["adhoc_filters"] = adhoc_filters
    merge_extra_form_data(form_data)
    if "extra_filters" in form_data:
        # __form and __to are special extra_filters that target time
        # boundaries. The rest of extra_filters are simple
        # [column_name in list_of_values]. `__` prefix is there to avoid
        # potential conflicts with column that would be named `from` or `to`
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
        for existing in adhoc_filters:
            if (
                existing["expressionType"] == "SIMPLE"
                and existing.get("comparator") is not None
                and existing.get("subject") is not None
            ):
                existing_filters[get_filter_key(existing)] = existing["comparator"]

        for filtr in form_data[  # pylint: disable=too-many-nested-blocks
            "extra_filters"
        ]:
            filtr["isExtra"] = True
            # Pull out time filters/options and merge into form data
            filter_column = filtr["col"]
            time_extra = date_options.get(filter_column)
            if time_extra:
                time_extra_value = filtr.get("val")
                if time_extra_value and time_extra_value != NO_TIME_RANGE:
                    form_data[time_extra] = time_extra_value
                    applied_time_extras[filter_column] = time_extra_value
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
                                adhoc_filters.append(simple_filter_to_adhoc(filtr))
                        else:
                            adhoc_filters.append(simple_filter_to_adhoc(filtr))
                    else:
                        # Do not add filter if same value already exists
                        if filtr["val"] != existing_filters[filter_key]:
                            adhoc_filters.append(simple_filter_to_adhoc(filtr))
                else:
                    # Filter not found, add it
                    adhoc_filters.append(simple_filter_to_adhoc(filtr))
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


def get_example_default_schema() -> Optional[str]:
    """
    Return the default schema of the examples database, if any.
    """
    database = get_example_database()
    engine = database.get_sqla_engine()
    return inspect(engine).default_schema_name


def backend() -> str:
    return get_example_database().backend


def is_adhoc_metric(metric: Metric) -> TypeGuard[AdhocMetric]:
    return isinstance(metric, dict) and "expressionType" in metric


def is_adhoc_column(column: Column) -> TypeGuard[AdhocColumn]:
    return isinstance(column, dict)


def get_column_name(
    column: Column, verbose_map: Optional[Dict[str, Any]] = None
) -> str:
    """
    Extract label from column

    :param column: object to extract label from
    :param verbose_map: verbose_map from dataset for optional mapping from
                        raw name to verbose name
    :return: String representation of column
    :raises ValueError: if metric object is invalid
    """
    if isinstance(column, dict):
        label = column.get("label")
        if label:
            return label
        expr = column.get("sqlExpression")
        if expr:
            return expr
        raise ValueError("Missing label")
    verbose_map = verbose_map or {}
    return verbose_map.get(column, column)


def get_metric_name(
    metric: Metric, verbose_map: Optional[Dict[str, Any]] = None
) -> str:
    """
    Extract label from metric

    :param metric: object to extract label from
    :param verbose_map: verbose_map from dataset for optional mapping from
                        raw name to verbose name
    :return: String representation of metric
    :raises ValueError: if metric object is invalid
    """
    if is_adhoc_metric(metric):
        label = metric.get("label")
        if label:
            return label
        expression_type = metric.get("expressionType")
        if expression_type == "SQL":
            sql_expression = metric.get("sqlExpression")
            if sql_expression:
                return sql_expression
        elif expression_type == "SIMPLE":
            column: AdhocMetricColumn = metric.get("column") or {}
            column_name = column.get("column_name")
            aggregate = metric.get("aggregate")
            if column and aggregate:
                return f"{aggregate}({column_name})"
            if column_name:
                return column_name
        raise ValueError(__("Invalid metric object"))

    verbose_map = verbose_map or {}
    return verbose_map.get(metric, metric)  # type: ignore


def get_column_names(
    columns: Optional[Sequence[Column]], verbose_map: Optional[Dict[str, Any]] = None,
) -> List[str]:
    return [
        column
        for column in [get_column_name(column, verbose_map) for column in columns or []]
        if column
    ]


def get_metric_names(
    metrics: Optional[Sequence[Metric]], verbose_map: Optional[Dict[str, Any]] = None,
) -> List[str]:
    return [
        metric
        for metric in [get_metric_name(metric, verbose_map) for metric in metrics or []]
        if metric
    ]


def get_first_metric_name(
    metrics: Optional[Sequence[Metric]], verbose_map: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    metric_labels = get_metric_names(metrics, verbose_map)
    return metric_labels[0] if metric_labels else None


def ensure_path_exists(path: str) -> None:
    try:
        os.makedirs(path)
    except OSError as ex:
        if not (os.path.isdir(path) and ex.errno == errno.EEXIST):
            raise


def convert_legacy_filters_into_adhoc(  # pylint: disable=invalid-name
    form_data: FormData,
) -> None:
    mapping = {"having": "having_filters", "where": "filters"}

    if not form_data.get("adhoc_filters"):
        adhoc_filters: List[AdhocFilterClause] = []
        form_data["adhoc_filters"] = adhoc_filters

        for clause, filters in mapping.items():
            if clause in form_data and form_data[clause] != "":
                adhoc_filters.append(form_data_to_adhoc(form_data, clause))

            if filters in form_data:
                for filt in filter(lambda x: x is not None, form_data[filters]):
                    adhoc_filters.append(simple_filter_to_adhoc(filt, clause))

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
    except ValueError as ex:
        raise CertificateException("Invalid certificate") from ex


def create_ssl_cert_file(certificate: str) -> str:
    """
    This creates a certificate file that can be used to validate HTTPS
    sessions. A certificate is only written to disk once; on subsequent calls,
    only the path of the existing certificate is returned.

    :param certificate: The contents of the certificate
    :return: The path to the certificate file
    :raises CertificateException: If certificate is not valid/unparseable
    """
    filename = f"{md5_sha_from_str(certificate)}.crt"
    cert_dir = current_app.config["SSL_CERT_PATH"]
    path = cert_dir if cert_dir else tempfile.gettempdir()
    path = os.path.join(path, filename)
    if not os.path.exists(path):
        # Validate certificate prior to persisting to temporary directory
        parse_ssl_cert(certificate)
        with open(path, "w") as cert_file:
            cert_file.write(certificate)
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


def get_form_data_token(form_data: Dict[str, Any]) -> str:
    """
    Return the token contained within form data or generate a new one.

    :param form_data: chart form data
    :return: original token if predefined, otherwise new uuid4 based token
    """
    return form_data.get("token") or "token_" + uuid.uuid4().hex[:8]


def get_column_name_from_column(column: Column) -> Optional[str]:
    """
    Extract the physical column that a column is referencing. If the column is
    an adhoc column, always returns `None`.

    :param column: Physical and ad-hoc column
    :return: column name if physical column, otherwise None
    """
    if is_adhoc_column(column):
        return None
    return column  # type: ignore


def get_column_names_from_columns(columns: List[Column]) -> List[str]:
    """
    Extract the physical columns that a list of columns are referencing. Ignore
    adhoc columns

    :param columns: Physical and adhoc columns
    :return: column names of all physical columns
    """
    return [col for col in map(get_column_name_from_column, columns) if col]


def get_column_name_from_metric(metric: Metric) -> Optional[str]:
    """
    Extract the column that a metric is referencing. If the metric isn't
    a simple metric, always returns `None`.

    :param metric: Ad-hoc metric
    :return: column name if simple metric, otherwise None
    """
    if is_adhoc_metric(metric):
        metric = cast(AdhocMetric, metric)
        if metric["expressionType"] == AdhocMetricExpressionType.SIMPLE:
            return cast(Dict[str, Any], metric["column"])["column_name"]
    return None


def get_column_names_from_metrics(metrics: List[Metric]) -> List[str]:
    """
    Extract the columns that a list of metrics are referencing. Expcludes all
    SQL metrics.

    :param metrics: Ad-hoc metric
    :return: column name if simple metric, otherwise None
    """
    return [col for col in map(get_column_name_from_metric, metrics) if col]


def extract_dataframe_dtypes(
    df: pd.DataFrame, datasource: Optional["BaseDatasource"] = None,
) -> List[GenericDataType]:
    """Serialize pandas/numpy dtypes to generic types"""

    # omitting string types as those will be the default type
    inferred_type_map: Dict[str, GenericDataType] = {
        "floating": GenericDataType.NUMERIC,
        "integer": GenericDataType.NUMERIC,
        "mixed-integer-float": GenericDataType.NUMERIC,
        "decimal": GenericDataType.NUMERIC,
        "boolean": GenericDataType.BOOLEAN,
        "datetime64": GenericDataType.TEMPORAL,
        "datetime": GenericDataType.TEMPORAL,
        "date": GenericDataType.TEMPORAL,
    }

    columns_by_name = (
        {column.column_name: column for column in datasource.columns}
        if datasource
        else {}
    )
    generic_types: List[GenericDataType] = []
    for column in df.columns:
        column_object = columns_by_name.get(column)
        series = df[column]
        inferred_type = infer_dtype(series)
        generic_type = (
            GenericDataType.TEMPORAL
            if column_object and column_object.is_dttm
            else inferred_type_map.get(inferred_type, GenericDataType.STRING)
        )
        generic_types.append(generic_type)

    return generic_types


def extract_column_dtype(col: "BaseColumn") -> GenericDataType:
    if col.is_temporal:
        return GenericDataType.TEMPORAL
    if col.is_numeric:
        return GenericDataType.NUMERIC
    # TODO: add check for boolean data type when proper support is added
    return GenericDataType.STRING


def indexed(
    items: List[Any], key: Union[str, Callable[[Any], Any]]
) -> Dict[Any, List[Any]]:
    """Build an index for a list of objects"""
    idx: Dict[Any, Any] = {}
    for item in items:
        key_ = getattr(item, key) if isinstance(key, str) else key(item)
        idx.setdefault(key_, []).append(item)
    return idx


def is_test() -> bool:
    return strtobool(os.environ.get("SUPERSET_TESTENV", "false"))


def get_time_filter_status(
    datasource: "BaseDatasource", applied_time_extras: Dict[str, str],
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]]]:
    temporal_columns = {col.column_name for col in datasource.columns if col.is_dttm}
    applied: List[Dict[str, str]] = []
    rejected: List[Dict[str, str]] = []
    time_column = applied_time_extras.get(ExtraFiltersTimeColumnType.TIME_COL)
    if time_column:
        if time_column in temporal_columns:
            applied.append({"column": ExtraFiltersTimeColumnType.TIME_COL})
        else:
            rejected.append(
                {
                    "reason": ExtraFiltersReasonType.COL_NOT_IN_DATASOURCE,
                    "column": ExtraFiltersTimeColumnType.TIME_COL,
                }
            )

    if ExtraFiltersTimeColumnType.TIME_GRAIN in applied_time_extras:
        # are there any temporal columns to assign the time grain to?
        if temporal_columns:
            applied.append({"column": ExtraFiltersTimeColumnType.TIME_GRAIN})
        else:
            rejected.append(
                {
                    "reason": ExtraFiltersReasonType.NO_TEMPORAL_COLUMN,
                    "column": ExtraFiltersTimeColumnType.TIME_GRAIN,
                }
            )

    time_range = applied_time_extras.get(ExtraFiltersTimeColumnType.TIME_RANGE)
    if time_range:
        # are there any temporal columns to assign the time grain to?
        if temporal_columns:
            applied.append({"column": ExtraFiltersTimeColumnType.TIME_RANGE})
        else:
            rejected.append(
                {
                    "reason": ExtraFiltersReasonType.NO_TEMPORAL_COLUMN,
                    "column": ExtraFiltersTimeColumnType.TIME_RANGE,
                }
            )

    if ExtraFiltersTimeColumnType.TIME_ORIGIN in applied_time_extras:
        if datasource.type == "druid":
            applied.append({"column": ExtraFiltersTimeColumnType.TIME_ORIGIN})
        else:
            rejected.append(
                {
                    "reason": ExtraFiltersReasonType.NOT_DRUID_DATASOURCE,
                    "column": ExtraFiltersTimeColumnType.TIME_ORIGIN,
                }
            )

    if ExtraFiltersTimeColumnType.GRANULARITY in applied_time_extras:
        if datasource.type == "druid":
            applied.append({"column": ExtraFiltersTimeColumnType.GRANULARITY})
        else:
            rejected.append(
                {
                    "reason": ExtraFiltersReasonType.NOT_DRUID_DATASOURCE,
                    "column": ExtraFiltersTimeColumnType.GRANULARITY,
                }
            )

    return applied, rejected


def format_list(items: Sequence[str], sep: str = ", ", quote: str = '"') -> str:
    quote_escaped = "\\" + quote
    return sep.join(f"{quote}{x.replace(quote, quote_escaped)}{quote}" for x in items)


def find_duplicates(items: Iterable[InputType]) -> List[InputType]:
    """Find duplicate items in an iterable."""
    return [item for item, count in collections.Counter(items).items() if count > 1]


def remove_duplicates(
    items: Iterable[InputType], key: Optional[Callable[[InputType], Any]] = None
) -> List[InputType]:
    """Remove duplicate items in an iterable."""
    if not key:
        return list(dict.fromkeys(items).keys())
    seen = set()
    result = []
    for item in items:
        item_key = key(item)
        if item_key not in seen:
            seen.add(item_key)
            result.append(item)
    return result


def normalize_dttm_col(
    df: pd.DataFrame,
    timestamp_format: Optional[str],
    offset: int,
    time_shift: Optional[timedelta],
) -> None:
    if DTTM_ALIAS not in df.columns:
        return
    if timestamp_format in ("epoch_s", "epoch_ms"):
        dttm_col = df[DTTM_ALIAS]
        if is_numeric_dtype(dttm_col):
            # Column is formatted as a numeric value
            unit = timestamp_format.replace("epoch_", "")
            df[DTTM_ALIAS] = pd.to_datetime(
                dttm_col, utc=False, unit=unit, origin="unix"
            )
        else:
            # Column has already been formatted as a timestamp.
            df[DTTM_ALIAS] = dttm_col.apply(pd.Timestamp)
    else:
        df[DTTM_ALIAS] = pd.to_datetime(
            df[DTTM_ALIAS], utc=False, format=timestamp_format
        )
    if offset:
        df[DTTM_ALIAS] += timedelta(hours=offset)
    if time_shift is not None:
        df[DTTM_ALIAS] += time_shift


def parse_boolean_string(bool_str: Optional[str]) -> bool:
    """
    Convert a string representation of a true/false value into a boolean

    >>> parse_boolean_string(None)
    False
    >>> parse_boolean_string('false')
    False
    >>> parse_boolean_string('true')
    True
    >>> parse_boolean_string('False')
    False
    >>> parse_boolean_string('True')
    True
    >>> parse_boolean_string('foo')
    False
    >>> parse_boolean_string('0')
    False
    >>> parse_boolean_string('1')
    True

    :param bool_str: string representation of a value that is assumed to be boolean
    :return: parsed boolean value
    """
    if bool_str is None:
        return False
    try:
        return bool(strtobool(bool_str.lower()))
    except ValueError:
        return False


def apply_max_row_limit(limit: int, max_limit: Optional[int] = None,) -> int:
    """
    Override row limit if max global limit is defined

    :param limit: requested row limit
    :param max_limit: Maximum allowed row limit
    :return: Capped row limit

    >>> apply_max_row_limit(100000, 10)
    10
    >>> apply_max_row_limit(10, 100000)
    10
    >>> apply_max_row_limit(0, 10000)
    10000
    """
    if max_limit is None:
        max_limit = current_app.config["SQL_MAX_ROW"]
    if limit != 0:
        return min(max_limit, limit)
    return max_limit


def create_zip(files: Dict[str, Any]) -> BytesIO:
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        for filename, contents in files.items():
            with bundle.open(filename, "w") as fp:
                fp.write(contents)
    buf.seek(0)
    return buf
