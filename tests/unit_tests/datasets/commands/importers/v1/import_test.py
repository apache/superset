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
# pylint: disable=import-outside-toplevel, unused-argument, unused-import, invalid-name

import copy
import json
import uuid
from typing import Any, Dict

from sqlalchemy.orm.session import Session


def test_import_dataset(app_context: None, session: Session) -> None:
    """
    Test importing a dataset.
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.datasets.commands.importers.v1.utils import import_dataset
    from superset.datasets.schemas import ImportV1DatasetSchema
    from superset.models.core import Database

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.flush()

    dataset_uuid = uuid.uuid4()
    config = {
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {"answer": "42",},
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": {"warning_markdown": "*WARNING*"},
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": {"warning_markdown": None},
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": None,
                "is_active": None,
                "type": "INTEGER",
                "groupby": None,
                "filterable": None,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": {"certified_by": "User",},
            }
        ],
        "database_uuid": database.uuid,
        "database_id": database.id,
    }

    sqla_table = import_dataset(session, config)
    assert sqla_table.table_name == "my_table"
    assert sqla_table.main_dttm_col == "ds"
    assert sqla_table.description == "This is the description"
    assert sqla_table.default_endpoint is None
    assert sqla_table.offset == -8
    assert sqla_table.cache_timeout == 3600
    assert sqla_table.schema == "my_schema"
    assert sqla_table.sql is None
    assert sqla_table.params == json.dumps(
        {"remote_id": 64, "database_name": "examples", "import_time": 1606677834}
    )
    assert sqla_table.template_params == json.dumps({"answer": "42"})
    assert sqla_table.filter_select_enabled is True
    assert sqla_table.fetch_values_predicate == "foo IN (1, 2)"
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'
    assert sqla_table.uuid == dataset_uuid
    assert len(sqla_table.metrics) == 1
    assert sqla_table.metrics[0].metric_name == "cnt"
    assert sqla_table.metrics[0].verbose_name is None
    assert sqla_table.metrics[0].metric_type is None
    assert sqla_table.metrics[0].expression == "COUNT(*)"
    assert sqla_table.metrics[0].description is None
    assert sqla_table.metrics[0].d3format is None
    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.metrics[0].warning_text is None
    assert len(sqla_table.columns) == 1
    assert sqla_table.columns[0].column_name == "profit"
    assert sqla_table.columns[0].verbose_name is None
    assert sqla_table.columns[0].is_dttm is None
    assert sqla_table.columns[0].is_active is None
    assert sqla_table.columns[0].type == "INTEGER"
    assert sqla_table.columns[0].groupby is None
    assert sqla_table.columns[0].filterable is None
    assert sqla_table.columns[0].expression == "revenue-expenses"
    assert sqla_table.columns[0].description is None
    assert sqla_table.columns[0].python_date_format is None
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.database.uuid == database.uuid
    assert sqla_table.database.id == database.id


def test_import_column_extra_is_string(app_context: None, session: Session) -> None:
    """
    Test importing a dataset when the column extra is a string.
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.datasets.commands.importers.v1.utils import import_dataset
    from superset.datasets.schemas import ImportV1DatasetSchema
    from superset.models.core import Database

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.flush()

    dataset_uuid = uuid.uuid4()
    yaml_config: Dict[str, Any] = {
        "version": "1.0.0",
        "table_name": "my_table",
        "main_dttm_col": "ds",
        "description": "This is the description",
        "default_endpoint": None,
        "offset": -8,
        "cache_timeout": 3600,
        "schema": "my_schema",
        "sql": None,
        "params": {
            "remote_id": 64,
            "database_name": "examples",
            "import_time": 1606677834,
        },
        "template_params": {"answer": "42",},
        "filter_select_enabled": True,
        "fetch_values_predicate": "foo IN (1, 2)",
        "extra": '{"warning_markdown": "*WARNING*"}',
        "uuid": dataset_uuid,
        "metrics": [
            {
                "metric_name": "cnt",
                "verbose_name": None,
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": '{"warning_markdown": null}',
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "profit",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": True,
                "type": "INTEGER",
                "groupby": False,
                "filterable": False,
                "expression": "revenue-expenses",
                "description": None,
                "python_date_format": None,
                "extra": '{"certified_by": "User"}',
            }
        ],
        "database_uuid": database.uuid,
    }

    # the Marshmallow schema should convert strings to objects
    schema = ImportV1DatasetSchema()
    dataset_config = schema.load(yaml_config)
    dataset_config["database_id"] = database.id
    sqla_table = import_dataset(session, dataset_config)

    assert sqla_table.metrics[0].extra == '{"warning_markdown": null}'
    assert sqla_table.columns[0].extra == '{"certified_by": "User"}'
    assert sqla_table.extra == '{"warning_markdown": "*WARNING*"}'


def test_import_dataset_managed_externally(app_context: None, session: Session) -> None:
    """
    Test importing a dataset that is managed externally.
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.datasets.commands.importers.v1.utils import import_dataset
    from superset.datasets.schemas import ImportV1DatasetSchema
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import dataset_config

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.flush()

    dataset_uuid = uuid.uuid4()
    config = copy.deepcopy(dataset_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_table"
    config["database_id"] = database.id

    sqla_table = import_dataset(session, config)
    assert sqla_table.is_managed_externally is True
    assert sqla_table.external_url == "https://example.org/my_table"
