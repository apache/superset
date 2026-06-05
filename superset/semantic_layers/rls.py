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
RLS helpers used by the dataset semantic-view path.

The legacy ``get_sqla_query`` applies row-level security in two places:

* The dataset's own RLS rules are AND-ed into the outer ``WHERE`` (or
  the source table is wrapped in a subquery when the engine spec
  returns ``RLSMethod.AS_SUBQUERY``).
* For virtual datasets, RLS rules from the *underlying* tables
  referenced by ``dataset.sql`` are injected via
  :func:`superset.utils.rls.apply_rls`.

This module exposes both flows as pure functions returning SQL strings,
which the ``DatasetSemanticView`` plugs into its sqlglot AST.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from superset.sql.parse import RLSMethod, SQLScript
from superset.utils.rls import apply_rls

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable

logger = logging.getLogger(__name__)


def get_rls_method(dataset: "SqlaTable") -> RLSMethod:
    """Return the engine's preferred RLS injection method."""
    return dataset.database.db_engine_spec.get_rls_method()


def render_rls_predicates(dataset: "SqlaTable") -> list[str]:
    """
    Render the dataset's outer RLS predicates as SQL strings.

    The clauses are already Jinja-rendered by
    :meth:`SqlaTable.get_sqla_row_level_filters`; we then compile them
    against the database's dialect with ``literal_binds=True`` so the
    resulting strings are safe to splice into a sqlglot AST.

    Returns an empty list when the dataset has no applicable RLS rules
    for the current user.
    """
    text_clauses = dataset.get_sqla_row_level_filters()
    if not text_clauses:
        return []
    dialect = dataset.database.get_dialect()
    return [
        str(clause.compile(dialect=dialect, compile_kwargs={"literal_binds": True}))
        for clause in text_clauses
    ]


def apply_rls_to_virtual_sql(dataset: "SqlaTable") -> str | None:
    """
    Rewrite a virtual dataset's inner SQL to enforce RLS on the
    underlying tables it references.

    Returns the rewritten SQL string when RLS predicates were injected,
    or ``None`` when no rules applied (caller should use the original
    ``dataset.sql`` in that case). Returns ``None`` for physical
    datasets too.
    """
    if not dataset.sql:
        return None

    engine = dataset.database.db_engine_spec.engine
    try:
        parsed_script = SQLScript(dataset.sql, engine=engine)
    except Exception:  # pylint: disable=broad-except
        # Mirror the legacy behavior — failure to parse should not block
        # the query; the caller will fall back to the original SQL and
        # RLS will simply not be applied to inner tables.
        logger.warning(
            "Failed to parse virtual dataset SQL for RLS application",
            exc_info=True,
        )
        return None

    default_schema = dataset.database.get_default_schema(dataset.catalog)
    rls_applied = False
    try:
        for statement in parsed_script.statements:
            if apply_rls(
                dataset.database,
                dataset.catalog,
                dataset.schema or default_schema or "",
                statement,
                exclude_dataset_id=dataset.id,
            ):
                rls_applied = True
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Failed to apply RLS to virtual dataset inner SQL",
            exc_info=True,
        )
        return None

    return parsed_script.format() if rls_applied else None
