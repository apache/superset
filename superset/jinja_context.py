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
"""Defines the templating context for SQL Lab"""
import inspect
import json
import random
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, List, Optional, Tuple

from dateutil.relativedelta import relativedelta
from flask import g, request
from jinja2.sandbox import SandboxedEnvironment

from superset import app

config = app.config
BASE_CONTEXT = {
    "datetime": datetime,
    "random": random,
    "relativedelta": relativedelta,
    "time": time,
    "timedelta": timedelta,
    "uuid": uuid,
}
BASE_CONTEXT.update(config.get("JINJA_CONTEXT_ADDONS", {}))


def url_param(param: str, default: Optional[str] = None) -> Optional[Any]:
    """Read a url or post parameter and use it in your SQL Lab query

    When in SQL Lab, it's possible to add arbitrary URL "query string"
    parameters, and use those in your SQL code. For instance you can
    alter your url and add `?foo=bar`, as in
    `{domain}/superset/sqllab?foo=bar`. Then if your query is something like
    SELECT * FROM foo = '{{ url_param('foo') }}', it will be parsed at
    runtime and replaced by the value in the URL.

    As you create a visualization form this SQL Lab query, you can pass
    parameters in the explore view as well as from the dashboard, and
    it should carry through to your queries.

    :param param: the parameter to lookup
    :param default: the value to return in the absence of the parameter
    """
    if request.args.get(param):
        return request.args.get(param, default)
    # Supporting POST as well as get
    form_data = request.form.get("form_data")
    if isinstance(form_data, str):
        form_data = json.loads(form_data)
        url_params = form_data.get("url_params") or {}
        return url_params.get(param, default)
    return default


def current_user_id() -> Optional[int]:
    """The id of the user who is currently logged in"""
    if hasattr(g, "user") and g.user:
        return g.user.id
    return None


def current_username() -> Optional[str]:
    """The username of the user who is currently logged in"""
    if g.user:
        return g.user.username
    return None


def filter_values(column: str, default: Optional[str] = None) -> List[str]:
    """ Gets a values for a particular filter as a list

    This is useful if:
        - you want to use a filter box to filter a query where the name of filter box
          column doesn't match the one in the select statement
        - you want to have the ability for filter inside the main query for speed
          purposes

    This searches for "filters" and "extra_filters" in ``form_data`` for a match

    Usage example::

        SELECT action, count(*) as times
        FROM logs
        WHERE action in ( {{ "'" + "','".join(filter_values('action_type')) + "'" }} )
        GROUP BY action

    :param column: column/filter name to lookup
    :param default: default value to return if there's no matching columns
    :return: returns a list of filter values
    """
    form_data = json.loads(request.form.get("form_data", "{}"))
    return_val = []
    for filter_type in ["filters", "extra_filters"]:
        if filter_type not in form_data:
            continue

        for f in form_data[filter_type]:
            if f["col"] == column:
                if isinstance(f["val"], list):
                    for v in f["val"]:
                        return_val.append(v)
                else:
                    return_val.append(f["val"])

    if return_val:
        return return_val

    if default:
        return [default]
    else:
        return []


class CacheKeyWrapper:
    """ Dummy class that exposes a method used to store additional values used in
     calculation of query object cache keys"""

    def __init__(self, extra_cache_keys: Optional[List[Any]] = None):
        self.extra_cache_keys = extra_cache_keys

    def cache_key_wrapper(self, key: Any) -> Any:
        """ Adds values to a list that is added to the query object used for calculating
        a cache key.

        This is needed if the following applies:
            - Caching is enabled
            - The query is dynamically generated using a jinja template
            - A username or similar is used as a filter in the query

        Example when using a SQL query as a data source ::

            SELECT action, count(*) as times
            FROM logs
            WHERE logged_in_user = '{{ cache_key_wrapper(current_username()) }}'
            GROUP BY action

        This will ensure that the query results that were cached by `user_1` will
        **not** be seen by `user_2`, as the `cache_key` for the query will be
        different. ``cache_key_wrapper`` can be used similarly for regular table data
        sources by adding a `Custom SQL` filter.

        :param key: Any value that should be considered when calculating the cache key
        :return: the original value ``key`` passed to the function
        """
        if self.extra_cache_keys is not None:
            self.extra_cache_keys.append(key)
        return key


class BaseTemplateProcessor:
    """Base class for database-specific jinja context

    There's this bit of magic in ``process_template`` that instantiates only
    the database context for the active database as a ``models.Database``
    object binds it to the context object, so that object methods
    have access to
    that context. This way, {{ hive.latest_partition('mytable') }} just
    knows about the database it is operating in.

    This means that object methods are only available for the active database
    and are given access to the ``models.Database`` object and schema
    name. For globally available methods use ``@classmethod``.
    """

    engine: Optional[str] = None

    def __init__(
        self,
        database=None,
        query=None,
        table=None,
        extra_cache_keys: Optional[List[Any]] = None,
        **kwargs
    ):
        self.database = database
        self.query = query
        self.schema = None
        if query and query.schema:
            self.schema = query.schema
        elif table:
            self.schema = table.schema
        self.context = {
            "url_param": url_param,
            "current_user_id": current_user_id,
            "current_username": current_username,
            "cache_key_wrapper": CacheKeyWrapper(extra_cache_keys).cache_key_wrapper,
            "filter_values": filter_values,
            "form_data": {},
        }
        self.context.update(kwargs)
        self.context.update(BASE_CONTEXT)
        if self.engine:
            self.context[self.engine] = self
        self.env = SandboxedEnvironment()

    def process_template(self, sql: str, **kwargs) -> str:
        """Processes a sql template

        >>> sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        >>> process_template(sql)
        "SELECT '2017-01-01T00:00:00'"
        """
        template = self.env.from_string(sql)
        kwargs.update(self.context)
        return template.render(kwargs)


class PrestoTemplateProcessor(BaseTemplateProcessor):
    """Presto Jinja context

    The methods described here are namespaced under ``presto`` in the
    jinja context as in ``SELECT '{{ presto.some_macro_call() }}'``
    """

    engine = "presto"

    @staticmethod
    def _schema_table(
        table_name: str, schema: Optional[str]
    ) -> Tuple[str, Optional[str]]:
        if "." in table_name:
            schema, table_name = table_name.split(".")
        return table_name, schema

    def first_latest_partition(self, table_name: str) -> str:
        """
        Gets the first value in the array of all latest partitions

        :param table_name: table name in the format `schema.table`
        :return: the first (or only) value in the latest partition array
        :raises IndexError: If no partition exists
        """

        return self.latest_partitions(table_name)[0]

    def latest_partitions(self, table_name: str) -> List[str]:
        """
        Gets the array of all latest partitions

        :param table_name: table name in the format `schema.table`
        :return: the latest partition array
        """

        table_name, schema = self._schema_table(table_name, self.schema)
        return self.database.db_engine_spec.latest_partition(
            table_name, schema, self.database
        )[1]

    def latest_sub_partition(self, table_name, **kwargs):
        table_name, schema = self._schema_table(table_name, self.schema)
        return self.database.db_engine_spec.latest_sub_partition(
            table_name=table_name, schema=schema, database=self.database, **kwargs
        )

    latest_partition = first_latest_partition


class HiveTemplateProcessor(PrestoTemplateProcessor):
    engine = "hive"


template_processors = {}
keys = tuple(globals().keys())
for k in keys:
    o = globals()[k]
    if o and inspect.isclass(o) and issubclass(o, BaseTemplateProcessor):
        template_processors[o.engine] = o


def get_template_processor(database, table=None, query=None, **kwargs):
    TP = template_processors.get(database.backend, BaseTemplateProcessor)
    return TP(database=database, table=table, query=query, **kwargs)
