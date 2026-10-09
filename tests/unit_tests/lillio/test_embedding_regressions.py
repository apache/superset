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
from types import SimpleNamespace
from typing import cast


def test_set_related_perm_accepts_datasource_without_catalog(
    app_context, mocker
) -> None:
    from superset.models.slice import set_related_perm, Slice

    datasource = SimpleNamespace(perm="database.perm", schema_perm="schema.perm")
    query = mocker.patch("superset.models.slice.db.session.query")
    query.return_value.filter_by.return_value.first.return_value = datasource
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.sources",
        {"legacy": object()},
    )
    chart = SimpleNamespace(datasource_type="legacy", datasource_id=7)

    set_related_perm(None, None, cast(Slice, chart))

    assert chart.perm == "database.perm"
    assert chart.catalog_perm is None
    assert chart.schema_perm == "schema.perm"
