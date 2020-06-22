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
import logging
from typing import Callable, Optional

from flask_appbuilder import Model
from sqlalchemy.orm import Session
from sqlalchemy.orm.session import make_transient

logger = logging.getLogger(__name__)


def import_datasource(
    session: Session,
    i_datasource: Model,
    lookup_database: Callable[[Model], Model],
    lookup_datasource: Callable[[Model], Model],
    import_time: Optional[int] = None,
) -> int:
    """Imports the datasource from the object to the database.

     Metrics and columns and datasource will be overrided if exists.
     This function can be used to import/export datasources between multiple
     superset instances. Audit metadata isn't copies over.
    """
    make_transient(i_datasource)
    logger.info("Started import of the datasource: %s", i_datasource.to_json())

    i_datasource.id = None
    i_datasource.database_id = lookup_database(i_datasource).id
    i_datasource.alter_params(import_time=import_time)

    # override the datasource
    datasource = lookup_datasource(i_datasource)

    if datasource:
        datasource.override(i_datasource)
        session.flush()
    else:
        datasource = i_datasource.copy()
        session.add(datasource)
        session.flush()

    for metric in i_datasource.metrics:
        new_m = metric.copy()
        new_m.table_id = datasource.id
        logger.info(
            "Importing metric %s from the datasource: %s",
            new_m.to_json(),
            i_datasource.full_name,
        )
        imported_m = i_datasource.metric_class.import_obj(new_m)
        if imported_m.metric_name not in [m.metric_name for m in datasource.metrics]:
            datasource.metrics.append(imported_m)

    for column in i_datasource.columns:
        new_c = column.copy()
        new_c.table_id = datasource.id
        logger.info(
            "Importing column %s from the datasource: %s",
            new_c.to_json(),
            i_datasource.full_name,
        )
        imported_c = i_datasource.column_class.import_obj(new_c)
        if imported_c.column_name not in [c.column_name for c in datasource.columns]:
            datasource.columns.append(imported_c)
    session.flush()
    return datasource.id


def import_simple_obj(
    session: Session, i_obj: Model, lookup_obj: Callable[[Model], Model]
) -> Model:
    make_transient(i_obj)
    i_obj.id = None
    i_obj.table = None

    # find if the column was already imported
    existing_column = lookup_obj(i_obj)
    i_obj.table = None
    if existing_column:
        existing_column.override(i_obj)
        session.flush()
        return existing_column

    session.add(i_obj)
    session.flush()
    return i_obj
