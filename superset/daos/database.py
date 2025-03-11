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
from __future__ import annotations

import logging
from typing import Any

from superset.connectors.sqla.models import SqlaTable
from superset.daos.base import BaseDAO
from superset.databases.filters import DatabaseFilter
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.extensions import db
from superset.models.core import Database, DatabaseUserOAuth2Tokens
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.models.sql_lab import TabState
from superset.utils.core import DatasourceType
from superset.utils.ssh_tunnel import unmask_password_info

logger = logging.getLogger(__name__)


class DatabaseDAO(BaseDAO[Database]):
    base_filter = DatabaseFilter

    @classmethod
    def update(
        cls,
        item: Database | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> Database:
        """
        Unmask ``encrypted_extra`` before updating.

        When a database is edited the user sees a masked version of ``encrypted_extra``,
        depending on the engine spec. Eg, BigQuery will mask the ``private_key`` attribute
        of the credentials.

        The masked values should be unmasked before the database is updated.
        """  # noqa: E501

        if item and attributes and "encrypted_extra" in attributes:
            attributes["encrypted_extra"] = item.db_engine_spec.unmask_encrypted_extra(
                item.encrypted_extra,
                attributes["encrypted_extra"],
            )

        return super().update(item, attributes)

    @staticmethod
    def validate_uniqueness(database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(database_id: int, database_name: str) -> bool:
        database_query = db.session.query(Database).filter(
            Database.database_name == database_name,
            Database.id != database_id,
        )
        return not db.session.query(database_query.exists()).scalar()

    @staticmethod
    def get_database_by_name(database_name: str) -> Database | None:
        return (
            db.session.query(Database)
            .filter(Database.database_name == database_name)
            .one_or_none()
        )

    @staticmethod
    def build_db_for_connection_test(
        server_cert: str, extra: str, impersonate_user: bool, encrypted_extra: str
    ) -> Database:
        return Database(
            server_cert=server_cert,
            extra=extra,
            impersonate_user=impersonate_user,
            encrypted_extra=encrypted_extra,
        )

    @classmethod
    def get_related_objects(cls, database_id: int) -> dict[str, Any]:
        database: Any = cls.find_by_id(database_id)
        datasets = database.tables
        dataset_ids = [dataset.id for dataset in datasets]

        charts = (
            db.session.query(Slice)
            .filter(
                Slice.datasource_id.in_(dataset_ids),
                Slice.datasource_type == DatasourceType.TABLE,
            )
            .all()
        )
        chart_ids = [chart.id for chart in charts]

        dashboards = (
            (
                db.session.query(Dashboard)
                .join(Dashboard.slices)
                .filter(Slice.id.in_(chart_ids))
            )
            .distinct()
            .all()
        )

        sqllab_tab_states = (
            db.session.query(TabState).filter(TabState.database_id == database_id).all()
        )

        return {
            "charts": charts,
            "dashboards": dashboards,
            "sqllab_tab_states": sqllab_tab_states,
        }

    @classmethod
    def get_datasets(
        cls,
        database_id: int,
        catalog: str | None,
        schema: str | None,
    ) -> list[SqlaTable]:
        """
        Return all datasets, optionally filtered by catalog/schema.

        :param database_id: The database ID
        :param catalog: The catalog name
        :param schema: The schema name
        :return: A list of SqlaTable objects
        """
        return (
            db.session.query(SqlaTable)
            .filter(
                SqlaTable.database_id == database_id,
                SqlaTable.catalog == catalog,
                SqlaTable.schema == schema,
            )
            .all()
        )

    @classmethod
    def get_ssh_tunnel(cls, database_id: int) -> SSHTunnel | None:
        ssh_tunnel = (
            db.session.query(SSHTunnel)
            .filter(SSHTunnel.database_id == database_id)
            .one_or_none()
        )

        return ssh_tunnel


class SSHTunnelDAO(BaseDAO[SSHTunnel]):
    @classmethod
    def update(
        cls,
        item: SSHTunnel | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> SSHTunnel:
        """
        Unmask ``password``, ``private_key`` and ``private_key_password`` before updating.

        When a database is edited the user sees a masked version of
        the aforementioned fields.

        The masked values should be unmasked before the ssh tunnel is updated.
        """  # noqa: E501
        # ID cannot be updated so we remove it if present in the payload

        if item and attributes:
            attributes.pop("id", None)
            attributes = unmask_password_info(attributes, item)

        return super().update(item, attributes)


class DatabaseUserOAuth2TokensDAO(BaseDAO[DatabaseUserOAuth2Tokens]):
    """
    DAO for OAuth2 tokens.
    """
