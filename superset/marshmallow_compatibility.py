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

Flask-AppBuilder auto-generates schema classes (via
``Model2SchemaConverter._meta_schema_factory``) whose ``Meta.fields`` reference
SQLAlchemy relationship names that are never declared as marshmallow fields.

Marshmallow 3 tolerated this: ``_init_fields`` resolved each name with
``declared_fields.get(name, Inferred())``. Marshmallow 4 made the lookup strict
(``declared_fields[name]``) and raises ``KeyError`` for those names. This patch
restores the lenient behaviour by stubbing the missing FAB names with ``Raw``
fields before ``_init_fields`` runs.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def patch_marshmallow_for_flask_appbuilder() -> None:
    """Apply a compatibility patch to marshmallow for Flask-AppBuilder.

    Wraps ``marshmallow.Schema._init_fields`` so that any name referenced by a
    schema's ``Meta.fields``/``Meta.additional`` that is not backed by a declared
    field is stubbed with a ``Raw`` field. This mirrors marshmallow 3 semantics
    and keeps Flask-AppBuilder's auto-generated schemas working under
    marshmallow 4, where the field lookup became strict.

    The stubbing happens in a single pass per instantiation (no retry loop), so
    it stays cheap even though FAB mints a fresh schema class on every call and
    marshmallow rebuilds ``declared_fields`` for every instance.

    The patch is idempotent and will not apply twice.
    """
    import marshmallow

    if getattr(marshmallow.Schema._init_fields, "_fab_patched", False):
        return  # already patched

    original_init_fields = marshmallow.Schema._init_fields

    def patched_init_fields(self: "marshmallow.Schema") -> Any:
        opts = self.opts
        # ``_init_fields`` iterates Meta.fields (falling back to declared field
        # names) plus Meta.additional, then strictly looks each up in
        # ``declared_fields``. Pre-stub the FAB relationship names it would
        # otherwise choke on; unknown non-FAB names are left to raise so genuine
        # schema bugs still surface.
        candidates = set(opts.fields or ()) | set(getattr(opts, "additional", ()) or ())
        for name in candidates:
            if name not in self.declared_fields and _looks_like_fab_field(name):
                logger.debug(
                    "marshmallow FAB compat: stubbing Raw field for %r on %s",
                    name,
                    type(self).__name__,
                )
                self.declared_fields[name] = marshmallow.fields.Raw()
        return original_init_fields(self)

    patched_init_fields._fab_patched = True  # type: ignore[attr-defined]
    marshmallow.Schema._init_fields = patched_init_fields


def _looks_like_fab_field(name: str) -> bool:
    """Return True if the field name looks like a FAB auto-generated relationship field.

    FAB generates fields like 'related_model', 'parent_id', etc.
    These are typically snake_case and don't start with underscore.
    """
    return bool(name) and not name.startswith("_") and name.replace("_", "").isalnum()
