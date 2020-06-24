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
"""A collection of ORM sqlalchemy models for SQL Lab"""
import re
from datetime import datetime
from typing import Any, Dict

import simplejson as json
import sqlalchemy as sqla
from flask import Markup
from flask_appbuilder import Model
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.engine.url import URL
from sqlalchemy.orm import backref, relationship

from superset import security_manager
from superset.models.helpers import AuditMixinNullable, ExtraJSONMixin
from superset.models.tags import QueryUpdater
from superset.sql_parse import CtasMethod
from superset.utils.core import QueryStatus, user_label


class Query(Model, ExtraJSONMixin):
    """ORM model for SQL query

    Now that SQL Lab support multi-statement execution, an entry in this
    table may represent multiple SQL statements executed sequentially"""

    __tablename__ = "query"
    id = Column(Integer, primary_key=True)
    client_id = Column(String(11), unique=True, nullable=False)

    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=False)

    # Store the tmp table into the DB only if the user asks for it.
    tmp_table_name = Column(String(256))
    tmp_schema_name = Column(String(256))
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    status = Column(String(16), default=QueryStatus.PENDING)
    tab_name = Column(String(256))
    sql_editor_id = Column(String(256))
    schema = Column(String(256))
    sql = Column(Text)
    # Query to retrieve the results,
    # used only in case of select_as_cta_used is true.
    select_sql = Column(Text)
    executed_sql = Column(Text)
    # Could be configured in the superset config.
    limit = Column(Integer)
    select_as_cta = Column(Boolean)
    select_as_cta_used = Column(Boolean, default=False)
    ctas_method = Column(String(16), default=CtasMethod.TABLE)

    progress = Column(Integer, default=0)  # 1..100
    # # of rows in the result set or rows modified.
    rows = Column(Integer)
    error_message = Column(Text)
    # key used to store the results in the results backend
    results_key = Column(String(64), index=True)

    # Using Numeric in place of DateTime for sub-second precision
    # stored as seconds since epoch, allowing for milliseconds
    start_time = Column(Numeric(precision=20, scale=6))
    start_running_time = Column(Numeric(precision=20, scale=6))
    end_time = Column(Numeric(precision=20, scale=6))
    end_result_backend_time = Column(Numeric(precision=20, scale=6))
    tracking_url = Column(Text)

    changed_on = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True
    )

    database = relationship(
        "Database",
        foreign_keys=[database_id],
        backref=backref("queries", cascade="all, delete-orphan"),
    )
    user = relationship(security_manager.user_model, foreign_keys=[user_id])

    __table_args__ = (sqla.Index("ti_user_id_changed_on", user_id, changed_on),)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "changedOn": self.changed_on,
            "changed_on": self.changed_on.isoformat(),
            "dbId": self.database_id,
            "db": self.database.database_name,
            "endDttm": self.end_time,
            "errorMessage": self.error_message,
            "executedSql": self.executed_sql,
            "id": self.client_id,
            "limit": self.limit,
            "progress": self.progress,
            "rows": self.rows,
            "schema": self.schema,
            "ctas": self.select_as_cta,
            "serverId": self.id,
            "sql": self.sql,
            "sqlEditorId": self.sql_editor_id,
            "startDttm": self.start_time,
            "state": self.status.lower(),
            "tab": self.tab_name,
            "tempSchema": self.tmp_schema_name,
            "tempTable": self.tmp_table_name,
            "userId": self.user_id,
            "user": user_label(self.user),
            "resultsKey": self.results_key,
            "trackingUrl": self.tracking_url,
            "extra": self.extra,
        }

    @property
    def name(self) -> str:
        """Name property"""
        ts = datetime.now().isoformat()
        ts = ts.replace("-", "").replace(":", "").split(".")[0]
        tab = self.tab_name.replace(" ", "_").lower() if self.tab_name else "notab"
        tab = re.sub(r"\W+", "", tab)
        return f"sqllab_{tab}_{ts}"

    @property
    def database_name(self) -> str:
        return self.database.name

    @property
    def username(self) -> str:
        return self.user.username

    def raise_for_access(self) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :raises SupersetSecurityException: If the user cannot access the resource
        """

        security_manager.raise_for_access(query=self)


class SavedQuery(Model, AuditMixinNullable, ExtraJSONMixin):
    """ORM model for SQL query"""

    __tablename__ = "saved_query"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    db_id = Column(Integer, ForeignKey("dbs.id"), nullable=True)
    schema = Column(String(128))
    label = Column(String(256))
    description = Column(Text)
    sql = Column(Text)
    user = relationship(
        security_manager.user_model,
        backref=backref("saved_queries", cascade="all, delete-orphan"),
        foreign_keys=[user_id],
    )
    database = relationship(
        "Database",
        foreign_keys=[db_id],
        backref=backref("saved_queries", cascade="all, delete-orphan"),
    )

    @property
    def pop_tab_link(self) -> Markup:
        return Markup(
            f"""
            <a href="/superset/sqllab?savedQueryId={self.id}">
                <i class="fa fa-link"></i>
            </a>
        """
        )

    @property
    def user_email(self) -> str:
        return self.user.email

    @property
    def sqlalchemy_uri(self) -> URL:
        return self.database.sqlalchemy_uri

    def url(self) -> str:
        return "/superset/sqllab?savedQueryId={0}".format(self.id)


class TabState(Model, AuditMixinNullable, ExtraJSONMixin):

    __tablename__ = "tab_state"

    # basic info
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"))
    label = Column(String(256))
    active = Column(Boolean, default=False)

    # selected DB and schema
    database_id = Column(Integer, ForeignKey("dbs.id"))
    database = relationship("Database", foreign_keys=[database_id])
    schema = Column(String(256))

    # tables that are open in the schema browser and their data previews
    table_schemas = relationship(
        "TableSchema",
        cascade="all, delete-orphan",
        backref="tab_state",
        passive_deletes=True,
    )

    # the query in the textarea, and results (if any)
    sql = Column(Text)
    query_limit = Column(Integer)

    # latest query that was run
    latest_query_id = Column(Integer, ForeignKey("query.client_id"))
    latest_query = relationship("Query")

    # other properties
    autorun = Column(Boolean, default=False)
    template_params = Column(Text)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "label": self.label,
            "active": self.active,
            "database_id": self.database_id,
            "schema": self.schema,
            "table_schemas": [ts.to_dict() for ts in self.table_schemas],
            "sql": self.sql,
            "query_limit": self.query_limit,
            "latest_query": self.latest_query.to_dict() if self.latest_query else None,
            "autorun": self.autorun,
            "template_params": self.template_params,
        }


class TableSchema(Model, AuditMixinNullable, ExtraJSONMixin):

    __tablename__ = "table_schema"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tab_state_id = Column(Integer, ForeignKey("tab_state.id", ondelete="CASCADE"))

    database_id = Column(Integer, ForeignKey("dbs.id"), nullable=False)
    database = relationship("Database", foreign_keys=[database_id])
    schema = Column(String(256))
    table = Column(String(256))

    # JSON describing the schema, partitions, latest partition, etc.
    description = Column(Text)

    expanded = Column(Boolean, default=False)

    def to_dict(self) -> Dict[str, Any]:
        try:
            description = json.loads(self.description)
        except json.JSONDecodeError:
            description = None

        return {
            "id": self.id,
            "tab_state_id": self.tab_state_id,
            "database_id": self.database_id,
            "schema": self.schema,
            "table": self.table,
            "description": description,
            "expanded": self.expanded,
        }


# events for updating tags
sqla.event.listen(SavedQuery, "after_insert", QueryUpdater.after_insert)
sqla.event.listen(SavedQuery, "after_update", QueryUpdater.after_update)
sqla.event.listen(SavedQuery, "after_delete", QueryUpdater.after_delete)
