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
"""Drift guard for the version-snapshot projection.

``queries.get_version`` projects an entity's historical state by copying
*every* shadow column except Continuum's three bookkeeping columns — a
denylist, not an allowlist. That is safe today (nothing sensitive on the
versioned models survives ``__versioned__['exclude']``), but a future
sensitive column added to a versioned model would be exposed through the
read-only ``/versions/`` endpoint by default unless someone remembers to
exclude it. This test fails when such a column appears, forcing the
exclusion decision to be made consciously.
"""

from __future__ import annotations

from sqlalchemy_continuum import version_class

from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.versioning.baseline.shadow import CONTINUUM_BOOKKEEPING_COLUMNS
from tests.integration_tests.base_tests import SupersetTestCase

# Substrings that mark a column as something a version snapshot must never
# echo back. Matched case-insensitively against the projected column names.
_SENSITIVE_SUBSTRINGS = (
    "password",
    "secret",
    "encrypted",
    "private_key",
    "api_key",
    "access_token",
)


class TestSnapshotProjectionSafety(SupersetTestCase):
    def test_version_snapshot_exposes_no_sensitive_columns(self) -> None:
        """The columns ``get_version`` would project for each versioned model
        must contain no sensitive-looking column name."""
        for model_cls in (Slice, Dashboard, SqlaTable):
            ver_tbl = version_class(model_cls).__table__
            projected = [
                col.name
                for col in ver_tbl.columns
                if col.name not in CONTINUUM_BOOKKEEPING_COLUMNS
            ]
            for name in projected:
                lowered = name.lower()
                offending = [s for s in _SENSITIVE_SUBSTRINGS if s in lowered]
                assert not offending, (
                    f"{model_cls.__name__} version snapshot would expose "
                    f"sensitive-looking column '{name}'. Add it to the model's "
                    f"__versioned__['exclude'] set, or confirm it is safe and "
                    f"relax this guard."
                )
