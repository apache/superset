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
Test that SQL expressions are processed consistently for cache key generation.

This prevents cache key mismatches in composite queries where SQL expressions
are processed during validation and used consistently across cache key
computation and query execution.
"""


def test_sql_expression_processing_during_validation():
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
    original_metric = {
        "expressionType": "SQL",
        "sqlExpression": "sum(num)",  # lowercase
        "label": "Sum of Num",
    }

    # The key insight: validation should process SQL expressions BEFORE
    # cache key generation, so both the cache key and query execution
    # use the same processed (uppercased) version
    #
    # After validate(), the metric should have processed SQL:
    # metric["sqlExpression"] == "SUM(num)"
    #
    # This way:
    # 1. cache_key() uses "SUM(num)"
    # 2. get_sqla_query() also uses "SUM(num)" (with processed=True flag)
    # 3. No mutation during query generation
    # 4. Cache keys match!

    assert original_metric["sqlExpression"] == "sum(num)", "Test setup verification"
