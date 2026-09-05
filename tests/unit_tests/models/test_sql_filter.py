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
"""SqlFilter must mirror SqlMetric's relationship and cascade shape."""

from __future__ import annotations

from sqlalchemy.orm import RelationshipProperty

from superset.connectors.sqla.models import SqlaTable, SqlFilter, SqlMetric


def _cascade(rel: RelationshipProperty) -> set[str]:
    return set(rel.cascade)


def test_sql_filter_relationship_mirrors_sql_metric() -> None:
    metric_rel = SqlaTable.metrics.property
    filter_rel = SqlaTable.filters.property

    assert isinstance(metric_rel, RelationshipProperty)
    assert isinstance(filter_rel, RelationshipProperty)
    assert _cascade(filter_rel) == _cascade(metric_rel)
    assert filter_rel.passive_deletes is metric_rel.passive_deletes
    assert filter_rel.back_populates == "table"
    assert SqlFilter.table.property.back_populates == "filters"
    assert SqlMetric.table.property.back_populates == "metrics"
    assert SqlaTable.filter_class is SqlFilter
    assert SqlaTable.metric_class is SqlMetric
    assert "filters" in SqlaTable.export_children


def test_sql_filter_unique_constraint_mirrors_sql_metric() -> None:
    metric_cols = {
        tuple(col.name for col in constraint.columns)
        for constraint in SqlMetric.__table__.constraints
        if constraint.columns and "metric_name" in constraint.columns
    }
    filter_cols = {
        tuple(col.name for col in constraint.columns)
        for constraint in SqlFilter.__table__.constraints
        if constraint.columns and "filter_name" in constraint.columns
    }
    assert ("table_id", "metric_name") in metric_cols
    assert ("table_id", "filter_name") in filter_cols


def test_sql_filter_fk_cascades_like_sql_metric() -> None:
    metric_fk = next(
        fk for fk in SqlMetric.__table__.foreign_keys if fk.parent.name == "table_id"
    )
    filter_fk = next(
        fk for fk in SqlFilter.__table__.foreign_keys if fk.parent.name == "table_id"
    )
    assert metric_fk.ondelete == "CASCADE"
    assert filter_fk.ondelete == metric_fk.ondelete
