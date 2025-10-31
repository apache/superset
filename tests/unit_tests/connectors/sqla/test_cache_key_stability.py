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
Tests for SQL expression processing during QueryObject validation.

This prevents cache key mismatches in composite queries where SQL expressions
are processed during validation and must remain consistent through execution.
"""

from typing import Any
from unittest.mock import Mock

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable


def test_sql_expressions_processed_during_validation():
    """
    Test that SQL expressions are processed during QueryObject validation.

    This is a regression test for a bug where:
    1. A chart has a metric with sqlExpression: "sum(field)" (lowercase)
    2. The same metric is used in both metrics and orderby
    3. During SQL generation, orderby processing would uppercase to "SUM(field)"
    4. This mutation caused cache key mismatches in composite queries

    The fix ensures SQL expressions are processed during validate() so:
    - Cache key uses processed expressions
    - Query execution uses same processed expressions
    - No mutation occurs during query generation
    """
    # Create an adhoc metric with lowercase SQL - this is how users write them
    adhoc_metric = {
        "expressionType": "SQL",
        "sqlExpression": "sum(num)",  # lowercase - will be uppercased
        "label": "Sum of Num",
    }

    # Mock datasource with required methods
    mock_datasource = Mock(spec=SqlaTable)
    mock_datasource.database_id = 1
    mock_datasource.schema = "public"

    # Simulate sanitize_clause behavior: uppercase SQL
    def process_expression(expression: str, **kwargs: Any) -> str:
        return expression.upper()

    mock_datasource._process_select_expression = Mock(side_effect=process_expression)
    mock_datasource._process_orderby_expression = Mock(side_effect=process_expression)

    # Create QueryObject with adhoc metric in both metrics and orderby
    query_obj = QueryObject(
        datasource=mock_datasource,
        metrics=[adhoc_metric],
        orderby=[(adhoc_metric, True)],
        columns=[],
        extras={},
    )

    # Validate - this should process SQL expressions
    query_obj.validate()

    # After validation, SQL expressions should be processed (uppercased)
    assert query_obj.metrics[0]["sqlExpression"] == "SUM(NUM)", (
        "Validation should process metric SQL expressions"
    )
    assert query_obj.orderby[0][0]["sqlExpression"] == "SUM(NUM)", (
        "Validation should process orderby SQL expressions"
    )


def test_validation_does_not_mutate_original_dicts():
    """
    Test that validation creates new dicts instead of mutating the originals.

    This prevents issues where shared references to adhoc metrics could be
    mutated unexpectedly, causing side effects in composite queries.
    """
    # Create original adhoc metric
    original_metric = {
        "expressionType": "SQL",
        "sqlExpression": "sum(sales)",
        "label": "Total Sales",
    }

    # Keep a reference to verify no mutation
    original_sql = original_metric["sqlExpression"]

    # Mock datasource
    mock_datasource = Mock(spec=SqlaTable)
    mock_datasource.database_id = 1
    mock_datasource.schema = "public"

    def process_expression(expression: str, **kwargs: Any) -> str:
        return expression.upper()

    mock_datasource._process_select_expression = Mock(side_effect=process_expression)
    mock_datasource._process_orderby_expression = Mock(side_effect=process_expression)

    # Create QueryObject
    query_obj = QueryObject(
        datasource=mock_datasource,
        metrics=[original_metric],
        orderby=[(original_metric, True)],
        columns=[],
        extras={},
    )

    # Validate
    query_obj.validate()

    # Verify: original dict should NOT be mutated
    assert original_metric["sqlExpression"] == original_sql, (
        "Original metric dict should not be mutated during validation"
    )

    # Verify: QueryObject has processed expressions in NEW dicts
    assert query_obj.metrics[0]["sqlExpression"] == "SUM(SALES)"
    assert query_obj.orderby[0][0]["sqlExpression"] == "SUM(SALES)"


def test_validation_with_multiple_adhoc_metrics():
    """
    Test validation with multiple adhoc metrics in metrics and orderby.
    """
    metric1 = {
        "expressionType": "SQL",
        "sqlExpression": "sum(sales)",
        "label": "Total Sales",
    }
    metric2 = {
        "expressionType": "SQL",
        "sqlExpression": "avg(price)",
        "label": "Average Price",
    }

    # Mock datasource
    mock_datasource = Mock(spec=SqlaTable)
    mock_datasource.database_id = 1
    mock_datasource.schema = "public"

    def process_expression(expression: str, **kwargs: Any) -> str:
        return expression.upper()

    mock_datasource._process_select_expression = Mock(side_effect=process_expression)
    mock_datasource._process_orderby_expression = Mock(side_effect=process_expression)

    # Create QueryObject with multiple metrics
    query_obj = QueryObject(
        datasource=mock_datasource,
        metrics=[metric1, metric2],
        orderby=[(metric1, False), (metric2, True)],
        columns=[],
        extras={},
    )

    # Validate
    query_obj.validate()

    # Verify original dicts not mutated
    assert metric1["sqlExpression"] == "sum(sales)"
    assert metric2["sqlExpression"] == "avg(price)"

    # Verify QueryObject has processed expressions
    assert query_obj.metrics[0]["sqlExpression"] == "SUM(SALES)"
    assert query_obj.metrics[1]["sqlExpression"] == "AVG(PRICE)"
    assert query_obj.orderby[0][0]["sqlExpression"] == "SUM(SALES)"
    assert query_obj.orderby[1][0]["sqlExpression"] == "AVG(PRICE)"


def test_validation_preserves_jinja_templates():
    """
    Test that Jinja templates are preserved during validation.

    Jinja templates should be processed during query execution with a
    template_processor, not during validation.
    """
    metric_with_jinja = {
        "expressionType": "SQL",
        "sqlExpression": "sum({{ column_name }})",
        "label": "Dynamic Sum",
    }

    # Mock datasource
    mock_datasource = Mock(spec=SqlaTable)
    mock_datasource.database_id = 1
    mock_datasource.schema = "public"

    def process_expression(expression: str, **kwargs: Any) -> str:
        # During validation, template_processor=None, so Jinja is not processed
        # Only SQL keywords are uppercased
        return expression.upper()

    mock_datasource._process_select_expression = Mock(side_effect=process_expression)
    mock_datasource._process_orderby_expression = Mock(side_effect=process_expression)

    # Create QueryObject
    query_obj = QueryObject(
        datasource=mock_datasource,
        metrics=[metric_with_jinja],
        orderby=[(metric_with_jinja, True)],
        columns=[],
        extras={},
    )

    # Validate
    query_obj.validate()

    # Jinja template should remain in processed expression
    assert "{{" in query_obj.metrics[0]["sqlExpression"]
    assert "}}" in query_obj.metrics[0]["sqlExpression"]


def test_validation_without_processing_methods():
    """
    Test that validation doesn't crash when datasource lacks processing methods.
    """
    adhoc_metric = {
        "expressionType": "SQL",
        "sqlExpression": "sum(num)",
        "label": "Sum",
    }

    # Mock datasource WITHOUT _process_* methods
    mock_datasource = Mock(spec=SqlaTable)
    mock_datasource.database_id = 1
    mock_datasource.schema = "public"

    # Remove the processing methods
    if hasattr(mock_datasource, "_process_select_expression"):
        delattr(mock_datasource, "_process_select_expression")
    if hasattr(mock_datasource, "_process_orderby_expression"):
        delattr(mock_datasource, "_process_orderby_expression")

    # Create QueryObject
    query_obj = QueryObject(
        datasource=mock_datasource,
        metrics=[adhoc_metric],
        orderby=[(adhoc_metric, True)],
        columns=[],
        extras={},
    )

    # Validate should not crash
    query_obj.validate()

    # SQL should remain unchanged (no processing)
    assert query_obj.metrics[0]["sqlExpression"] == "sum(num)"


def test_validation_serialization_stability():
    """
    Test that serializing QueryObject metrics/orderby gives consistent results.

    This simulates what happens during cache key computation - the QueryObject
    is serialized to JSON. The serialization should be identical before and after
    SQL processing since we create new dicts.
    """
    from superset.utils import json

    adhoc_metric = {
        "expressionType": "SQL",
        "sqlExpression": "sum(num)",
        "label": "Sum",
    }

    # Mock datasource
    mock_datasource = Mock(spec=SqlaTable)
    mock_datasource.database_id = 1
    mock_datasource.schema = "public"

    def process_expression(expression: str, **kwargs: Any) -> str:
        return expression.upper()

    mock_datasource._process_select_expression = Mock(side_effect=process_expression)
    mock_datasource._process_orderby_expression = Mock(side_effect=process_expression)

    # Create QueryObject
    query_obj = QueryObject(
        datasource=mock_datasource,
        metrics=[adhoc_metric],
        orderby=[(adhoc_metric, True)],
        columns=[],
        extras={},
    )

    # Validate
    query_obj.validate()

    # Serialize the metrics and orderby
    metrics_json_1 = json.dumps(query_obj.metrics, sort_keys=True)
    orderby_json_1 = json.dumps(
        [(col, asc) for col, asc in query_obj.orderby],
        sort_keys=True,
    )

    # Re-serialize - should be identical
    metrics_json_2 = json.dumps(query_obj.metrics, sort_keys=True)
    orderby_json_2 = json.dumps(
        [(col, asc) for col, asc in query_obj.orderby],
        sort_keys=True,
    )

    assert metrics_json_1 == metrics_json_2, "Metrics serialization should be stable"
    assert orderby_json_1 == orderby_json_2, "Orderby serialization should be stable"

    # Verify processed SQL in serialized form
    assert "SUM(NUM)" in metrics_json_1
    assert "SUM(NUM)" in orderby_json_1
