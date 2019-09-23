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
# pylint: disable=C,R,W
import inspect
from typing import Type

from flask import Markup
from flask_babel import lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy import MetaData
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import ArgumentError

from superset import security_manager
from superset.exceptions import SupersetException
from superset.utils import core as utils
from superset.views.base import SupersetFilter


def sqlalchemy_uri_validator(
    uri: str, exception: Type[ValidationError] = ValidationError
) -> None:
    """
    Check if a user has submitted a valid SQLAlchemy URI
    """
    try:
        make_url(uri.strip())
    except ArgumentError:
        raise exception(
            _(
                "Invalid connnection string, a valid string follows: "
                " 'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                " <p>Example:'postgresql://user:password@your-postgres-db/database'</p>"
            )
        )


class DatabaseFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if security_manager.all_database_access():
            return query
        perms = self.get_view_menus("database_access")
        return query.filter(self.model.perm.in_(perms))


class DatabaseMixin:  # noqa
    list_title = _("Databases")
    show_title = _("Show Database")
    add_title = _("Add Database")
    edit_title = _("Edit Database")

    list_columns = [
        "database_name",
        "backend",
        "allow_run_async",
        "allow_dml",
        "allow_csv_upload",
        "expose_in_sqllab",
        "creator",
        "modified",
    ]
    order_columns = [
        "database_name",
        "allow_run_async",
        "allow_dml",
        "modified",
        "allow_csv_upload",
        "expose_in_sqllab",
    ]
    add_columns = [
        "database_name",
        "sqlalchemy_uri",
        "cache_timeout",
        "expose_in_sqllab",
        "allow_run_async",
        "allow_csv_upload",
        "allow_ctas",
        "allow_dml",
        "force_ctas_schema",
        "impersonate_user",
        "allow_multi_schema_metadata_fetch",
        "extra",
    ]
    search_exclude_columns = (
        "password",
        "tables",
        "created_by",
        "changed_by",
        "queries",
        "saved_queries",
    )
    edit_columns = add_columns
    show_columns = [
        "tables",
        "cache_timeout",
        "extra",
        "database_name",
        "sqlalchemy_uri",
        "perm",
        "created_by",
        "created_on",
        "changed_by",
        "changed_on",
    ]
    base_order = ("changed_on", "desc")
    description_columns = {
        "sqlalchemy_uri": utils.markdown(
            "Refer to the "
            "[SqlAlchemy docs]"
            "(https://docs.sqlalchemy.org/en/rel_1_2/core/engines.html#"
            "database-urls) "
            "for more information on how to structure your URI.",
            True,
        ),
        "expose_in_sqllab": _("Expose this DB in SQL Lab"),
        "allow_run_async": _(
            "Operate the database in asynchronous mode, meaning  "
            "that the queries are executed on remote workers as opposed "
            "to on the web server itself. "
            "This assumes that you have a Celery worker setup as well "
            "as a results backend. Refer to the installation docs "
            "for more information."
        ),
        "allow_ctas": _("Allow CREATE TABLE AS option in SQL Lab"),
        "allow_dml": _(
            "Allow users to run non-SELECT statements "
            "(UPDATE, DELETE, CREATE, ...) "
            "in SQL Lab"
        ),
        "force_ctas_schema": _(
            "When allowing CREATE TABLE AS option in SQL Lab, "
            "this option forces the table to be created in this schema"
        ),
        "extra": utils.markdown(
            "JSON string containing extra configuration elements.<br/>"
            "1. The ``engine_params`` object gets unpacked into the "
            "[sqlalchemy.create_engine]"
            "(https://docs.sqlalchemy.org/en/latest/core/engines.html#"
            "sqlalchemy.create_engine) call, while the ``metadata_params`` "
            "gets unpacked into the [sqlalchemy.MetaData]"
            "(https://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html"
            "#sqlalchemy.schema.MetaData) call.<br/>"
            "2. The ``metadata_cache_timeout`` is a cache timeout setting "
            "in seconds for metadata fetch of this database. Specify it as "
            '**"metadata_cache_timeout": {"schema_cache_timeout": 600, '
            '"table_cache_timeout": 600}**. '
            "If unset, cache will not be enabled for the functionality. "
            "A timeout of 0 indicates that the cache never expires.<br/>"
            "3. The ``schemas_allowed_for_csv_upload`` is a comma separated list "
            "of schemas that CSVs are allowed to upload to. "
            'Specify it as **"schemas_allowed_for_csv_upload": '
            '["public", "csv_upload"]**. '
            "If database flavor does not support schema or any schema is allowed "
            "to be accessed, just leave the list empty"
            "4. the ``version`` field is a string specifying the this db's version. "
            "This should be used with Presto DBs so that the syntax is correct",
            True,
        ),
        "impersonate_user": _(
            "If Presto, all the queries in SQL Lab are going to be executed as the "
            "currently logged on user who must have permission to run them.<br/>"
            "If Hive and hive.server2.enable.doAs is enabled, will run the queries as "
            "service account, but impersonate the currently logged on user "
            "via hive.server2.proxy.user property."
        ),
        "allow_multi_schema_metadata_fetch": _(
            "Allow SQL Lab to fetch a list of all tables and all views across "
            "all database schemas. For large data warehouse with thousands of "
            "tables, this can be expensive and put strain on the system."
        ),
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for charts of this database. "
            "A timeout of 0 indicates that the cache never expires. "
            "Note this defaults to the global timeout if undefined."
        ),
        "allow_csv_upload": _(
            "If selected, please set the schemas allowed for csv upload in Extra."
        ),
    }
    base_filters = [["id", DatabaseFilter, lambda: []]]
    label_columns = {
        "expose_in_sqllab": _("Expose in SQL Lab"),
        "allow_ctas": _("Allow CREATE TABLE AS"),
        "allow_dml": _("Allow DML"),
        "force_ctas_schema": _("CTAS Schema"),
        "database_name": _("Database"),
        "creator": _("Creator"),
        "changed_on_": _("Last Changed"),
        "sqlalchemy_uri": _("SQLAlchemy URI"),
        "cache_timeout": _("Chart Cache Timeout"),
        "extra": _("Extra"),
        "allow_run_async": _("Asynchronous Query Execution"),
        "impersonate_user": _("Impersonate the logged on user"),
        "allow_csv_upload": _("Allow Csv Upload"),
        "modified": _("Modified"),
        "allow_multi_schema_metadata_fetch": _("Allow Multi Schema Metadata Fetch"),
        "backend": _("Backend"),
    }

    def _pre_add_update(self, db):
        self.check_extra(db)
        db.set_sqlalchemy_uri(db.sqlalchemy_uri)
        security_manager.add_permission_view_menu("database_access", db.perm)
        # adding a new database we always want to force refresh schema list
        for schema in db.get_all_schema_names():
            security_manager.add_permission_view_menu(
                "schema_access", security_manager.get_schema_perm(db, schema)
            )

    def pre_add(self, db):
        self._pre_add_update(db)

    def pre_update(self, db):
        self._pre_add_update(db)

    def pre_delete(self, obj):
        if obj.tables:
            raise SupersetException(
                Markup(
                    "Cannot delete a database that has tables attached. "
                    "Here's the list of associated tables: "
                    + ", ".join("{}".format(o) for o in obj.tables)
                )
            )

    def check_extra(self, db):
        # this will check whether json.loads(extra) can succeed
        try:
            extra = db.get_extra()
        except Exception as e:
            raise Exception("Extra field cannot be decoded by JSON. {}".format(str(e)))

        # this will check whether 'metadata_params' is configured correctly
        metadata_signature = inspect.signature(MetaData)
        for key in extra.get("metadata_params", {}):
            if key not in metadata_signature.parameters:
                raise Exception(
                    "The metadata_params in Extra field "
                    "is not configured correctly. The key "
                    "{} is invalid.".format(key)
                )
