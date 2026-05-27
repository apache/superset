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

from sqlalchemy.orm import joinedload

from superset import is_feature_enabled
from superset.commands.database.ssh_tunnel.exceptions import SSHTunnelingNotEnabledError
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
    def create(
        cls,
        item: Database | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> Database:
        """
        Create a new database, with an optional SSH tunnel.
        """
        ssh_tunnel_attributes = (
            attributes.pop("ssh_tunnel", None) if attributes else None
        )

        database = super().create(item, attributes)

        if ssh_tunnel_attributes:
            if not is_feature_enabled("SSH_TUNNELING"):
                raise SSHTunnelingNotEnabledError()

            database.ssh_tunnel = SSHTunnel(**ssh_tunnel_attributes)

        return database

    @classmethod
    def find_by_id(
        cls,
        model_id: str | int,
        skip_base_filter: bool = False,
        id_column: str | None = None,
        query_options: list[Any] | None = None,
    ) -> Database | None:
        """
        Find a database by id, eagerly loading the SSH tunnel relationship.
        """
        all_options = [joinedload(Database.ssh_tunnel)]
        if query_options:
            all_options.extend(query_options)
        query = db.session.query(cls.model_cls).options(*all_options)
        query = cls._apply_base_filter(query, skip_base_filter)

        column_name = id_column or cls.id_column_name
        if not hasattr(cls.model_cls, column_name):
            raise AttributeError(
                "{0} has no column {1}".format(cls.model_cls, column_name)
            )

        column = getattr(cls.model_cls, column_name)
        return query.filter(column == model_id).one_or_none()

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
        attributes = attributes or {}

        if item and "encrypted_extra" in attributes:
            attributes["encrypted_extra"] = item.db_engine_spec.unmask_encrypted_extra(
                item.encrypted_extra,
                attributes["encrypted_extra"],
            )

        # update SSH tunnel
        if "ssh_tunnel" not in attributes:
            # keep existing tunnel if it exists
            ssh_tunnel = item.ssh_tunnel if item else None
        elif attributes["ssh_tunnel"] is None:
            # remove existing tunnel
            ssh_tunnel = None
        else:
            # update existing tunnel or create a new one
            ssh_tunnel_attributes = attributes.pop("ssh_tunnel")

            # when updating the tunnel, passwords are sent masked to the frontend; if
            # they arrive back masked we need to unmask them
            if item and item.ssh_tunnel:
                ssh_tunnel_attributes = unmask_password_info(
                    ssh_tunnel_attributes,
                    item.ssh_tunnel,
                )

                # delete existing SSH tunnel first
                item.ssh_tunnel = None
                db.session.flush()

            ssh_tunnel = SSHTunnel(**ssh_tunnel_attributes)

        database = super().update(item, attributes)
        database.ssh_tunnel = ssh_tunnel

        return database

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
        server_cert: str,
        extra: str,
        impersonate_user: bool,
        encrypted_extra: str,
        ssh_tunnel: dict[str, Any] | None = None,
    ) -> Database:
        return Database(
            server_cert=server_cert,
            extra=extra,
            impersonate_user=impersonate_user,
            encrypted_extra=encrypted_extra,
            ssh_tunnel=SSHTunnel(**ssh_tunnel) if ssh_tunnel else None,
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


class DatabaseUserOAuth2TokensDAO(BaseDAO[DatabaseUserOAuth2Tokens]):
    """
    DAO for OAuth2 tokens.
    """

    @classmethod
    def get_database(cls, database_id: int) -> Database | None:
        """
        Returns the database.

        Note that this is different from `DatabaseDAO.find_by_id(database_id)` because
        this DAO doesn't have any filters, so it can be called even for users without
        database access (which is necessary for OAuth2).
        """
        return db.session.query(Database).filter_by(id=database_id).one_or_none()
