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
"""Defines the templating context for SQL Lab"""
import inspect
import re
from typing import Any, List, Optional, Tuple

from flask import g, request
from jinja2.sandbox import SandboxedEnvironment

from superset import jinja_base_context
from superset.extensions import jinja_context_manager
from superset.utils.core import convert_legacy_filters_into_adhoc, merge_extra_filters


def filter_values(column: str, default: Optional[str] = None) -> List[str]:
    """ Gets a values for a particular filter as a list

    This is useful if:
        - you want to use a filter box to filter a query where the name of filter box
          column doesn't match the one in the select statement
        - you want to have the ability for filter inside the main query for speed
          purposes

    Usage example::

        SELECT action, count(*) as times
        FROM logs
        WHERE action in ( {{ "'" + "','".join(filter_values('action_type')) + "'" }} )
        GROUP BY action

    :param column: column/filter name to lookup
    :param default: default value to return if there's no matching columns
    :return: returns a list of filter values
    """

    from superset.views.utils import get_form_data

    form_data, _ = get_form_data()
    convert_legacy_filters_into_adhoc(form_data)
    merge_extra_filters(form_data)

    return_val = [
        comparator
        for filter in form_data.get("adhoc_filters", [])
        for comparator in (
            filter["comparator"]
            if isinstance(filter["comparator"], list)
            else [filter["comparator"]]
        )
        if (
            filter.get("expressionType") == "SIMPLE"
            and filter.get("clause") == "WHERE"
            and filter.get("subject") == column
            and filter.get("comparator")
        )
    ]

    if return_val:
        return return_val

    if default:
        return [default]

    return []


class ExtraCache:
    """
    Dummy class that exposes a method used to store additional values used in
    calculation of query object cache keys.
    """

    # Regular expression for detecting the presence of templated methods which could
    # be added to the cache key.
    regex = re.compile(
        r"\{\{.*("
        r"current_user_id\(.*\)|"
        r"current_username\(.*\)|"
        r"cache_key_wrapper\(.*\)|"
        r"url_param\(.*\)"
        r").*\}\}"
    )

    def __init__(self, extra_cache_keys: Optional[List[Any]] = None):
        self.extra_cache_keys = extra_cache_keys

    def current_user_id(self, add_to_cache_keys: bool = True) -> Optional[int]:
        """
        Return the user ID of the user who is currently logged in.

        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: The user ID
        """

        if hasattr(g, "user") and g.user:
            if add_to_cache_keys:
                self.cache_key_wrapper(g.user.id)
            return g.user.id
        return None

    def current_username(self, add_to_cache_keys: bool = True) -> Optional[str]:
        """
        Return the username of the user who is currently logged in.

        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: The username
        """

        if g.user:
            if add_to_cache_keys:
                self.cache_key_wrapper(g.user.username)
            return g.user.username
        return None

    def cache_key_wrapper(self, key: Any) -> Any:
        """
        Adds values to a list that is added to the query object used for calculating a
        cache key.

        This is needed if the following applies:
            - Caching is enabled
            - The query is dynamically generated using a jinja template
            - A `JINJA_CONTEXT_ADDONS` or similar is used as a filter in the query

        :param key: Any value that should be considered when calculating the cache key
        :return: the original value ``key`` passed to the function
        """
        if self.extra_cache_keys is not None:
            self.extra_cache_keys.append(key)
        return key

    def url_param(
        self, param: str, default: Optional[str] = None, add_to_cache_keys: bool = True
    ) -> Optional[Any]:
        """
        Read a url or post parameter and use it in your SQL Lab query.

        When in SQL Lab, it's possible to add arbitrary URL "query string" parameters,
        and use those in your SQL code. For instance you can alter your url and add
        `?foo=bar`, as in `{domain}/superset/sqllab?foo=bar`. Then if your query is
        something like SELECT * FROM foo = '{{ url_param('foo') }}', it will be parsed
        at runtime and replaced by the value in the URL.

        As you create a visualization form this SQL Lab query, you can pass parameters
        in the explore view as well as from the dashboard, and it should carry through
        to your queries.

        Default values for URL parameters can be defined in chart metadata by adding the
        key-value pair `url_params: {'foo': 'bar'}`

        :param param: the parameter to lookup
        :param default: the value to return in the absence of the parameter
        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: The URL parameters
        """

        from superset.views.utils import get_form_data

        if request.args.get(param):
            return request.args.get(param, default)
        form_data, _ = get_form_data()
        url_params = form_data.get("url_params") or {}
        result = url_params.get(param, default)
        if add_to_cache_keys:
            self.cache_key_wrapper(result)
        return result


class BaseTemplateProcessor:  # pylint: disable=too-few-public-methods
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

        extra_cache = ExtraCache(extra_cache_keys)

        self.context = {
            "url_param": extra_cache.url_param,
            "current_user_id": extra_cache.current_user_id,
            "current_username": extra_cache.current_username,
            "cache_key_wrapper": extra_cache.cache_key_wrapper,
            "filter_values": filter_values,
            "form_data": {},
        }
        self.context.update(kwargs)
        self.context.update(jinja_base_context)
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


# The global template processors from Jinja context manager.
template_processors = jinja_context_manager.template_processors
keys = tuple(globals().keys())
for k in keys:
    o = globals()[k]
    if o and inspect.isclass(o) and issubclass(o, BaseTemplateProcessor):
        template_processors[o.engine] = o


def get_template_processor(database, table=None, query=None, **kwargs):
    template_processor = template_processors.get(
        database.backend, BaseTemplateProcessor
    )
    return template_processor(database=database, table=table, query=query, **kwargs)
