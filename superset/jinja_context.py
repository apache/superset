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

import re
from datetime import datetime
from functools import lru_cache, partial
from typing import Any, Callable, cast, Optional, TYPE_CHECKING, TypedDict, Union

import dateutil
from flask import current_app, has_request_context, request
from flask_babel import gettext as _
from jinja2 import DebugUndefined, Environment
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.expression import bindparam
from sqlalchemy.types import String

from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.constants import LRU_CACHE_MAX_SIZE
from superset.exceptions import SupersetTemplateException
from superset.extensions import feature_flag_manager
from superset.sql_parse import Table
from superset.utils import json
from superset.utils.core import (
    convert_legacy_filters_into_adhoc,
    get_user_email,
    get_user_id,
    get_username,
    merge_extra_filters,
)

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.sql_lab import Query

NONE_TYPE = type(None).__name__
ALLOWED_TYPES = (
    NONE_TYPE,
    "bool",
    "str",
    "unicode",
    "int",
    "long",
    "float",
    "list",
    "dict",
    "tuple",
    "set",
)
COLLECTION_TYPES = ("list", "dict", "tuple", "set")


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def context_addons() -> dict[str, Any]:
    return current_app.config.get("JINJA_CONTEXT_ADDONS", {})


class Filter(TypedDict):
    op: str  # pylint: disable=C0103
    col: str
    val: Union[None, Any, list[Any]]


class ExtraCache:
    """
    Dummy class that exposes a method used to store additional values used in
    calculation of query object cache keys.
    """

    # Regular expression for detecting the presence of templated methods which could
    # be added to the cache key.
    regex = re.compile(
        r"(\{\{|\{%)[^{}]*?("
        r"current_user_id\([^()]*\)|"
        r"current_username\([^()]*\)|"
        r"current_user_email\([^()]*\)|"
        r"cache_key_wrapper\([^()]*\)|"
        r"url_param\([^()]*\)"
        r")"
        r"[^{}]*?(\}\}|\%\})"
    )

    def __init__(
        self,
        extra_cache_keys: Optional[list[Any]] = None,
        applied_filters: Optional[list[str]] = None,
        removed_filters: Optional[list[str]] = None,
        dialect: Optional[Dialect] = None,
    ):
        self.extra_cache_keys = extra_cache_keys
        self.applied_filters = applied_filters if applied_filters is not None else []
        self.removed_filters = removed_filters if removed_filters is not None else []
        self.dialect = dialect

    def current_user_id(self, add_to_cache_keys: bool = True) -> Optional[int]:
        """
        Return the user ID of the user who is currently logged in.

        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: The user ID
        """

        if user_id := get_user_id():
            if add_to_cache_keys:
                self.cache_key_wrapper(user_id)
            return user_id
        return None

    def current_username(self, add_to_cache_keys: bool = True) -> Optional[str]:
        """
        Return the username of the user who is currently logged in.

        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: The username
        """

        if username := get_username():
            if add_to_cache_keys:
                self.cache_key_wrapper(username)
            return username
        return None

    def current_user_email(self, add_to_cache_keys: bool = True) -> Optional[str]:
        """
        Return the email address of the user who is currently logged in.

        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: The user email address
        """

        if email_address := get_user_email():
            if add_to_cache_keys:
                self.cache_key_wrapper(email_address)
            return email_address
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
        self,
        param: str,
        default: Optional[str] = None,
        add_to_cache_keys: bool = True,
        escape_result: bool = True,
    ) -> Optional[str]:
        """
        Read a url or post parameter and use it in your SQL Lab query.

        When in SQL Lab, it's possible to add arbitrary URL "query string" parameters,
        and use those in your SQL code. For instance you can alter your url and add
        `?foo=bar`, as in `{domain}/sqllab?foo=bar`. Then if your query is
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
        :param escape_result: Should special characters in the result be escaped
        :returns: The URL parameters
        """

        # pylint: disable=import-outside-toplevel
        from superset.views.utils import get_form_data

        if has_request_context() and request.args.get(param):
            return request.args.get(param, default)

        form_data, _ = get_form_data()
        url_params = form_data.get("url_params") or {}
        result = url_params.get(param, default)
        if result and escape_result and self.dialect:
            # use the dialect specific quoting logic to escape string
            result = String().literal_processor(dialect=self.dialect)(value=result)[
                1:-1
            ]
        if add_to_cache_keys:
            self.cache_key_wrapper(result)
        return result

    def filter_values(
        self, column: str, default: Optional[str] = None, remove_filter: bool = False
    ) -> list[Any]:
        """Gets a values for a particular filter as a list

        This is useful if:
            - you want to use a filter component to filter a query where the name of
             filter component column doesn't match the one in the select statement
            - you want to have the ability for filter inside the main query for speed
            purposes

        Usage example::

            SELECT action, count(*) as times
            FROM logs
            WHERE
                action in ({{ "'" + "','".join(filter_values('action_type')) + "'" }})
            GROUP BY action

        :param column: column/filter name to lookup
        :param default: default value to return if there's no matching columns
        :param remove_filter: When set to true, mark the filter as processed,
            removing it from the outer query. Useful when a filter should
            only apply to the inner query
        :return: returns a list of filter values
        """
        return_val: list[Any] = []
        filters = self.get_filters(column, remove_filter)
        for flt in filters:
            val = flt.get("val")
            if isinstance(val, list):
                return_val.extend(val)
            elif val:
                return_val.append(val)

        if (not return_val) and default:
            # If no values are found, return the default provided.
            return_val = [default]

        return return_val

    def get_filters(self, column: str, remove_filter: bool = False) -> list[Filter]:
        """Get the filters applied to the given column. In addition
           to returning values like the filter_values function
           the get_filters function returns the operator specified in the explorer UI.

        This is useful if:
            - you want to handle more than the IN operator in your SQL clause
            - you want to handle generating custom SQL conditions for a filter
            - you want to have the ability for filter inside the main query for speed
            purposes

        Usage example::


            WITH RECURSIVE
                superiors(employee_id, manager_id, full_name, level, lineage) AS (
                SELECT
                    employee_id,
                    manager_id,
                    full_name,
                1 as level,
                employee_id as lineage
                FROM
                    employees
                WHERE
                1=1
                {# Render a blank line #}
                {%- for filter in get_filters('full_name', remove_filter=True) -%}
                {%- if filter.get('op') == 'IN' -%}
                    AND
                    full_name IN ( {{ "'" + "', '".join(filter.get('val')) + "'" }} )
                {%- endif -%}
                {%- if filter.get('op') == 'LIKE' -%}
                    AND
                    full_name LIKE {{ "'" + filter.get('val') + "'" }}
                {%- endif -%}
                {%- endfor -%}
                UNION ALL
                    SELECT
                        e.employee_id,
                        e.manager_id,
                        e.full_name,
                s.level + 1 as level,
                s.lineage
                    FROM
                        employees e,
                    superiors s
                    WHERE s.manager_id = e.employee_id
            )


            SELECT
                employee_id, manager_id, full_name, level, lineage
            FROM
                superiors
            order by lineage, level

        :param column: column/filter name to lookup
        :param remove_filter: When set to true, mark the filter as processed,
            removing it from the outer query. Useful when a filter should
            only apply to the inner query
        :return: returns a list of filters
        """
        # pylint: disable=import-outside-toplevel
        from superset.utils.core import FilterOperator
        from superset.views.utils import get_form_data

        form_data, _ = get_form_data()
        convert_legacy_filters_into_adhoc(form_data)
        merge_extra_filters(form_data)

        filters: list[Filter] = []

        for flt in form_data.get("adhoc_filters", []):
            val: Union[Any, list[Any]] = flt.get("comparator")
            op: str = flt["operator"].upper() if flt.get("operator") else None
            # fltOpName: str = flt.get("filterOptionName")
            if (
                flt.get("expressionType") == "SIMPLE"
                and flt.get("clause") == "WHERE"
                and flt.get("subject") == column
                and val
            ):
                if remove_filter:
                    if column not in self.removed_filters:
                        self.removed_filters.append(column)
                if column not in self.applied_filters:
                    self.applied_filters.append(column)

                if op in (
                    FilterOperator.IN.value,
                    FilterOperator.NOT_IN.value,
                ) and not isinstance(val, list):
                    val = [val]

                filters.append({"op": op, "col": column, "val": val})

        return filters


def safe_proxy(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    return_value = func(*args, **kwargs)
    value_type = type(return_value).__name__
    if value_type not in ALLOWED_TYPES:
        raise SupersetTemplateException(
            _(
                "Unsafe return type for function %(func)s: %(value_type)s",
                func=func.__name__,
                value_type=value_type,
            )
        )
    if value_type in COLLECTION_TYPES:
        try:
            return_value = json.loads(json.dumps(return_value))
        except TypeError as ex:
            raise SupersetTemplateException(
                _(
                    "Unsupported return value for method %(name)s",
                    name=func.__name__,
                )
            ) from ex

    return return_value


def validate_context_types(context: dict[str, Any]) -> dict[str, Any]:
    for key in context:
        arg_type = type(context[key]).__name__
        if arg_type not in ALLOWED_TYPES and key not in context_addons():
            if arg_type == "partial" and context[key].func.__name__ == "safe_proxy":
                continue
            raise SupersetTemplateException(
                _(
                    "Unsafe template value for key %(key)s: %(value_type)s",
                    key=key,
                    value_type=arg_type,
                )
            )
        if arg_type in COLLECTION_TYPES:
            try:
                context[key] = json.loads(json.dumps(context[key]))
            except TypeError as ex:
                raise SupersetTemplateException(
                    _("Unsupported template value for key %(key)s", key=key)
                ) from ex

    return context


def validate_template_context(
    engine: Optional[str], context: dict[str, Any]
) -> dict[str, Any]:
    if engine and engine in context:
        # validate engine context separately to allow for engine-specific methods
        engine_context = validate_context_types(context.pop(engine))
        valid_context = validate_context_types(context)
        valid_context[engine] = engine_context
        return valid_context

    return validate_context_types(context)


class WhereInMacro:  # pylint: disable=too-few-public-methods
    def __init__(self, dialect: Dialect):
        self.dialect = dialect

    def __call__(self, values: list[Any], mark: Optional[str] = None) -> str:
        """
        Given a list of values, build a parenthesis list suitable for an IN expression.

            >>> from sqlalchemy.dialects import mysql
            >>> where_in = WhereInMacro(dialect=mysql.dialect())
            >>> where_in([1, "Joe's", 3])
            (1, 'Joe''s', 3)

        """
        binds = [bindparam(f"value_{i}", value) for i, value in enumerate(values)]
        string_representations = [
            str(
                bind.compile(
                    dialect=self.dialect, compile_kwargs={"literal_binds": True}
                )
            )
            for bind in binds
        ]
        joined_values = ", ".join(string_representations)
        result = f"({joined_values})"

        if mark:
            result += (
                "\n-- WARNING: the `mark` parameter was removed from the `where_in` "
                "macro for security reasons\n"
            )

        return result


class BaseTemplateProcessor:
    """
    Base class for database-specific jinja context
    """

    engine: Optional[str] = None

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        database: "Database",
        query: Optional["Query"] = None,
        table: Optional["SqlaTable"] = None,
        extra_cache_keys: Optional[list[Any]] = None,
        removed_filters: Optional[list[str]] = None,
        applied_filters: Optional[list[str]] = None,
        **kwargs: Any,
    ) -> None:
        self._database = database
        self._query = query
        self._schema = None
        if query and query.schema:
            self._schema = query.schema
        elif table:
            self._schema = table.schema
        self._extra_cache_keys = extra_cache_keys
        self._applied_filters = applied_filters
        self._removed_filters = removed_filters
        self._context: dict[str, Any] = {}
        self.env: Environment = SandboxedEnvironment(undefined=DebugUndefined)
        self.set_context(**kwargs)

        # custom filters
        self.env.filters["where_in"] = WhereInMacro(database.get_dialect())

    def set_context(self, **kwargs: Any) -> None:
        self._context.update(kwargs)
        self._context.update(context_addons())

    def process_template(self, sql: str, **kwargs: Any) -> str:
        """Processes a sql template

        >>> sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        >>> process_template(sql)
        "SELECT '2017-01-01T00:00:00'"
        """
        template = self.env.from_string(sql)
        kwargs.update(self._context)

        context = validate_template_context(self.engine, kwargs)
        return template.render(context)


class JinjaTemplateProcessor(BaseTemplateProcessor):
    def _parse_datetime(self, dttm: str) -> Optional[datetime]:
        """
        Try to parse a datetime and default to None in the worst case.

        Since this may have been rendered by different engines, the datetime may
        vary slightly in format. We try to make it consistent, and if all else
        fails, just return None.
        """
        try:
            return dateutil.parser.parse(dttm)
        except dateutil.parser.ParserError:
            return None

    def set_context(self, **kwargs: Any) -> None:
        super().set_context(**kwargs)
        extra_cache = ExtraCache(
            extra_cache_keys=self._extra_cache_keys,
            applied_filters=self._applied_filters,
            removed_filters=self._removed_filters,
            dialect=self._database.get_dialect(),
        )

        from_dttm = (
            self._parse_datetime(dttm)
            if (dttm := self._context.get("from_dttm"))
            else None
        )
        to_dttm = (
            self._parse_datetime(dttm)
            if (dttm := self._context.get("to_dttm"))
            else None
        )

        dataset_macro_with_context = partial(
            dataset_macro,
            from_dttm=from_dttm,
            to_dttm=to_dttm,
        )
        self._context.update(
            {
                "url_param": partial(safe_proxy, extra_cache.url_param),
                "current_user_id": partial(safe_proxy, extra_cache.current_user_id),
                "current_username": partial(safe_proxy, extra_cache.current_username),
                "current_user_email": partial(
                    safe_proxy, extra_cache.current_user_email
                ),
                "cache_key_wrapper": partial(safe_proxy, extra_cache.cache_key_wrapper),
                "filter_values": partial(safe_proxy, extra_cache.filter_values),
                "get_filters": partial(safe_proxy, extra_cache.get_filters),
                "dataset": partial(safe_proxy, dataset_macro_with_context),
                "metric": partial(safe_proxy, metric_macro),
            }
        )


class NoOpTemplateProcessor(BaseTemplateProcessor):
    def process_template(self, sql: str, **kwargs: Any) -> str:
        """
        Makes processing a template a noop
        """
        return str(sql)


class PrestoTemplateProcessor(JinjaTemplateProcessor):
    """Presto Jinja context

    The methods described here are namespaced under ``presto`` in the
    jinja context as in ``SELECT '{{ presto.some_macro_call() }}'``
    """

    engine = "presto"

    def set_context(self, **kwargs: Any) -> None:
        super().set_context(**kwargs)
        self._context[self.engine] = {
            "first_latest_partition": partial(safe_proxy, self.first_latest_partition),
            "latest_partitions": partial(safe_proxy, self.latest_partitions),
            "latest_sub_partition": partial(safe_proxy, self.latest_sub_partition),
            "latest_partition": partial(safe_proxy, self.latest_partition),
        }

    @staticmethod
    def _schema_table(
        table_name: str, schema: Optional[str]
    ) -> tuple[str, Optional[str]]:
        if "." in table_name:
            schema, table_name = table_name.split(".")
        return table_name, schema

    def first_latest_partition(self, table_name: str) -> Optional[str]:
        """
        Gets the first value in the array of all latest partitions

        :param table_name: table name in the format `schema.table`
        :return: the first (or only) value in the latest partition array
        :raises IndexError: If no partition exists
        """

        latest_partitions = self.latest_partitions(table_name)
        return latest_partitions[0] if latest_partitions else None

    def latest_partitions(self, table_name: str) -> Optional[list[str]]:
        """
        Gets the array of all latest partitions

        :param table_name: table name in the format `schema.table`
        :return: the latest partition array
        """

        # pylint: disable=import-outside-toplevel
        from superset.db_engine_specs.presto import PrestoEngineSpec

        table_name, schema = self._schema_table(table_name, self._schema)
        return cast(PrestoEngineSpec, self._database.db_engine_spec).latest_partition(
            database=self._database, table=Table(table_name, schema)
        )[1]

    def latest_sub_partition(self, table_name: str, **kwargs: Any) -> Any:
        table_name, schema = self._schema_table(table_name, self._schema)

        # pylint: disable=import-outside-toplevel
        from superset.db_engine_specs.presto import PrestoEngineSpec

        return cast(
            PrestoEngineSpec, self._database.db_engine_spec
        ).latest_sub_partition(
            database=self._database, table=Table(table_name, schema), **kwargs
        )

    latest_partition = first_latest_partition


class HiveTemplateProcessor(PrestoTemplateProcessor):
    engine = "hive"


class SparkTemplateProcessor(HiveTemplateProcessor):
    engine = "spark"

    def process_template(self, sql: str, **kwargs: Any) -> str:
        template = self.env.from_string(sql)
        kwargs.update(self._context)

        # Backwards compatibility if migrating from Hive.
        context = validate_template_context(self.engine, kwargs)
        context["hive"] = context["spark"]
        return template.render(context)


class TrinoTemplateProcessor(PrestoTemplateProcessor):
    engine = "trino"

    def process_template(self, sql: str, **kwargs: Any) -> str:
        template = self.env.from_string(sql)
        kwargs.update(self._context)

        # Backwards compatibility if migrating from Presto.
        context = validate_template_context(self.engine, kwargs)
        context["presto"] = context["trino"]
        return template.render(context)


DEFAULT_PROCESSORS = {
    "presto": PrestoTemplateProcessor,
    "hive": HiveTemplateProcessor,
    "spark": SparkTemplateProcessor,
    "trino": TrinoTemplateProcessor,
}


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def get_template_processors() -> dict[str, Any]:
    processors = current_app.config.get("CUSTOM_TEMPLATE_PROCESSORS", {})
    for engine, processor in DEFAULT_PROCESSORS.items():
        # do not overwrite engine-specific CUSTOM_TEMPLATE_PROCESSORS
        if engine not in processors:
            processors[engine] = processor

    return processors


def get_template_processor(
    database: "Database",
    table: Optional["SqlaTable"] = None,
    query: Optional["Query"] = None,
    **kwargs: Any,
) -> BaseTemplateProcessor:
    if feature_flag_manager.is_feature_enabled("ENABLE_TEMPLATE_PROCESSING"):
        template_processor = get_template_processors().get(
            database.backend, JinjaTemplateProcessor
        )
    else:
        template_processor = NoOpTemplateProcessor
    return template_processor(database=database, table=table, query=query, **kwargs)


def dataset_macro(
    dataset_id: int,
    include_metrics: bool = False,
    columns: Optional[list[str]] = None,
    from_dttm: Optional[datetime] = None,
    to_dttm: Optional[datetime] = None,
) -> str:
    """
    Given a dataset ID, return the SQL that represents it.

    The generated SQL includes all columns (including computed) by default. Optionally
    the user can also request metrics to be included, and columns to group by.

    The from_dttm and to_dttm parameters are filled in from filter values in explore
    views, and we take them to make those properties available to jinja templates in
    the underlying dataset.
    """
    # pylint: disable=import-outside-toplevel
    from superset.daos.dataset import DatasetDAO

    dataset = DatasetDAO.find_by_id(dataset_id)
    if not dataset:
        raise DatasetNotFoundError(f"Dataset {dataset_id} not found!")

    columns = columns or [column.column_name for column in dataset.columns]
    metrics = [metric.metric_name for metric in dataset.metrics]
    query_obj = {
        "is_timeseries": False,
        "filter": [],
        "metrics": metrics if include_metrics else None,
        "columns": columns,
        "from_dttm": from_dttm,
        "to_dttm": to_dttm,
    }
    sqla_query = dataset.get_query_str_extended(query_obj, mutate=False)
    sql = sqla_query.sql
    return f"(\n{sql}\n) AS dataset_{dataset_id}"


def get_dataset_id_from_context(metric_key: str) -> int:
    """
    Retrives the Dataset ID from the request context.

    :param metric_key: the metric key.
    :returns: the dataset ID.
    """
    # pylint: disable=import-outside-toplevel
    from superset.daos.chart import ChartDAO
    from superset.views.utils import get_form_data

    exc_message = _(
        "Please specify the Dataset ID for the ``%(name)s`` metric in the Jinja macro.",
        name=metric_key,
    )

    form_data, chart = get_form_data()
    if not (form_data or chart):
        raise SupersetTemplateException(exc_message)

    if chart and chart.datasource_id:
        return chart.datasource_id
    if dataset_id := form_data.get("url_params", {}).get("datasource_id"):
        return dataset_id
    if chart_id := (
        form_data.get("slice_id") or form_data.get("url_params", {}).get("slice_id")
    ):
        chart_data = ChartDAO.find_by_id(chart_id)
        if not chart_data:
            raise SupersetTemplateException(exc_message)
        return chart_data.datasource_id
    raise SupersetTemplateException(exc_message)


def metric_macro(metric_key: str, dataset_id: Optional[int] = None) -> str:
    """
    Given a metric key, returns its syntax.

    The ``dataset_id`` is optional and if not specified, will be retrieved
    from the request context (if available).

    :param metric_key: the metric key.
    :param dataset_id: the ID for the dataset the metric is associated with.
    :returns: the macro SQL syntax.
    """
    # pylint: disable=import-outside-toplevel
    from superset.daos.dataset import DatasetDAO

    if not dataset_id:
        dataset_id = get_dataset_id_from_context(metric_key)

    dataset = DatasetDAO.find_by_id(dataset_id)
    if not dataset:
        raise DatasetNotFoundError(f"Dataset ID {dataset_id} not found.")
    metrics: dict[str, str] = {
        metric.metric_name: metric.expression for metric in dataset.metrics
    }
    dataset_name = dataset.table_name
    if metric := metrics.get(metric_key):
        return metric
    raise SupersetTemplateException(
        _(
            "Metric ``%(metric_name)s`` not found in %(dataset_name)s.",
            metric_name=metric_key,
            dataset_name=dataset_name,
        )
    )
