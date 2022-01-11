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
from typing import List, Optional

from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import User

from superset import appbuilder
from superset.connectors.sqla.models import SqlaTable, sqlatable_user
from superset.models.core import Database
from superset.models.dashboard import (
    Dashboard,
    dashboard_slices,
    dashboard_user,
    DashboardRoles,
)
from superset.models.slice import Slice, slice_user
from tests.integration_tests.dashboards.dashboard_test_utils import (
    random_slug,
    random_str,
    random_title,
)

logger = logging.getLogger(__name__)

session = appbuilder.get_session

inserted_dashboards_ids = []
inserted_databases_ids = []
inserted_sqltables_ids = []
inserted_slices_ids = []


def create_dashboard_to_db(
    dashboard_title: Optional[str] = None,
    slug: Optional[str] = None,
    published: bool = False,
    owners: Optional[List[User]] = None,
    slices: Optional[List[Slice]] = None,
    css: str = "",
    json_metadata: str = "",
    position_json: str = "",
) -> Dashboard:
    dashboard = create_dashboard(
        dashboard_title,
        slug,
        published,
        owners,
        slices,
        css,
        json_metadata,
        position_json,
    )

    insert_model(dashboard)
    inserted_dashboards_ids.append(dashboard.id)
    return dashboard


def create_dashboard(
    dashboard_title: Optional[str] = None,
    slug: Optional[str] = None,
    published: bool = False,
    owners: Optional[List[User]] = None,
    slices: Optional[List[Slice]] = None,
    css: str = "",
    json_metadata: str = "",
    position_json: str = "",
) -> Dashboard:
    dashboard_title = dashboard_title if dashboard_title is not None else random_title()
    slug = slug if slug is not None else random_slug()
    owners = owners if owners is not None else []
    slices = slices if slices is not None else []
    return Dashboard(
        dashboard_title=dashboard_title,
        slug=slug,
        published=published,
        owners=owners,
        css=css,
        position_json=position_json,
        json_metadata=json_metadata,
        slices=slices,
    )


def insert_model(dashboard: Model) -> None:
    session.add(dashboard)
    session.commit()
    session.refresh(dashboard)


def create_slice_to_db(
    name: Optional[str] = None,
    datasource_id: Optional[int] = None,
    owners: Optional[List[User]] = None,
) -> Slice:
    slice_ = create_slice(datasource_id, name=name, owners=owners)
    insert_model(slice_)
    inserted_slices_ids.append(slice_.id)
    return slice_


def create_slice(
    datasource_id: Optional[int] = None,
    datasource: Optional[SqlaTable] = None,
    name: Optional[str] = None,
    owners: Optional[List[User]] = None,
) -> Slice:
    name = name if name is not None else random_str()
    owners = owners if owners is not None else []
    datasource_type = "table"
    if datasource:
        return Slice(
            slice_name=name,
            table=datasource,
            owners=owners,
            datasource_type=datasource_type,
        )

    datasource_id = (
        datasource_id
        if datasource_id is not None
        else create_datasource_table_to_db(name=name + "_table").id
    )

    return Slice(
        slice_name=name,
        datasource_id=datasource_id,
        owners=owners,
        datasource_type=datasource_type,
    )


def create_datasource_table_to_db(
    name: Optional[str] = None,
    db_id: Optional[int] = None,
    owners: Optional[List[User]] = None,
) -> SqlaTable:
    sqltable = create_datasource_table(name, db_id, owners=owners)
    insert_model(sqltable)
    inserted_sqltables_ids.append(sqltable.id)
    return sqltable


def create_datasource_table(
    name: Optional[str] = None,
    db_id: Optional[int] = None,
    database: Optional[Database] = None,
    owners: Optional[List[User]] = None,
) -> SqlaTable:
    name = name if name is not None else random_str()
    owners = owners if owners is not None else []
    if database:
        return SqlaTable(table_name=name, database=database, owners=owners)
    db_id = db_id if db_id is not None else create_database_to_db(name=name + "_db").id
    return SqlaTable(table_name=name, database_id=db_id, owners=owners)


def create_database_to_db(name: Optional[str] = None) -> Database:
    database = create_database(name)
    insert_model(database)
    inserted_databases_ids.append(database.id)
    return database


def create_database(name: Optional[str] = None) -> Database:
    name = name if name is not None else random_str()
    return Database(database_name=name, sqlalchemy_uri="sqlite:///:memory:")


def delete_all_inserted_objects() -> None:
    delete_all_inserted_dashboards()
    delete_all_inserted_slices()
    delete_all_inserted_tables()
    delete_all_inserted_dbs()


def delete_all_inserted_dashboards():
    try:
        dashboards_to_delete: List[Dashboard] = session.query(Dashboard).filter(
            Dashboard.id.in_(inserted_dashboards_ids)
        ).all()
        for dashboard in dashboards_to_delete:
            try:
                delete_dashboard(dashboard, False)
            except Exception as ex:
                logger.error(f"failed to delete {dashboard.id}", exc_info=True)
                raise ex
        if len(inserted_dashboards_ids) > 0:
            session.commit()
            inserted_dashboards_ids.clear()
    except Exception as ex2:
        logger.error("delete_all_inserted_dashboards failed", exc_info=True)
        raise ex2


def delete_dashboard(dashboard: Dashboard, do_commit: bool = False) -> None:
    logger.info(f"deleting dashboard{dashboard.id}")
    delete_dashboard_roles_associations(dashboard)
    delete_dashboard_users_associations(dashboard)
    delete_dashboard_slices_associations(dashboard)
    session.delete(dashboard)
    if do_commit:
        session.commit()


def delete_dashboard_users_associations(dashboard: Dashboard) -> None:
    session.execute(
        dashboard_user.delete().where(dashboard_user.c.dashboard_id == dashboard.id)
    )


def delete_dashboard_roles_associations(dashboard: Dashboard) -> None:
    session.execute(
        DashboardRoles.delete().where(DashboardRoles.c.dashboard_id == dashboard.id)
    )


def delete_dashboard_slices_associations(dashboard: Dashboard) -> None:
    session.execute(
        dashboard_slices.delete().where(dashboard_slices.c.dashboard_id == dashboard.id)
    )


def delete_all_inserted_slices():
    try:
        slices_to_delete: List[Slice] = session.query(Slice).filter(
            Slice.id.in_(inserted_slices_ids)
        ).all()
        for slice in slices_to_delete:
            try:
                delete_slice(slice, False)
            except Exception as ex:
                logger.error(f"failed to delete {slice.id}", exc_info=True)
                raise ex
        if len(inserted_slices_ids) > 0:
            session.commit()
            inserted_slices_ids.clear()
    except Exception as ex2:
        logger.error("delete_all_inserted_slices failed", exc_info=True)
        raise ex2


def delete_slice(slice_: Slice, do_commit: bool = False) -> None:
    logger.info(f"deleting slice{slice_.id}")
    delete_slice_users_associations(slice_)
    session.delete(slice_)
    if do_commit:
        session.commit()


def delete_slice_users_associations(slice_: Slice) -> None:
    session.execute(slice_user.delete().where(slice_user.c.slice_id == slice_.id))


def delete_all_inserted_tables():
    try:
        tables_to_delete: List[SqlaTable] = session.query(SqlaTable).filter(
            SqlaTable.id.in_(inserted_sqltables_ids)
        ).all()
        for table in tables_to_delete:
            try:
                delete_sqltable(table, False)
            except Exception as ex:
                logger.error(f"failed to delete {table.id}", exc_info=True)
                raise ex
        if len(inserted_sqltables_ids) > 0:
            session.commit()
            inserted_sqltables_ids.clear()
    except Exception as ex2:
        logger.error("delete_all_inserted_tables failed", exc_info=True)
        raise ex2


def delete_sqltable(table: SqlaTable, do_commit: bool = False) -> None:
    logger.info(f"deleting table{table.id}")
    delete_table_users_associations(table)
    session.delete(table)
    if do_commit:
        session.commit()


def delete_table_users_associations(table: SqlaTable) -> None:
    session.execute(
        sqlatable_user.delete().where(sqlatable_user.c.table_id == table.id)
    )


def delete_all_inserted_dbs():
    try:
        dbs_to_delete: List[Database] = session.query(Database).filter(
            Database.id.in_(inserted_databases_ids)
        ).all()
        for db in dbs_to_delete:
            try:
                delete_database(db, False)
            except Exception as ex:
                logger.error(f"failed to delete {db.id}", exc_info=True)
                raise ex
        if len(inserted_databases_ids) > 0:
            session.commit()
            inserted_databases_ids.clear()
    except Exception as ex2:
        logger.error("delete_all_inserted_databases failed", exc_info=True)
        raise ex2


def delete_database(database: Database, do_commit: bool = False) -> None:
    logger.info(f"deleting database{database.id}")
    session.delete(database)
    if do_commit:
        session.commit()
