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
"""Uniqueness contract for subject association tables.

The subject relationship tables must reject duplicate
``(subject_id, <resource>_id)`` rows. Duplicate relationship rows break
removal through the DAO relationship diff, and the subject-era tables enforce
the contract with a two-column unique constraint.

Unlike ``tests/unit_tests/migrations/composite_pk_association_tables_test.py``,
which rebuilds the post-migration shape synthetically, these tests assert
against the *live ORM* ``Table`` objects, so a regression in the model
definitions themselves is caught directly.
"""

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

from superset.subjects.models import (
    chart_editors,
    chart_viewers,
    dashboard_editors,
    dashboard_viewers,
    report_schedule_editors,
    sqlatable_editors,
)

# (association table, resource FK column name)
SUBJECT_TABLES: list[tuple[sa.Table, str]] = [
    (dashboard_editors, "dashboard_id"),
    (dashboard_viewers, "dashboard_id"),
    (chart_editors, "chart_id"),
    (chart_viewers, "chart_id"),
    (sqlatable_editors, "table_id"),
    (report_schedule_editors, "report_schedule_id"),
]

_TABLE_IDS = [table.name for table, _ in SUBJECT_TABLES]


def _create_standalone(table: sa.Table) -> sa.engine.Engine:
    """Create just the association table on in-memory SQLite.

    SQLite does not enforce foreign keys unless explicitly enabled, so the
    real ``Table`` object can be created without its parent tables while its
    primary-key constraint remains fully enforced.
    """
    engine = sa.create_engine("sqlite:///:memory:")
    table.create(engine)
    return engine


@pytest.mark.parametrize("table,resource_col", SUBJECT_TABLES, ids=_TABLE_IDS)
def test_subject_table_declares_pair_uniqueness(
    table: sa.Table, resource_col: str
) -> None:
    """The subject/resource pair uniqueness is declared in model metadata."""
    unique_constraints = [
        {column.name for column in constraint.columns}
        for constraint in table.constraints
        if isinstance(constraint, sa.UniqueConstraint)
    ]
    assert {"subject_id", resource_col} in unique_constraints


@pytest.mark.parametrize("table,resource_col", SUBJECT_TABLES, ids=_TABLE_IDS)
def test_subject_table_rejects_duplicate_row(
    table: sa.Table, resource_col: str
) -> None:
    """Inserting the same (subject, resource) pair twice fails."""
    engine = _create_standalone(table)
    with engine.begin() as conn:
        conn.execute(table.insert().values(subject_id=1, **{resource_col: 1}))
        with pytest.raises(IntegrityError):
            conn.execute(table.insert().values(subject_id=1, **{resource_col: 1}))


@pytest.mark.parametrize("table,resource_col", SUBJECT_TABLES, ids=_TABLE_IDS)
def test_subject_table_accepts_distinct_rows(
    table: sa.Table, resource_col: str
) -> None:
    """Distinct pairs still insert fine — uniqueness is over the pair, not a
    single column: the same subject may edit/view several resources and a
    resource may have several subjects."""
    engine = _create_standalone(table)
    with engine.begin() as conn:
        conn.execute(table.insert().values(subject_id=1, **{resource_col: 1}))
        conn.execute(table.insert().values(subject_id=1, **{resource_col: 2}))
        conn.execute(table.insert().values(subject_id=2, **{resource_col: 1}))
        count = conn.execute(sa.select(sa.func.count()).select_from(table)).scalar_one()
        assert count == 3
