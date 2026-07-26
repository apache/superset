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
Behavioral tests for ``viz.BaseViz.query_obj`` covering free-form filter
clause handling.
"""

from typing import Any

from superset import viz
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database

JINJA_HAVING = (
    "sum(price_each) > {% if filter_values('threshold')|length %} "
    "{{ filter_values('threshold')[0] }} {% else %} 0 {% endif %}"
)


def _viz(form_data: dict[str, Any]) -> viz.BaseViz:
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    datasource = SqlaTable(
        table_name="t",
        columns=[],
        metrics=[],
        main_dttm_col=None,
        database=database,
    )
    return viz.BaseViz(datasource=datasource, form_data=form_data)


def test_query_obj_preserves_jinja_in_freeform_having():
    """
    A free-form HAVING clause containing Jinja must reach the query object
    extras untouched: templates are only rendered (and the resulting SQL
    validated) downstream, so validating the raw clause here would reject
    valid templates (regression guard for premature clause validation).
    """
    obj = _viz({"viz_type": "table", "having": JINJA_HAVING})

    query_obj = obj.query_obj()

    assert query_obj["extras"]["having"] == f"({JINJA_HAVING})"
