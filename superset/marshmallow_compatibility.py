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

"""
Marshmallow 4.x compatibility patch for Flask-AppBuilder.

Flask-AppBuilder auto-generates schema fields from SQLAlchemy relationships.
In marshmallow 4.x, _init_fields is stricter and raises KeyError for
FAB-generated field references that don't map to declared fields.
This patch intercepts those specific KeyErrors and creates Raw field stubs.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def patch_marshmallow_for_flask_appbuilder() -> None:
    """Apply a compatibility patch to marshmallow for Flask-AppBuilder.

    This patch handles KeyErrors raised by marshmallow 4.x's stricter
    _init_fields method when FAB auto-generates schema fields from
    SQLAlchemy relationships that don't map to declared marshmallow fields.

    The patch is idempotent and will not apply twice.
    """
    import marshmallow

    if getattr(marshmallow.Schema._init_fields, "_fab_patched", False):
        return  # already patched

    original_init_fields = marshmallow.Schema._init_fields

    def patched_init_fields(self: "marshmallow.Schema") -> Any:
        max_retries = 10
        retries = 0
        while retries < max_retries:
            try:
                return original_init_fields(self)
            except KeyError as exc:
                missing_field = str(exc).strip("'\"")
                # Only auto-create fields for FAB-generated relationship names,
                # not for arbitrary KeyErrors that indicate real schema bugs.
                if not missing_field or not _looks_like_fab_field(missing_field):
                    raise
                logger.debug(
                    "marshmallow FAB compat: auto-creating Raw field for %r on %s",
                    missing_field,
                    type(self).__name__,
                )
                self.declared_fields[missing_field] = marshmallow.fields.Raw()
                retries += 1
        logger.warning(
            "marshmallow FAB compat: exceeded retry limit on %s; "
            "schema initialization may be incomplete",
            type(self).__name__,
        )
        return original_init_fields(self)

    patched_init_fields._fab_patched = True  # type: ignore[attr-defined]
    marshmallow.Schema._init_fields = patched_init_fields


def _looks_like_fab_field(name: str) -> bool:
    """Return True if the field name looks like a FAB auto-generated relationship field.

    FAB generates fields like 'related_model', 'parent_id', etc.
    These are typically snake_case and don't start with underscore.
    """
    return bool(name) and not name.startswith("_") and name.replace("_", "").isalnum()
