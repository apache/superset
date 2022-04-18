#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.

from superset import ConnectorRegistry, db
from superset.connectors.sqla.models import SqlaTable
from superset.utils.core import get_example_default_schema


def cleanup_table(table_name):
    schema = get_example_default_schema()
    table = (
        db.session.query(SqlaTable)
        .filter_by(table_name=table_name, schema=schema)
        .one_or_none()
    )
    if table:
        table_id = table.id
        datasource = ConnectorRegistry.get_datasource("table", table_id, db.session)
        columns = [column for column in datasource.columns]
        metrics = [metric for metric in datasource.metrics]
        for column in columns:
            db.session.delete(column)
        for metric in metrics:
            db.session.delete(metric)
        db.session.delete(datasource)
        db.session.commit()
