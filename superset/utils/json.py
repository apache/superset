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
import copy
import decimal
import logging
import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Callable, Optional, Union

import numpy as np
import pandas as pd
import simplejson
from flask_babel.speaklater import LazyString
from jsonpath_ng import parse
from simplejson import JSONDecodeError

from superset.constants import PASSWORD_MASK
from superset.utils.dates import datetime_to_epoch, EPOCH

logging.getLogger("MARKDOWN").setLevel(logging.INFO)
logger = logging.getLogger(__name__)


class DashboardEncoder(simplejson.JSONEncoder):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.sort_keys = True

    def default(self, o: Any) -> Union[dict[Any, Any], str]:  # type: ignore
        if isinstance(o, uuid.UUID):
            return str(o)
        try:
            vals = {k: v for k, v in o.__dict__.items() if k != "_sa_instance_state"}
            return {f"__{o.__class__.__name__}__": vals}
        except Exception:  # pylint: disable=broad-except
            if isinstance(o, datetime):
                return {"__datetime__": o.replace(microsecond=0).isoformat()}
            return simplejson.JSONEncoder(sort_keys=True).default(o)


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


def base_json_conv(obj: Any) -> Any:
    """
    Tries to convert additional types to JSON compatible forms.

    :param obj: The serializable object
    :returns: The JSON compatible form
    :raises TypeError: If the object cannot be serialized
    :see: https://docs.python.org/3/library/json.html#encoders-and-decoders
    """

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
            try:
                return obj.decode("utf-16")
            except Exception:  # pylint: disable=broad-except
                return "[bytes]"

    raise TypeError(f"Unserializable object {obj} of type {type(obj)}")


def json_iso_dttm_ser(obj: Any, pessimistic: bool = False) -> Any:
    """
    A JSON serializer that deals with dates by serializing them to ISO 8601.

        >>> json.dumps({'dttm': datetime(1970, 1, 1)}, default=json_iso_dttm_ser)
        '{"dttm": "1970-01-01T00:00:00"}'

    :param obj: The serializable object
    :param pessimistic: Whether to be pessimistic regarding serialization
    :returns: The JSON compatible form
    :raises TypeError: If the non-pessimistic object cannot be serialized
    """

    if isinstance(obj, (datetime, date, pd.Timestamp)):
        return obj.isoformat()

    try:
        return base_json_conv(obj)
    except TypeError:
        if pessimistic:
            logger.error("Failed to serialize %s", obj)
            return f"Unserializable [{type(obj)}]"
        raise


def pessimistic_json_iso_dttm_ser(obj: Any) -> Any:
    """Proxy to call json_iso_dttm_ser in a pessimistic way

    If one of object is not serializable to json, it will still succeed"""
    return json_iso_dttm_ser(obj, pessimistic=True)


def json_int_dttm_ser(obj: Any) -> Any:
    """
    A JSON serializer that deals with dates by serializing them to EPOCH.

        >>> json.dumps({'dttm': datetime(1970, 1, 1)}, default=json_int_dttm_ser)
        '{"dttm": 0.0}'

    :param obj: The serializable object
    :returns: The JSON compatible form
    :raises TypeError: If the object cannot be serialized
    """

    if isinstance(obj, (datetime, pd.Timestamp)):
        return datetime_to_epoch(obj)

    if isinstance(obj, date):
        return (obj - EPOCH.date()).total_seconds() * 1000

    return base_json_conv(obj)


def json_dumps_w_dates(payload: dict[Any, Any], sort_keys: bool = False) -> str:
    """Dumps payload to JSON with Datetime objects properly converted"""
    return dumps(payload, default=json_int_dttm_ser, sort_keys=sort_keys)


def validate_json(obj: Union[bytes, bytearray, str]) -> None:
    """
    A JSON Validator that validates an object of bytes, bytes array or string
    to be in valid JSON format

    :raises SupersetException: if obj is not serializable to JSON
    :param obj: an object that should be parseable to JSON
    """
    if obj:
        try:
            loads(obj)
        except JSONDecodeError as ex:
            logger.error("JSON is not valid %s", str(ex), exc_info=True)
            raise


def dumps(  # pylint: disable=too-many-arguments
    obj: Any,
    default: Optional[Callable[[Any], Any]] = json_iso_dttm_ser,
    allow_nan: bool = False,
    ignore_nan: bool = True,
    sort_keys: bool = False,
    indent: Union[str, int, None] = None,
    separators: Union[tuple[str, str], None] = None,
    cls: Union[type[simplejson.JSONEncoder], None] = None,
) -> str:
    """
    Dumps object to compatible JSON format

    :param obj: The serializable object
    :param default: function that should return a serializable version of obj
    :param allow_nan: when set to True NaN values will be serialized
    :param ignore_nan: when set to True nan values will be ignored
    :param sort_keys: when set to True keys will be sorted
    :param indent: when set elements and object members will be pretty-printed
    :param separators: when specified dumps will use (item_separator, key_separator)
    :param cls: custom `JSONEncoder` subclass
    :returns: String object in the JSON compatible form
    """

    results_string = ""
    try:
        results_string = simplejson.dumps(
            obj,
            default=default,
            allow_nan=allow_nan,
            ignore_nan=ignore_nan,
            sort_keys=sort_keys,
            indent=indent,
            separators=separators,
            cls=cls,
        )
    except UnicodeDecodeError:
        results_string = simplejson.dumps(
            obj,
            default=default,
            allow_nan=allow_nan,
            ignore_nan=ignore_nan,
            sort_keys=sort_keys,
            indent=indent,
            separators=separators,
            cls=cls,
            encoding=None,
        )
    return results_string


def loads(
    obj: Union[bytes, bytearray, str],
    encoding: Union[str, None] = None,
    allow_nan: bool = False,
    object_hook: Union[Callable[[dict[Any, Any]], Any], None] = None,
) -> Any:
    """
    deserializable instance to a Python object.

    :param obj: The deserializable object
    :param encoding: determines the encoding used to interpret the obj
    :param allow_nan: if True it will allow the parser to accept nan values
    :param object_hook: function that will be called to decode objects values
    :returns: A Python object deserialized from string
    """
    return simplejson.loads(
        obj,
        encoding=encoding,
        allow_nan=allow_nan,
        object_hook=object_hook,
    )


def redact_sensitive(
    payload: dict[str, Any],
    sensitive_fields: set[str],
) -> dict[str, Any]:
    """
    Redacts sensitive fields from a payload.

    :param payload: The payload to redact
    :param sensitive_fields: The set of fields to redact, as JSONPath expressions
    :returns: The redacted payload
    """
    redacted_payload = copy.deepcopy(payload)

    for json_path in sensitive_fields:
        jsonpath_expr = parse(json_path)
        for match in jsonpath_expr.find(redacted_payload):
            match.context.value[match.path.fields[0]] = PASSWORD_MASK

    return redacted_payload


def reveal_sensitive(
    old_payload: dict[str, Any],
    new_payload: dict[str, Any],
    sensitive_fields: set[str],
) -> dict[str, Any]:
    """
    Reveals sensitive fields from a payload when not modified.

    This allows users to perform deep edits on a payload without having to provide
    sensitive information. The old payload is sent to the user with any sensitive fields
    masked, and when the user sends back a modified payload, any fields that were masked
    are replaced with the original values from the old payload.

    For now this is only used to edit `encrypted_extra` fields in the database.

    :param old_payload: The old payload to reveal
    :param new_payload: The new payload to reveal
    :param sensitive_fields: The set of fields to reveal, as JSONPath expressions
    :returns: The revealed payload
    """
    revealed_payload = copy.deepcopy(new_payload)

    for json_path in sensitive_fields:
        jsonpath_expr = parse(json_path)
        for match in jsonpath_expr.find(revealed_payload):
            if match.value == PASSWORD_MASK:
                old_value = match.full_path.find(old_payload)
                match.context.value[match.path.fields[0]] = old_value[0].value

    return revealed_payload
