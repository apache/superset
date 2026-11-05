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
import math
import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Callable, Dict, Optional, Union

import jwt
import numpy as np
import pandas as pd
import simplejson
from flask_babel.speaklater import LazyString
from jsonpath_ng import parse
from jsonpath_ng.jsonpath import Child, Fields, Root
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


def base_json_conv(obj: Any) -> Any:  # noqa: C901
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
    if isinstance(obj, pd.DateOffset):
        offset_attrs = ", ".join(f"{k}={v}" for k, v in obj.kwds.items())
        return f"DateOffset({offset_attrs})"
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
    encoding: Optional[str] = "utf-8",
    ensure_ascii: bool = True,
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
    :param ensure_ascii: when set to False non-ASCII characters are kept verbatim
        instead of being escaped to ``\\uXXXX`` sequences. Defaults to True so the
        escaped output stays safe for narrow charset columns (e.g. MySQL ``utf8``).
    :returns: String object in the JSON compatible form
    """

    results_string = ""
    dumps_kwargs: Dict[str, Any] = {
        "default": default,
        "allow_nan": allow_nan,
        "ignore_nan": ignore_nan,
        "sort_keys": sort_keys,
        "indent": indent,
        "separators": separators,
        "cls": cls,
        "encoding": encoding,
        "ensure_ascii": ensure_ascii,
    }
    try:
        results_string = simplejson.dumps(obj, **dumps_kwargs)
    except UnicodeDecodeError:
        dumps_kwargs["encoding"] = None
        results_string = simplejson.dumps(obj, **dumps_kwargs)
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
            # An empty value has nothing to hide. Masking it would tell the admin a
            # secret is stored when none is, and send back a mask paired with,
            # say, a cleared username -- which then reads as half-filled.
            if match.value in (None, ""):
                continue
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
                # a masked value can arrive for a path the stored payload never
                # had, e.g. a payload copied from another connection. There is
                # nothing to reveal, so the mask is passed through, which is
                # what engine specs that do not list the path already do.
                if old_value := match.full_path.find(old_payload):
                    match.context.value[match.path.fields[0]] = old_value[0].value

    return revealed_payload


def _render_jsonpath(node: Any) -> str:
    """
    Render a JSONPath node as a stable dotted string (e.g. ``foo.bar``).

    ``str()`` of a jsonpath-ng path is not stable across releases: as of
    jsonpath-ng 1.8.0 a ``Child`` node renders with surrounding parentheses
    (e.g. ``(foo.bar)``). This helper produces the historic dotted notation so
    that the strings returned by :func:`get_masked_fields` remain consistent and
    can be round-tripped back through ``parse``.

    Falls back to ``str()`` for node kinds that aren't plain field access (e.g.
    array indices, slices), preserving their existing representation.
    """
    if isinstance(node, Child):
        left = _render_jsonpath(node.left)
        right = _render_jsonpath(node.right)
        return f"{left}.{right}" if left else right
    if isinstance(node, Fields):
        return ".".join(node.fields)
    if isinstance(node, Root):
        return ""
    return str(node)


def get_masked_fields(
    payload: dict[str, Any],
    sensitive_fields: set[str],
) -> list[str]:
    """
    Returns masked fields in JSON config.

    :param payload: The payload to check
    :param sensitive_fields: The set of fields to check, as JSONPath expressions
    :returns: List of JSONPath expressions for fields that are masked
    """
    masked = []
    for json_path in sensitive_fields:
        jsonpath_expr = parse(json_path)
        for match in jsonpath_expr.find(payload):
            if match.value == PASSWORD_MASK:
                # Using `match.full_path` instead of json_path to account
                # for wildcards. Render the path explicitly so the output is
                # stable across jsonpath-ng versions (newer releases wrap
                # `Child` paths in parentheses when stringified).
                masked.append(f"$.{_render_jsonpath(match.full_path)}")
    return masked


def unrevealable_masked_fields(
    old_payload: dict[str, Any] | None,
    new_payload: dict[str, Any],
    sensitive_fields: set[str],
) -> list[str]:
    """
    Returns masked fields in ``new_payload`` that ``old_payload`` cannot reveal.

    :func:`reveal_sensitive` swaps a mask back for the stored value at the same
    path. Where the stored payload has no value there, the mask would be kept and
    stored as if it were the secret, so callers that must not do that (imports
    overwriting a connection) use this to ask for the real value instead. A
    stored mask counts as no value: earlier releases saved one when an import
    had nothing to reveal, and revealing it only hands the mask back. A stored
    ``None`` or empty string does count: earlier releases masked those too, so an
    export can carry a mask for an optional secret that was never set, and
    revealing restores it.

    :param old_payload: The stored payload, if any
    :param new_payload: The incoming payload, possibly containing masks
    :param sensitive_fields: The set of fields to check, as JSONPath expressions
    :returns: JSONPath expressions for masked fields with nothing to reveal
    """
    return [
        field
        for field in get_masked_fields(new_payload, sensitive_fields)
        if old_payload is None
        or not any(
            match.value != PASSWORD_MASK for match in parse(field).find(old_payload)
        )
    ]


# A single PEM block, possibly wrapped in newline escapes left over from JSON.
_PEM_BLOCK = re.compile(
    r"(?:\\[rn])*-----BEGIN ([A-Z]+(?: [A-Z]+)*)-----(.+)-----END \1-----(?:\\[rn])*",
    re.DOTALL,
)
_PEM_LINE_BREAKS = re.compile(r"\s|\\[rn]")


def _pem_body(value: str) -> str | None:
    """
    Return the base64 body of a PEM block without line breaks or padding, or ``None``.

    Every PEM value ends with the same ``-----END <label>-----`` footer, so only
    the body tells two keys apart. The trailing ``=`` padding carries nothing either.
    """
    if match := _PEM_BLOCK.fullmatch(value):
        return _PEM_LINE_BREAKS.sub("", match.group(2)).rstrip("=")
    return None


_BASE64URL = re.compile(r"[A-Za-z0-9_-]*")
# 9999-12-31T23:59:59Z, the last second a datetime can hold.
_MAX_EXP = 253_402_300_799


def jwt_expiry(value: str) -> tuple[datetime | None, bool | None]:
    """
    Return when a JWT expires, from its ``exp`` claim, and whether it has.

    Payload-only and unverified: PyJWT decodes the token without checking the
    signature or any claim, and no claim but ``exp`` is read. The header and the
    payload must be JSON objects; ``exp`` may be any finite number in range.
    Anything else gives ``(None, None)``. This never raises.
    """
    if not isinstance(value, str):
        return None, None
    parts = value.split(".")
    if len(parts) != 3 or not parts[0] or not parts[1]:
        return None, None
    # PyJWT's base64 decoding skips characters outside the alphabet; refuse them.
    if not all(_BASE64URL.fullmatch(part) for part in parts):
        return None, None
    try:
        claims = jwt.decode(
            value,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_nbf": False,
                "verify_iat": False,
            },
        )
        exp = claims.get("exp")
        if isinstance(exp, bool) or not isinstance(exp, (int, float)):
            return None, None
        if isinstance(exp, float) and not math.isfinite(exp):
            return None, None
        if not 0 <= exp <= _MAX_EXP:
            return None, None
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
    except (
        jwt.PyJWTError,
        ValueError,
        TypeError,
        OverflowError,
        OSError,
        RecursionError,
    ):
        return None, None
    return expires_at, expires_at <= datetime.now(tz=timezone.utc)


def _sensitive_string_values(
    payload: dict[str, Any],
    sensitive_fields: set[str],
) -> dict[str, str]:
    """
    Map each concrete path whose value is a string to that value, sorted by path.
    """
    if not isinstance(payload, dict):
        return {}

    values: dict[str, str] = {}
    for json_path in sensitive_fields:
        for match in parse(json_path).find(payload):
            if isinstance(match.value, str):
                values[f"$.{_render_jsonpath(match.full_path)}"] = match.value
    return dict(sorted(values.items()))


def get_sensitive_field_paths(
    payload: dict[str, Any],
    sensitive_fields: set[str],
) -> list[str]:
    """
    Returns the concrete paths of the string values found at sensitive paths.

    Wildcards expand per match and non-string values are skipped, so the result
    lists exactly the fields :func:`get_sensitive_field_hints` would hint.

    :param payload: The payload to inspect; anything but a dict yields no paths
    :param sensitive_fields: The set of fields to look for, as JSONPath expressions
    :returns: JSONPath expressions sorted by path
    """
    return list(_sensitive_string_values(payload, sensitive_fields))


def get_sensitive_field_expirations(
    payload: dict[str, Any],
    sensitive_fields: set[str],
) -> dict[str, dict[str, Any]]:
    """
    Returns when each JWT found at a sensitive path expires, by concrete path.

    Only values for which :func:`jwt_expiry` finds an ``exp`` are listed, as
    ``{"expires_at": <ISO 8601 UTC>, "expired": <bool>}``, sorted by path.

    :param payload: The payload to inspect; anything but a dict yields nothing
    :param sensitive_fields: The set of fields to look for, as JSONPath expressions
    :returns: The expiry of each JWT, by path
    """
    expirations: dict[str, dict[str, Any]] = {}
    for path, stored in _sensitive_string_values(payload, sensitive_fields).items():
        expires_at, expired = jwt_expiry(stored.strip())
        if expires_at is not None:
            expirations[path] = {
                "expires_at": expires_at.isoformat(),
                "expired": expired,
            }
    return expirations


def get_sensitive_field_hints(
    payload: dict[str, Any],
    sensitive_fields: set[str],
    length: int,
) -> list[dict[str, Any]]:
    """
    Returns a hint for each string value found at a sensitive path.

    A hint holds the path and, when the trimmed value is at least ``4 * length``
    characters long, its last ``length`` characters. That caps what is revealed at
    25% of the value; a shorter value gets no suffix and its length is not reported
    either, since a length alone can identify a short secret. For a PEM block, the
    suffix and the cap apply to its base64 body without padding. A JWT also gets
    ``expires_at`` and ``expired`` from :func:`jwt_expiry`; other values get
    ``None`` for both.

    :param payload: The payload to inspect
    :param sensitive_fields: The set of fields to hint, as JSONPath expressions
    :param length: The number of trailing characters to reveal; ``<= 0`` disables hints
    :returns: Hints sorted by path, as
        ``{"path", "suffix", "expires_at", "expired"}`` dicts
    """
    if length <= 0:
        return []

    hints: list[dict[str, Any]] = []
    for path, stored in _sensitive_string_values(payload, sensitive_fields).items():
        value = stored.strip()
        body = _pem_body(value)
        revealable = value if body is None else body
        expires_at, expired = jwt_expiry(value)
        hints.append(
            {
                "path": path,
                "suffix": (
                    revealable[-length:] if len(revealable) >= 4 * length else None
                ),
                "expires_at": expires_at,
                "expired": expired,
            }
        )
    return hints


def set_masked_fields(
    payload: dict[str, Any],
    path_values: dict[str, Any],
) -> dict[str, Any]:
    """
    Sets values at JSONPath locations in a payload.

    :param payload: The payload to modify
    :param path_values: A dict mapping JSONPath expressions to values
    :returns: The modified payload (copy)
    """
    result = copy.deepcopy(payload)

    for json_path, value in path_values.items():
        jsonpath_expr = parse(json_path)
        for match in jsonpath_expr.find(result):
            match.context.value[match.path.fields[0]] = value

    return result
