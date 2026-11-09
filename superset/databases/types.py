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

# Field has been moved outside of the schemas.py file to
# allow for it to be imported from outside of app_context
from typing import Any

from marshmallow import fields


class EncryptedField:  # pylint: disable=too-few-public-methods
    """
    A database field that should be stored in encrypted_extra.
    """


class EncryptedString(EncryptedField, fields.String):
    pass


class EncryptedDict(EncryptedField, fields.Dict):
    pass


def encrypted_field_properties(self, field: Any, **_) -> dict[str, Any]:  # type: ignore
    """
    Tag an ``EncryptedField`` parameter with ``x-encrypted-extra``.

    Registered on a ``MarshmallowPlugin``'s converter when building a DB engine
    spec's ``parameters_json_schema``. The tag is the signal the connection
    dialog uses both to render the field and to move its value into
    ``masked_encrypted_extra`` rather than posting it as a plain parameter.

    Lives here rather than in ``schemas.py`` so that
    ``superset.db_engine_specs.base`` can import it: ``schemas.py`` imports
    ``get_engine_spec`` from the ``db_engine_specs`` package, which would make
    that a circular import.
    """
    ret = {}
    if isinstance(field, EncryptedField):
        if self.openapi_version.major > 2:
            ret["x-encrypted-extra"] = True
    return ret
