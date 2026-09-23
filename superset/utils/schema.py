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
from typing import Any, Optional, Union
from urllib.parse import urlparse

from marshmallow import fields, pre_load, Schema, validate, ValidationError

from superset.utils import json
from superset.utils.core import DatasourceType

ALLOWED_URL_SCHEMES = frozenset({"http", "https"})


class OneOfCaseInsensitive(validate.OneOf):
    """
    Marshmallow validator that's based on the built-in `OneOf`, but performs
    validation case insensitively.
    """

    def __call__(self, value: Any) -> str:
        try:
            if (value.lower() if isinstance(value, str) else value) not in [
                choice.lower() if isinstance(choice, str) else choice
                for choice in self.choices
            ]:
                raise ValidationError(self._format_error(value))
        except TypeError as error:
            raise ValidationError(self._format_error(value)) from error

        return value


def validate_json(value: Union[bytes, bytearray, str]) -> None:
    """
    JSON Validator that can be passed to a Marshmallow `Field`'s validate argument.

    :raises ValidationError: if value is not serializable to JSON
    :param value: an object that should be parseable to JSON
    """
    try:
        json.validate_json(value)
    except json.JSONDecodeError as ex:
        raise ValidationError("JSON not valid") from ex


def is_query_context_metadata_complete(value: Any) -> bool:
    """
    Whether a parsed ``query_context`` payload carries the ``datasource`` and
    ``queries`` keys ``QueryContextFactory.create()`` requires (apache/superset
    #35774): both are required keyword-only arguments there, and a chart saved
    without them fails every subsequent read with a raw ``TypeError`` instead
    of a clear error at save time. ``datasource`` must be a mapping carrying
    the ``id``/``type`` keys ``DatasourceDict`` requires -- ``_convert_to_model``
    indexes both directly and raises ``KeyError`` if either is absent, and
    passes ``type`` straight to ``DatasourceType(...)``, which raises
    ``ValueError`` for a value outside that enum -- but ``queries`` may
    legitimately be an empty list (a chart with no query objects yet still
    round-trips through ``create()`` without error), so only its presence as
    a list is checked, not its truthiness.

    :param value: the object obtained by JSON-decoding a query_context string
    """
    if not isinstance(value, dict) or not isinstance(value.get("queries"), list):
        return False
    datasource = value.get("datasource")
    if not isinstance(datasource, dict) or not datasource.get("id"):
        return False
    datasource_type = datasource.get("type")
    if not isinstance(datasource_type, str):
        return False
    try:
        DatasourceType(datasource_type)
    except ValueError:
        return False
    return True


def validate_query_context_metadata(value: Union[bytes, bytearray, str]) -> None:
    """
    Validator for a chart's ``query_context`` field: beyond being well-formed
    JSON (see ``validate_json``), it must be a JSON object carrying a
    non-empty ``datasource`` key and a ``queries`` key that is a list
    (apache/superset#35774).

    :raises ValidationError: if value is not valid JSON, or is valid JSON that
        is not an object with a non-empty ``datasource`` key and a ``queries``
        key holding a list
    :param value: an object that should be parseable to a query_context JSON object
    """
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as ex:
        raise ValidationError("JSON not valid") from ex
    if not is_query_context_metadata_complete(parsed):
        raise ValidationError(
            "query_context must be a JSON object with a non-empty "
            "'datasource' key and a 'queries' key holding a list"
        )


def validate_external_url(value: Optional[str]) -> None:
    """
    Validator for externally managed object URLs.

    Restricts the accepted URL schemes to ``http`` and ``https`` so that
    other schemes (for example ``javascript:``, ``data:`` or ``vbscript:``)
    cannot be stored and later rendered by clients. The URL must also be
    absolute (include a network location/host) so that malformed values such
    as ``https:foo`` are rejected. Empty values are allowed since the field is
    optional.

    :param value: the URL to validate
    :raises ValidationError: if the value uses a disallowed scheme or is not
        an absolute URL
    """
    if not value:
        return

    parsed = urlparse(value)
    scheme = parsed.scheme.lower()
    if scheme not in ALLOWED_URL_SCHEMES:
        raise ValidationError(
            "URL must use one of the following schemes: "
            f"{', '.join(sorted(ALLOWED_URL_SCHEMES))}."
        )
    if not parsed.netloc:
        raise ValidationError("URL must be absolute and include a host.")


class DiscardIsManagedExternallyMixin(Schema):
    """Accept and discard ``is_managed_externally`` for wire compatibility.

    The flag is not client-writable: the managed-externally update gate
    refuses edits of flagged entities, so a client-set ``True`` would be
    irreversible via the API. Older clients echo GET payloads back on
    PUT, and the PUT schemas raise on unknown fields, so the key is
    dropped here rather than removed from the accepted payload. Shared by
    the chart, dashboard, and dataset PUT schemas so the discard
    semantics cannot drift between entities.
    """

    # pylint: disable=unused-argument
    @pre_load
    def _discard_is_managed_externally(
        self, data: dict[str, Any], **kwargs: Any
    ) -> dict[str, Any]:
        if isinstance(data, dict):
            data.pop("is_managed_externally", None)
        return data

    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
