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
"""
Source-data freshness ("Data as of") for datasets.

A dataset declares, in ``extra["freshness"]``, where the age of its source data
lives -- either a ``column`` holding a load timestamp (Superset runs
``SELECT MAX(column)`` over the dataset) or a ``sql`` query returning a single
timestamp. Dashboards roll the answers up and show the oldest one.

Two gates protect ``sql`` mode, because it lets a dataset editor make Superset
run SQL for every viewer of the dataset:

* when the setting is saved, imported or copied, the author must be able to
  read everything the SQL reads (:func:`validate_freshness_extra`), the same bar
  a virtual dataset's SQL is held to;
* when it runs, the viewer's row level security is injected into the tables the
  SQL reads (:func:`get_dataset_freshness`), as SQL Lab does.

A ``column`` must be a time column (marked temporal, or given a datetime
format). An answer that is not a timestamp hides the label instead of showing a
made-up time: numbers are read as epochs only when the column's format says so,
and a ``sql`` query must return exactly one row with one column.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, TYPE_CHECKING

import numpy as np
import pandas as pd
import sqlalchemy as sa
from flask import current_app as app
from flask_babel import gettext as _
from marshmallow import fields, RAISE, Schema, validates_schema, ValidationError
from marshmallow.validate import Length, Range

from superset import security_manager
from superset.exceptions import SupersetParseError
from superset.extensions import cache_manager
from superset.sql.parse import SQLScript
from superset.utils import json
from superset.utils.cache import generate_cache_key
from superset.utils.cache_keys import add_impersonation_cache_key_if_needed

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)

FRESHNESS_EXTRA_KEY = "freshness"
CACHE_KEY_PREFIX = "data_freshness_"
# Bumped when the shape of a cached value changes.
CACHE_VERSION = 2
EPOCH_FORMATS = ("epoch_s", "epoch_ms")


class DatasetFreshnessSchema(Schema):
    """The ``extra["freshness"]`` object of a dataset."""

    class Meta:  # pylint: disable=too-few-public-methods
        unknown = RAISE

    column = fields.String(
        validate=Length(1, 255),
        metadata={"description": "Column whose maximum is the data timestamp"},
    )
    sql = fields.String(
        validate=Length(1, 10_000),
        metadata={"description": "Read-only query returning one timestamp"},
    )
    warn_after_minutes = fields.Integer(
        allow_none=True,
        strict=True,
        validate=Range(min=1),
        metadata={"description": "Age after which the data is shown as stale"},
    )

    @validates_schema
    def validate_mode(self, data: dict[str, Any], **kwargs: Any) -> None:
        if bool(data.get("column")) == bool(data.get("sql")):
            raise ValidationError(_("Set exactly one of `column` or `sql`."))


@dataclass(frozen=True)
class FreshnessConfig:
    """A validated freshness setting."""

    column: str | None = None
    sql: str | None = None
    warn_after_minutes: int | None = None


class FreshnessValidationError(ValidationError):
    """A freshness setting that cannot be stored."""

    def __init__(self, message: str | list[str] | dict[str, Any]) -> None:
        super().__init__({FRESHNESS_EXTRA_KEY: message}, field_name="extra")


def _extra_dict(extra: str | dict[str, Any] | None) -> dict[str, Any] | None:
    """``extra`` as a dict, or ``None`` when it is not a JSON object."""
    if isinstance(extra, dict):
        return extra
    if not extra:
        return {}
    try:
        value = json.loads(extra)
    except (TypeError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def parse_freshness_config(
    extra: str | dict[str, Any] | None,
) -> FreshnessConfig | None:
    """
    Read the freshness setting from a dataset's ``extra``.

    :raises FreshnessValidationError: if a setting is present but invalid
    :returns: the setting, or ``None`` when there is none
    """
    extra_dict = _extra_dict(extra)
    if not extra_dict or extra_dict.get(FRESHNESS_EXTRA_KEY) is None:
        return None
    raw = extra_dict[FRESHNESS_EXTRA_KEY]
    if not isinstance(raw, dict):
        raise FreshnessValidationError(_("Must be an object."))
    try:
        loaded = DatasetFreshnessSchema().load(raw)
    except ValidationError as ex:
        raise FreshnessValidationError(ex.messages) from ex
    return FreshnessConfig(**loaded)


def get_freshness_config(dataset: SqlaTable) -> FreshnessConfig | None:
    """The dataset's freshness setting, or ``None`` if it has none or it is invalid."""
    try:
        return parse_freshness_config(dataset.extra)
    except FreshnessValidationError:
        logger.debug("Ignoring invalid freshness setting on dataset %s", dataset.id)
        return None


def _stored_freshness_sql(extra: str | dict[str, Any] | None) -> str | None:
    try:
        config = parse_freshness_config(extra)
    except FreshnessValidationError:
        return None
    return config.sql if config else None


def is_time_column(is_dttm: Any, python_date_format: Any) -> bool:
    """Whether a column can hold a load timestamp: temporal, or given a format."""
    return bool(is_dttm) or bool(python_date_format)


def _dict_column_is_time(column: Mapping[str, Any], stored: Any) -> bool:
    def value(key: str) -> Any:
        return column[key] if key in column else getattr(stored, key, None)

    return is_time_column(value("is_dttm"), value("python_date_format"))


def freshness_time_columns(
    columns: Iterable[Any], existing: Iterable[Any] = ()
) -> dict[str, bool]:
    """
    Map each column name to whether it can hold a load timestamp.

    ``columns`` are column models or the dicts a request carries. A dict that
    leaves out ``is_dttm`` or ``python_date_format`` keeps the value of the
    ``existing`` column with the same ``id``, as the upsert that stores it does.
    """
    stored_by_id = {column.id: column for column in existing}
    result: dict[str, bool] = {}
    for column in columns:
        if isinstance(column, Mapping):
            stored = stored_by_id.get(column.get("id"))
            result[column["column_name"]] = _dict_column_is_time(column, stored)
        else:
            result[column.column_name] = is_time_column(
                column.is_dttm, column.python_date_format
            )
    return result


def _raise_for_statement_shape(script: SQLScript) -> None:
    """Allow exactly one read-only ``SELECT``."""
    if len(script.statements) != 1:
        raise FreshnessValidationError(
            {"sql": [_("The freshness query must be a single statement.")]}
        )
    statement = script.statements[0]
    if script.has_mutation() or not statement.is_select():
        raise FreshnessValidationError(
            {"sql": [_("The freshness query must be a read-only SELECT.")]}
        )


def _raise_for_disallowed_functions(script: SQLScript, database: Database) -> None:
    disallowed = app.config["DISALLOWED_SQL_FUNCTIONS"].get(
        database.db_engine_spec.engine, set()
    )
    if disallowed and script.check_functions_present(disallowed):
        raise FreshnessValidationError(
            {"sql": [_("The freshness query uses a function that is not allowed.")]}
        )


def authorize_freshness_sql(
    sql: str,
    *,
    database: Database,
    catalog: str | None,
    schema: str | None,
    template_params: dict[str, Any] | None,
) -> None:
    """
    Check that the current user may store ``sql`` as a freshness query.

    The query must be one read-only ``SELECT``, and the user needs real data
    access to every table it reads (editorship of a dataset is not enough),
    matching the check a virtual dataset's SQL gets when it is defined.

    :raises FreshnessValidationError: if the SQL is not an allowed statement
    :raises SupersetSecurityException: if the user can't read what it reads
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.dataset.exceptions import (
        get_template_render_error_msg,
        TEMPLATE_RENDER_ERRORS,
    )
    from superset.models.helpers import template_params_for_access_check
    from superset.sql.parse import process_jinja_sql

    params = template_params_for_access_check(template_params or {})
    try:
        script = process_jinja_sql(sql, database, params).script
    except SupersetParseError as ex:
        raise FreshnessValidationError(
            {"sql": [_("Invalid SQL: %(error)s", error=ex.error.message)]}
        ) from ex
    except TEMPLATE_RENDER_ERRORS as ex:
        raise FreshnessValidationError(
            {"sql": [get_template_render_error_msg(ex)]}
        ) from ex

    _raise_for_statement_shape(script)
    _raise_for_disallowed_functions(script, database)
    try:
        security_manager.raise_for_access(
            database=database,
            sql=sql,
            catalog=catalog or None,
            schema=schema or None,
            template_params=params,
            allow_editorship=False,
        )
    except SupersetParseError as ex:
        raise FreshnessValidationError(
            {"sql": [_("Invalid SQL: %(error)s", error=ex.error.message)]}
        ) from ex
    except TEMPLATE_RENDER_ERRORS as ex:
        raise FreshnessValidationError(
            {"sql": [get_template_render_error_msg(ex)]}
        ) from ex


def _raise_for_column(column: str, columns: Mapping[str, bool]) -> None:
    if column not in columns:
        raise FreshnessValidationError(
            {"column": [_("Column %(column)s does not exist.", column=column)]}
        )
    if not columns[column]:
        raise FreshnessValidationError(
            {
                "column": [
                    _(
                        "Column %(column)s is not a time column. Mark it as "
                        "temporal or set its datetime format.",
                        column=column,
                    )
                ]
            }
        )


def validate_freshness_extra(  # pylint: disable=too-many-arguments
    extra: str | dict[str, Any] | None,
    *,
    stored_extra: str | dict[str, Any] | None,
    columns: Mapping[str, bool],
    database: Database,
    catalog: str | None,
    schema: str | None,
    template_params: dict[str, Any] | None,
    binding_changed: bool,
) -> None:
    """
    Validate the freshness setting an update, import or copy is about to store.

    ``sql`` is re-authorized when it differs from the stored value or when
    ``binding_changed`` says the database, catalog, schema or template params
    it resolves against moved; an unchanged echo of the stored value is not.
    ``columns`` maps the dataset's column names to whether each is a time
    column (see :func:`freshness_time_columns`).

    :raises FreshnessValidationError: if the setting is invalid
    :raises SupersetSecurityException: if the user can't read what ``sql`` reads
    """
    config = parse_freshness_config(extra)
    if config is None:
        return

    if config.column is not None:
        _raise_for_column(config.column, columns)

    if config.sql is not None and (
        binding_changed or config.sql != _stored_freshness_sql(stored_extra)
    ):
        if template_params is None:
            # Fail closed: SQL rendered with params execution would read
            # differently can't be authorized.
            raise FreshnessValidationError(
                {"sql": [_("Template parameters must be a valid JSON object.")]}
            )
        authorize_freshness_sql(
            config.sql,
            database=database,
            catalog=catalog,
            schema=schema,
            template_params=template_params,
        )


def _unwrap_scalar(value: Any) -> Any:
    """Turn numpy scalars, which result sets hand back, into Python values."""
    if isinstance(value, np.datetime64):
        return pd.Timestamp(value)
    if isinstance(value, np.generic):
        return value.item()
    return value


def _parse_number(value: int | float, date_format: str | None) -> datetime | None:
    """
    A number is a timestamp only when the format says how to read it: an epoch
    (``epoch_s``/``epoch_ms``) or a ``strftime`` pattern such as ``%Y%m%d``.
    Anything else (a count, an amount, an id) is not a time.
    """
    if date_format in EPOCH_FORMATS:
        unit = "ms" if date_format == "epoch_ms" else "s"
        return pd.Timestamp(value, unit=unit, tz="UTC").to_pydatetime()
    if date_format:
        text = str(int(value)) if float(value).is_integer() else str(value)
        return datetime.strptime(text, date_format)
    return None


def _parse_datetime(value: Any, date_format: str | None) -> datetime | None:
    """Parse a scalar into a ``datetime``, naive or aware, or ``None``."""
    if isinstance(value, str) and date_format in EPOCH_FORMATS:
        value = float(value)
    if isinstance(value, (int, float)):
        return _parse_number(value, date_format)
    if isinstance(value, str):
        if date_format and date_format not in EPOCH_FORMATS:
            return datetime.strptime(value.strip(), date_format)
        return pd.Timestamp(value.strip()).to_pydatetime()
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day)
    return None


def to_utc_datetime(value: Any, date_format: str | None = None) -> datetime | None:
    """
    Normalize a freshness query result to an aware UTC ``datetime``.

    Accepts native timestamps and dates, strings (parsed with ``date_format``
    when it is a ``strftime`` pattern, else as ISO 8601) and numbers when
    ``date_format`` says how to read them (``epoch_s``, ``epoch_ms`` or a
    ``strftime`` pattern). Naive values are taken to be UTC. Anything else,
    including a bare number, gives ``None``.
    """
    value = _unwrap_scalar(value)
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        result = _parse_datetime(value, date_format)
    except (ValueError, TypeError, OverflowError, pd.errors.OutOfBoundsDatetime):
        return None
    if result is None or pd.isna(result):
        return None
    if result.tzinfo is None:
        result = result.replace(tzinfo=timezone.utc)
    return result.astimezone(timezone.utc)


def _column_sql(dataset: SqlaTable, column_name: str) -> str | None:
    """``SELECT MAX(column)`` over the dataset, with the viewer's RLS applied."""
    target = next(
        (col for col in dataset.columns if col.column_name == column_name), None
    )
    if target is None or not is_time_column(target.is_dttm, target.python_date_format):
        # The setting was valid when saved; the column was dropped or unmarked.
        logger.warning(
            "Dataset %s: freshness column %s is missing or not a time column",
            dataset.id,
            column_name,
        )
        return None
    template_processor = dataset.get_template_processor()
    from_clause, cte = dataset.get_from_clause(template_processor)
    query = sa.select(
        sa.func.max(target.get_sqla_col(template_processor=template_processor)).label(
            "data_as_of"
        )
    ).select_from(from_clause)
    if rls_filters := dataset.get_sqla_row_level_filters(
        template_processor=template_processor
    ):
        query = query.where(sa.and_(*rls_filters))

    database = dataset.database
    with database.get_sqla_engine(
        catalog=dataset.catalog, schema=dataset.schema
    ) as engine:
        sql = str(query.compile(engine, compile_kwargs={"literal_binds": True}))
        # pylint: disable=protected-access
        if engine.dialect.identifier_preparer._double_percents:
            sql = sql.replace("%%", "%")
    return dataset._apply_cte(sql, cte)  # pylint: disable=protected-access


def _query_sql(dataset: SqlaTable, sql: str) -> str | None:
    """The freshness query, rendered, checked and with the viewer's RLS applied."""
    # pylint: disable=import-outside-toplevel
    from superset.utils.rls import apply_rls, get_rls_schema

    database = dataset.database
    rendered = dataset.get_template_processor().process_template(sql)
    script = SQLScript(rendered, database.db_engine_spec.engine)
    try:
        # Stored settings were checked on save; re-check what actually runs,
        # since Jinja renders differently per request.
        _raise_for_statement_shape(script)
        _raise_for_disallowed_functions(script, database)
    except FreshnessValidationError:
        logger.warning(
            "Dataset %s: rendered freshness query is not one read-only SELECT",
            dataset.id,
        )
        return None

    statement = script.statements[0]
    rls_schema = get_rls_schema(database, dataset.catalog, dataset.schema, rendered)
    if apply_rls(database, dataset.catalog, rls_schema, statement):
        return statement.format()
    return rendered


def _freshness_sql(dataset: SqlaTable, config: FreshnessConfig) -> str | None:
    if config.column is not None:
        return _column_sql(dataset, config.column)
    if config.sql is not None:
        return _query_sql(dataset, config.sql)
    return None


def _date_format(dataset: SqlaTable, config: FreshnessConfig) -> str | None:
    if config.column is None:
        return None
    column = next(
        (col for col in dataset.columns if col.column_name == config.column), None
    )
    return column.python_date_format if column else None


def _is_missing(value: Any) -> bool:
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def _run_freshness_query(
    dataset: SqlaTable, sql: str, date_format: str | None
) -> datetime | None:
    """
    Run a freshness query and read its single cell as a timestamp.

    Problems an editor can fix (the query fails, returns the wrong shape or a
    value that isn't a time) are logged as warnings with the reason, so a label
    that never appears can be explained from the logs. No SQL or data is
    logged.
    """
    try:
        df = dataset.database.get_df(sql, dataset.catalog, dataset.schema)
    except Exception as ex:  # pylint: disable=broad-except
        logger.warning(
            "Dataset %s: freshness query failed (%s)", dataset.id, type(ex).__name__
        )
        logger.debug("Dataset %s: freshness query failed", dataset.id, exc_info=True)
        return None
    rows, cols = df.shape if df is not None else (0, 0)
    if rows == 0 or (rows == 1 and cols == 1 and _is_missing(df.iat[0, 0])):
        logger.info("Dataset %s: freshness query returned no value", dataset.id)
        return None
    if (rows, cols) != (1, 1):
        logger.warning(
            "Dataset %s: freshness query returned %s rows and %s columns; "
            "expected one row with one column",
            dataset.id,
            rows,
            cols,
        )
        return None
    raw = df.iat[0, 0]
    result = to_utc_datetime(raw, date_format)
    if result is None:
        logger.warning(
            "Dataset %s: freshness value of type %s is not a timestamp",
            dataset.id,
            type(_unwrap_scalar(raw)).__name__,
        )
    return result


def get_dataset_freshness(dataset: SqlaTable) -> datetime | None:
    """
    When the dataset's source data was last loaded, as an aware UTC datetime.

    Runs the dataset's freshness setting as the current user (so their row
    level security applies) and caches the answer in the data cache for
    ``DATA_FRESHNESS_CACHE_TIMEOUT`` seconds. The cache key is the SQL that
    actually runs, after Jinja and RLS: two users share an answer only when
    they would run identical SQL against the same connection.

    :returns: the timestamp, or ``None`` when there is no setting or no usable
        answer (no value, a value that isn't a time, a result that isn't one
        row with one column, or a failed query)
    """
    config = get_freshness_config(dataset)
    if config is None:
        return None

    database = dataset.database
    try:
        sql = _freshness_sql(dataset, config)
    except Exception as ex:  # pylint: disable=broad-except
        logger.warning(
            "Dataset %s: could not build freshness query (%s)",
            dataset.id,
            type(ex).__name__,
        )
        logger.debug(
            "Dataset %s: could not build freshness query", dataset.id, exc_info=True
        )
        return None
    if sql is None:
        return None

    cache_dict: dict[str, Any] = {
        "version": CACHE_VERSION,
        "database_id": database.id,
        "catalog": dataset.catalog,
        "schema": dataset.schema,
        "sql": sql,
    }
    add_impersonation_cache_key_if_needed(database, cache_dict)
    cache_key = generate_cache_key(cache_dict, CACHE_KEY_PREFIX)

    cached = cache_manager.data_cache.get(cache_key)
    if isinstance(cached, dict) and "data_as_of" in cached:
        value = cached["data_as_of"]
        return datetime.fromisoformat(value) if value else None

    result = _run_freshness_query(dataset, sql, _date_format(dataset, config))

    cache_manager.data_cache.set(
        cache_key,
        {"data_as_of": result.isoformat() if result else None},
        timeout=app.config["DATA_FRESHNESS_CACHE_TIMEOUT"],
    )
    return result


def is_stale(
    data_as_of: datetime | None,
    warn_after_minutes: int | None,
    now: datetime | None = None,
) -> bool:
    """Whether ``data_as_of`` is older than ``warn_after_minutes``."""
    if data_as_of is None or warn_after_minutes is None:
        return False
    now = now or datetime.now(timezone.utc)
    return (now - data_as_of).total_seconds() > warn_after_minutes * 60


def _can_read_freshness(dataset: SqlaTable, dashboard: Dashboard) -> bool:
    """Whether the current user may see ``dataset``'s freshness on ``dashboard``.

    The same grants that let them load the dataset's charts there: access to
    the dataset itself, or (for embedded guests and listed viewers in
    promiscuous mode) to the dashboard it is a member of.
    """
    return security_manager.can_access_datasource(
        dataset
    ) or security_manager.can_drill_dataset_via_dashboard_access(dataset, dashboard)


def get_dashboard_freshness(dashboard: Dashboard) -> dict[str, Any]:
    """
    Roll the freshness of a dashboard's datasets up to the dashboard.

    Only datasets with a freshness setting, and that the current user may read
    through this dashboard, are included. The dashboard's ``data_as_of`` is the
    oldest of their answers, and it is ``stale`` if any of them is.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable

    now = datetime.now(timezone.utc)
    datasets: list[dict[str, Any]] = []
    for dataset in sorted(
        (ds for ds in dashboard.datasources if isinstance(ds, SqlaTable)),
        key=lambda ds: (ds.table_name or "", ds.id),
    ):
        config = get_freshness_config(dataset)
        if config is None or not _can_read_freshness(dataset, dashboard):
            continue
        data_as_of = get_dataset_freshness(dataset)
        datasets.append(
            {
                "id": dataset.id,
                "name": dataset.table_name,
                "data_as_of": data_as_of,
                "warn_after_minutes": config.warn_after_minutes,
                "stale": is_stale(data_as_of, config.warn_after_minutes, now),
            }
        )

    answered = [item["data_as_of"] for item in datasets if item["data_as_of"]]
    return {
        "data_as_of": min(answered) if answered else None,
        "stale": any(item["stale"] for item in datasets),
        "datasets": datasets,
    }
