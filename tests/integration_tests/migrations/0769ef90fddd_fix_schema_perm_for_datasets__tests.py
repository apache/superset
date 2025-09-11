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
from importlib import import_module

import pytest

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.utils.core import backend, get_example_default_schema
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)

migration_module = import_module(
    "superset.migrations.versions."
    "2023-08-02_15-23_0769ef90fddd_fix_schema_perm_for_datasets"
)

fix_datasets_schema_perm = migration_module.fix_datasets_schema_perm
fix_charts_schema_perm = migration_module.fix_charts_schema_perm


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
def test_fix_schema_perm():
    if backend() == "sqlite":
        return

    dataset = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
    chart = db.session.query(Slice).filter_by(slice_name="Girls").one()
    dataset.schema_perm = "wrong"
    chart.schema_perm = "wrong"
    db.session.commit()

    fix_datasets_schema_perm(db.session)
    db.session.commit()
    assert dataset.schema_perm == f"[examples].[{get_example_default_schema()}]"

    fix_charts_schema_perm(db.session)
    db.session.commit()
    assert chart.schema_perm == f"[examples].[{get_example_default_schema()}]"
