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

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache, partial
from typing import Any, Callable, cast, TYPE_CHECKING, TypedDict, Union

import dateutil
from flask import current_app, g, has_request_context, request
from flask_babel import gettext as _
from jinja2 import DebugUndefined, Environment
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.sql.expression import bindparam
from sqlalchemy.types import String

from superset import security_manager
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.constants import LRU_CACHE_MAX_SIZE, NO_TIME_RANGE
from superset.exceptions import SupersetTemplateException
from superset.extensions import feature_flag_manager
from superset.sql.parse import Table
from superset.utils import json
from superset.utils.core import (
    AdhocFilterClause,
    convert_legacy_filters_into_adhoc,
    FilterOperator,
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
    "TimeFilter",
)
COLLECTION_TYPES = ("list", "dict", "tuple", "set")

# Type alias for JSON-native types
JsonValue = Union[
    str, int, float, bool, list["JsonValue"], dict[str, "JsonValue"], None
]


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def context_addons() -> dict[str, Any]:
    return current_app.config.get("JINJA_CONTEXT_ADDONS", {})


class Filter(TypedDict):
    op: str  # pylint: disable=C0103
    col: str
    val: Union[None, Any, list[Any]]


@dataclass
class TimeFilter:
    """
    Container for temporal filter.
    """

    from_expr: str | None
    to_expr: str | None
    time_range: str | None


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
        r"current_user_rls_rules\([^()]*\)|"
        r"current_user_roles\([^()]*\)|"
        r"cache_key_wrapper\([^()]*\)|"
        r"url_param\([^()]*\)|"
        r"get_guest_user_attribute\([^()]*\)|"
        r")"
        r"[^{}]*?(\}\}|\%\})"
    )

    def __init__(  # pylint: disable=too-many-arguments
        self,
        extra_cache_keys: list[Any] | None = None,
        applied_filters: list[str] | None = None,
        removed_filters: list[str] | None = None,
        database: Database | None = None,
        dialect: Dialect | None = None,
        table: SqlaTable | None = None,
    ):
        self.extra_cache_keys = extra_cache_keys
        self.applied_filters = applied_filters if applied_filters is not None else []
        self.removed_filters = removed_filters if removed_filters is not None else []
        self.database = database
        self.dialect = dialect
        self.table = table

    def current_user_id(self, add_to_cache_keys: bool = True) -> int | None:
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

    def current_username(self, add_to_cache_keys: bool = True) -> str | None:
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

    def current_user_email(self, add_to_cache_keys: bool = True) -> str | None:
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

    def current_user_roles(self, add_to_cache_keys: bool = True) -> list[str] | None:
        """
        Return the sorted list of roles of the user who is currently logged in.

        :param add_to_cache_keys: Whether the value should be included in the cache key
        :returns: List of role names
        """
        try:
            user_roles = sorted(
                [role.name for role in security_manager.get_user_roles()]
            )
            if not user_roles:
                return None
            if add_to_cache_keys:
                self.cache_key_wrapper(json.dumps(user_roles))
            return user_roles
        except Exception:  # pylint: disable=broad-except
            return None

    def current_user_rls_rules(self) -> list[str] | None:
        """
        Return the row level security rules applied to the current user and dataset.
        """
        if not self.table:
            return None

        rls_rules = (
            sorted(
                [
                    rule["clause"]
                    for rule in security_manager.get_guest_rls_filters(self.table)
                ]
            )
            if security_manager.is_guest_user()
            else sorted(
                [rule.clause for rule in security_manager.get_rls_filters(self.table)]
            )
        )
        if not rls_rules:
            return None

        self.cache_key_wrapper(json.dumps(rls_rules))
        return rls_rules

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
        default: str | None = None,
        add_to_cache_keys: bool = True,
        escape_result: bool = True,
    ) -> str | None:
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

    def get_guest_user_attribute(
        self,
        attribute_name: str,
        default: JsonValue = None,
        add_to_cache_keys: bool = True,
    ) -> JsonValue:
        """
        Get a specific user attribute from guest user.

        This function retrieves attributes from the guest user token and supports
        all JSON-native types (string, number, boolean, array, object, null).

        Args:
            attribute_name: Name of the attribute to retrieve
            default: Default value if attribute not found (can be any JSON-native type)
            add_to_cache_keys: Whether the value should be included in the cache key

        Returns:
            The attribute value from the guest user token, or the default value.
            Can be any JSON-native type: string, number, boolean, array, object, or
            null.

        Examples:
            {{ get_guest_user_attribute('department') }}  # Returns: "Engineering"
            {{ get_guest_user_attribute('is_admin') }}    # Returns: True
            {{ get_guest_user_attribute('permissions') }} # Returns: ["read", "write"]
            {{ get_guest_user_attribute('config') }}      # Returns: {"theme": "dark"}
            {{ get_guest_user_attribute('missing', 'default') }} # Returns: "default"
        """

        # Check if we have a request context and user
        if not has_request_context():
            return default

        if not hasattr(g, "user") or g.user is None:
            return default

        user = g.user

        # Check if current user is a guest user
        if not (hasattr(user, "is_guest_user") and user.is_guest_user):
            return default

        # Get attributes from guest token
        if hasattr(user, "guest_token") and user.guest_token:
            token = user.guest_token
            token_user = token.get("user", {})
            user_attributes = token_user.get("attributes") or {}

            # Only add to cache key if the variable actually exists in guest token
            if attribute_name in user_attributes:
                result = user_attributes[attribute_name]
                if add_to_cache_keys and result is not None:
                    # Use json.dumps for consistent serialization of all types
                    cache_value = json.dumps(result, sort_keys=True)
                    self.cache_key_wrapper(
                        f"guest_user_attribute:{attribute_name}:{cache_value}"
                    )
                return result
            else:
                return default

        return default

    def filter_values(
        self, column: str, default: str | None = None, remove_filter: bool = False
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
        from superset.views.utils import get_form_data

        form_data, _ = get_form_data()
        convert_legacy_filters_into_adhoc(form_data)
        merge_extra_filters(form_data)

        filters: list[Filter] = []

        for flt in form_data.get("adhoc_filters", []):
            val: Union[Any, list[Any]] = flt.get("comparator")
            op: str = flt["operator"].upper() if flt.get("operator") else None  # type: ignore
            if (
                flt.get("expressionType") == "SIMPLE"
                and flt.get("clause") == "WHERE"
                and flt.get("subject") == column
                and (
                    val
                    # IS_NULL and IS_NOT_NULL operators do not have a value
                    or op
                    in (
                        FilterOperator.IS_NULL.value,
                        FilterOperator.IS_NOT_NULL.value,
                    )
                )
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

    # pylint: disable=too-many-arguments
    def get_time_filter(
        self,
        column: str | None = None,
        default: str | None = None,
        target_type: str | None = None,
        strftime: str | None = None,
        remove_filter: bool = False,
    ) -> TimeFilter:
        """Get the time filter with appropriate formatting,
        either for a specific column, or whichever time range is being emitted
        from a dashboard.

        :param column: Name of the temporal column. Leave undefined to reference the
            time range from a Dashboard Native Time Range filter (when present).
        :param default: The default value to fall back to if the time filter is
            not present, or has the value `No filter`
        :param target_type: The target temporal type as recognized by the target
            database (e.g. `TIMESTAMP`, `DATE` or `DATETIME`). If `column` is defined,
            the format will default to the type of the column. This is used to produce
            the format of the `from_expr` and `to_expr` properties of the returned
            `TimeFilter` object.
        :param strftime: format using the `strftime` method of `datetime`. When defined
            `target_type` will be ignored.
        :param remove_filter: When set to true, mark the filter as processed,
            removing it from the outer query. Useful when a filter should
            only apply to the inner query.
        :return: The corresponding time filter.
        """
        # pylint: disable=import-outside-toplevel
        from superset.views.utils import get_form_data

        form_data, _ = get_form_data()
        convert_legacy_filters_into_adhoc(form_data)
        merge_extra_filters(form_data)
        time_range = form_data.get("time_range")
        if column:
            flt: AdhocFilterClause | None = next(
                (
                    flt
                    for flt in form_data.get("adhoc_filters", [])
                    if flt["operator"] == FilterOperator.TEMPORAL_RANGE
                    and flt["subject"] == column
                ),
                None,
            )
            if flt:
                if remove_filter:
                    if column not in self.removed_filters:
                        self.removed_filters.append(column)
                if column not in self.applied_filters:
                    self.applied_filters.append(column)

                time_range = cast(str, flt["comparator"])
                if not target_type and self.table:
                    target_type = self.table.columns_types.get(column)

        time_range = time_range or NO_TIME_RANGE
        if time_range == NO_TIME_RANGE and default:
            time_range = default
        from_expr, to_expr = get_since_until_from_time_range(time_range)

        def _format_dttm(dttm: datetime | None) -> str | None:
            if strftime and dttm:
                return dttm.strftime(strftime)
            return (
                self.database.db_engine_spec.convert_dttm(target_type or "", dttm)
                if self.database and dttm
                else None
            )

        return TimeFilter(
            from_expr=_format_dttm(from_expr),
            to_expr=_format_dttm(to_expr),
            time_range=time_range,
        )


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
    engine: str | None, context: dict[str, Any]
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

    def __call__(
        self,
        values: list[Any],
        mark: str | None = None,
        default_to_none: bool = False,
    ) -> str | None:
        """
        Given a list of values, build a parenthesis list suitable for an IN expression.

            >>> from sqlalchemy.dialects import mysql
            >>> where_in = WhereInMacro(dialect=mysql.dialect())
            >>> where_in([1, "Joe's", 3])
            (1, 'Joe''s', 3)

        The `default_to_none` parameter is used to determine the return value when the
        list of values is empty:
            - If `default_to_none` is `False` (default), the return value is ().
            - If `default_to_none` is `True`, the return value is `None`.
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
        result = (
            f"({joined_values})" if (joined_values or not default_to_none) else None
        )

        if mark and result:
            result += (
                "\n-- WARNING: the `mark` parameter was removed from the `where_in` "
                "macro for security reasons\n"
            )

        return result


def to_datetime(
    value: str | None, format: str = "%Y-%m-%d %H:%M:%S"
) -> datetime | None:
    """
    Parses a string into a datetime object.

    :param value: the string to parse.
    :param format: the format to parse the string with.
    :returns: the parsed datetime object.
    """
    if not value:
        return None

    # This value might come from a macro that could be including wrapping quotes
    value = value.strip("'\"")
    return datetime.strptime(value, format)


class BaseTemplateProcessor:
    """
    Base class for database-specific jinja context
    """

    engine: str | None = None

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        database: "Database",
        query: "Query" | None = None,
        table: "SqlaTable" | None = None,
        extra_cache_keys: list[Any] | None = None,
        removed_filters: list[str] | None = None,
        applied_filters: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        self._database = database
        self._query = query
        self._schema = None
        if query and query.schema:
            self._schema = query.schema
        elif table:
            self._schema = table.schema
        self._table = table
        self._extra_cache_keys = extra_cache_keys
        self._applied_filters = applied_filters
        self._removed_filters = removed_filters
        self._context: dict[str, Any] = {}
        self.env: Environment = SandboxedEnvironment(undefined=DebugUndefined)
        self.set_context(**kwargs)

        # custom filters
        self.env.filters["where_in"] = WhereInMacro(database.get_dialect())
        self.env.filters["to_datetime"] = to_datetime

    def set_context(self, **kwargs: Any) -> None:
        self._context.update(kwargs)
        self._context.update(context_addons())

    def get_context(self) -> dict[str, Any]:
        """
        Returns the current template context.
        """
        return self._context.copy()

    def process_template(self, sql: str, **kwargs: Any) -> str:
        """Processes a sql template

        >>> sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        >>> process_template(sql)
        "SELECT '2017-01-01T00:00:00'"
        """
        template = self.env.from_string(sql)
        kwargs.update(self._context)

        context = validate_template_context(self.engine, kwargs)
        try:
            return template.render(context)
        except RecursionError as ex:
            raise SupersetTemplateException(
                "Infinite recursion detected in template"
            ) from ex


class JinjaTemplateProcessor(BaseTemplateProcessor):
    def _parse_datetime(self, dttm: str) -> datetime | None:
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
            database=self._database,
            dialect=self._database.get_dialect(),
            table=self._table,
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
                "current_user_roles": partial(
                    safe_proxy, extra_cache.current_user_roles
                ),
                "current_user_rls_rules": partial(
                    safe_proxy, extra_cache.current_user_rls_rules
                ),
                "cache_key_wrapper": partial(safe_proxy, extra_cache.cache_key_wrapper),
                "filter_values": partial(safe_proxy, extra_cache.filter_values),
                "get_filters": partial(safe_proxy, extra_cache.get_filters),
                "dataset": partial(safe_proxy, dataset_macro_with_context),
                "get_time_filter": partial(safe_proxy, extra_cache.get_time_filter),
                "get_guest_user_attribute": partial(
                    safe_proxy, extra_cache.get_guest_user_attribute
                ),
            }
        )

        # The `metric` filter needs the full context, in order to expand other filters
        self._context["metric"] = partial(
            safe_proxy,
            metric_macro,
            self.env,
            self._context,
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
    def _schema_table(table_name: str, schema: str | None) -> tuple[str, str | None]:
        if "." in table_name:
            schema, table_name = table_name.split(".")
        return table_name, schema

    def first_latest_partition(self, table_name: str) -> str | None:
        """
        Gets the first value in the array of all latest partitions

        :param table_name: table name in the format `schema.table`
        :return: the first (or only) value in the latest partition array
        :raises IndexError: If no partition exists
        """

        latest_partitions = self.latest_partitions(table_name)
        return latest_partitions[0] if latest_partitions else None

    def latest_partitions(self, table_name: str) -> list[str] | None:
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
    table: "SqlaTable" | None = None,
    query: "Query" | None = None,
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
    columns: list[str] | None = None,
    from_dttm: datetime | None = None,
    to_dttm: datetime | None = None,
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
    Retrieves the Dataset ID from the request context.

    :param metric_key: the metric key.
    :returns: the dataset ID.
    """
    # pylint: disable=import-outside-toplevel
    from superset.daos.chart import ChartDAO
    from superset.views.utils import loads_request_json

    form_data: dict[str, Any] = {}
    exc_message = _(
        "Please specify the Dataset ID for the ``%(name)s`` metric in the Jinja macro.",
        name=metric_key,
    )

    if has_request_context():
        if payload := request.get_json(cache=True) if request.is_json else None:
            if dataset_id := payload.get("datasource", {}).get("id"):
                return dataset_id
            form_data.update(payload.get("form_data", {}))
        request_form = loads_request_json(request.form.get("form_data"))
        form_data.update(request_form)
        request_args = loads_request_json(request.args.get("form_data"))
        form_data.update(request_args)

    if form_data := (form_data or getattr(g, "form_data", {})):
        if datasource_info := form_data.get("datasource"):
            if isinstance(datasource_info, dict):
                return datasource_info["id"]
            return datasource_info.split("__")[0]
        url_params = form_data.get("queries", [{}])[0].get("url_params", {})
        if dataset_id := url_params.get("datasource_id"):
            return dataset_id
        if chart_id := (form_data.get("slice_id") or url_params.get("slice_id")):
            chart_data = ChartDAO.find_by_id(chart_id)
            if not chart_data:
                raise SupersetTemplateException(exc_message)
            return chart_data.datasource_id

    raise SupersetTemplateException(exc_message)


def metric_macro(
    env: Environment,
    context: dict[str, Any],
    metric_key: str,
    dataset_id: int | None = None,
) -> str:
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
    if metric_key not in metrics:
        raise SupersetTemplateException(
            _(
                "Metric ``%(metric_name)s`` not found in %(dataset_name)s.",
                metric_name=metric_key,
                dataset_name=dataset.table_name,
            )
        )

    definition = metrics[metric_key]
    template = env.from_string(definition)
    definition = template.render(context)

    return definition
