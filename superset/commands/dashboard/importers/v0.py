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
import time
from copy import copy
from datetime import datetime
from functools import partial
from typing import Any, Callable, Optional

from flask_babel import lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy.orm import make_transient

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.dataset.importers.v0 import (
    extra_limits_errors,
    find_sqla_table,
    import_dataset,
    table_key,
)
from superset.commands.exceptions import CommandInvalidError, ImportFailedError
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import DashboardImportException
from superset.migrations.shared.native_filters import migrate_dashboard
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.time_range_limits.policy import (
    limits_errors,
    limits_shape_error,
    parse_written_policy,
    stored_limits,
    stricter_errors,
    TIME_RANGE_LIMITS_KEY,
    TimeRangeLimitsInvalidError,
)
from superset.utils import json
from superset.utils.core import get_user
from superset.utils.dashboard_filter_scopes_converter import (
    convert_filter_scopes,
    copy_filter_scopes,
)
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)


def import_chart(
    slc_to_import: Slice,
    slc_to_override: Optional[Slice],
    import_time: Optional[int] = None,
) -> int:
    """Inserts or overrides slc in the database.

    remote_id and import_time fields in params_dict are set to track the
    slice origin and ensure correct overrides for multiple imports.
    Slice.perm is used to find the datasources and connect them.

    :param Slice slc_to_import: Slice object to import
    :param Slice slc_to_override: Slice to replace, id matches remote_id
    :returns: The resulting id for the imported slice
    :rtype: int
    """
    make_transient(slc_to_import)
    slc_to_import.dashboards = []
    slc_to_import.alter_params(remote_id=slc_to_import.id, import_time=import_time)

    slc_to_import = slc_to_import.copy()
    slc_to_import.reset_ownership()
    params = slc_to_import.params_dict
    datasource = SqlaTable.get_datasource_by_name(
        datasource_name=params["datasource_name"],
        database_name=params["database_name"],
        catalog=params.get("catalog"),
        schema=params["schema"],
    )
    slc_to_import.datasource_id = datasource.id  # type: ignore
    if slc_to_override:
        slc_to_override.override(slc_to_import)
        db.session.flush()
        return slc_to_override.id
    db.session.add(slc_to_import)
    logger.info("Final slice: %s", str(slc_to_import.to_json()))
    db.session.flush()
    return slc_to_import.id


def _find_existing_dashboard(remote_id: Any) -> Optional[Dashboard]:
    """The dashboard a V0 import overrides: the last one with that ``remote_id``."""
    existing_dashboard = None
    for dash in db.session.query(Dashboard).all():
        if (
            "remote_id" in dash.params_dict
            and dash.params_dict["remote_id"] == remote_id
        ):
            existing_dashboard = dash
    return existing_dashboard


def _find_existing_datasource(
    raw: dict[str, Any], database_id: Optional[int]
) -> Optional[SqlaTable]:
    """The dataset ``import_dataset`` overrides for a raw ``__SqlaTable__``."""
    if not database_id:
        database_name = json.loads(raw.get("params") or "{}").get("database_name")
        database = (
            db.session.query(Database)
            .filter_by(database_name=database_name)
            .one_or_none()
            if database_name
            else None
        )
        if database is None:
            return None
        database_id = database.id
    return find_sqla_table(raw["table_name"], raw.get("schema"), database_id)


def _datasources_limits_errors(
    datasources: Any, database_id: Optional[int]
) -> dict[str, Any]:
    errors: dict[str, Any] = {}
    for item in datasources if isinstance(datasources, list) else []:
        raw = item.get("__SqlaTable__") if isinstance(item, dict) else None
        if not isinstance(raw, dict):
            continue
        if found := extra_limits_errors(
            raw.get("extra"), partial(_find_existing_datasource, raw, database_id)
        ):
            key = table_key(
                json.loads(raw.get("params") or "{}").get("database_name"),
                raw.get("schema"),
                raw.get("table_name"),
            )
            errors[key] = {"extra": found}
    return errors


def _json_metadata_limits_errors(
    json_metadata: str, find_existing: Callable[[], Optional[Dashboard]]
) -> dict[str, list[str]]:
    """
    Shape and stricter-than-global errors of the policy in a dashboard
    ``json_metadata``, keyed by ``time_range_limits.<path>``. ``find_existing``
    returns the row the import overrides; it runs only when the policy breaks the
    global one.
    """
    try:
        data = json.loads(json_metadata)
    except (TypeError, ValueError, RecursionError):
        return {}
    raw = data.get(TIME_RANGE_LIMITS_KEY) if isinstance(data, dict) else None
    try:
        policy = parse_written_policy(raw)
    except TimeRangeLimitsInvalidError as ex:
        return limits_shape_error(TIME_RANGE_LIMITS_KEY, ex)
    errors = stricter_errors(
        policy,
        "dashboard",
        lambda: (
            stored_limits(existing.json_metadata)
            if (existing := find_existing())
            else None
        ),
    )
    return limits_errors(TIME_RANGE_LIMITS_KEY, errors)


def _remote_ids(dashboard: dict[str, Any]) -> list[Any]:
    """
    The ``remote_id`` values whose row an import of ``dashboard`` changes: the row
    found by its ``id``, and the row that gets its ``json_metadata.remote_id``.
    """
    remote_ids = [dashboard.get("id")]
    json_metadata = dashboard.get("json_metadata")
    try:
        metadata = (
            json.loads(json_metadata)
            if isinstance(json_metadata, str)
            else json_metadata
        )
    except (TypeError, ValueError, RecursionError):
        metadata = None
    if isinstance(metadata, dict) and "remote_id" in metadata:
        remote_ids.append(metadata["remote_id"])
    return remote_ids


def _find_unchanged_dashboard(
    remote_id: Any, earlier: list[dict[str, Any]]
) -> Optional[Dashboard]:
    """
    The dashboard an import overrides, or ``None`` when a dashboard imported
    before it changes that row: the row then has no stored value to keep.
    Compared with ``==``, as ``_find_existing_dashboard`` does: an ``id`` may be
    unhashable.
    """
    if any(remote_id in _remote_ids(dashboard) for dashboard in earlier):
        return None
    return _find_existing_dashboard(remote_id)


def _limits_errors(
    content: str, database_id: Optional[int], earlier: list[dict[str, Any]]
) -> dict[str, Any]:
    """
    The limits errors of a V0 file: dashboards by their index, datasources by
    ``<schema>.<table_name>``. ``earlier`` holds the dashboards imported before
    this file's, and gets this file's added.
    """
    data = json.loads(content)
    if not isinstance(data, dict):
        return {}
    dashboards = data.get("dashboards")
    errors: dict[str, Any] = {}
    dashboard_errors: dict[int, Any] = {}
    for index, item in enumerate(dashboards if isinstance(dashboards, list) else []):
        dashboard = item.get("__Dashboard__") if isinstance(item, dict) else None
        if not isinstance(dashboard, dict):
            continue
        if isinstance(json_metadata := dashboard.get("json_metadata"), str) and (
            found := _json_metadata_limits_errors(
                json_metadata,
                partial(_find_unchanged_dashboard, dashboard.get("id"), earlier),
            )
        ):
            dashboard_errors[index] = {"json_metadata": found}
        earlier.append(dashboard)
    if dashboard_errors:
        errors["dashboards"] = dashboard_errors
    if datasource_errors := _datasources_limits_errors(
        data.get("datasources"), database_id
    ):
        errors["datasources"] = datasource_errors
    return errors


def import_dashboard(  # noqa: C901
    # pylint: disable=too-many-locals,too-many-statements
    dashboard_to_import: Dashboard,
    dataset_id_mapping: Optional[dict[int, int]] = None,
    import_time: Optional[int] = None,
) -> int:
    """Imports the dashboard from the object to the database.

    Once dashboard is imported, json_metadata field is extended and stores
    remote_id and import_time. It helps to decide if the dashboard has to
    be overridden or just copies over. Slices that belong to this
    dashboard will be wired to existing tables. This function can be used
    to import/export dashboards between multiple superset instances.
    Audit metadata isn't copied over.
    """

    def alter_positions(
        dashboard: Dashboard, old_to_new_slc_id_dict: dict[int, int]
    ) -> None:
        """Updates slice_ids in the position json.

        Sample position_json data:
        {
            "DASHBOARD_VERSION_KEY": "v2",
            "DASHBOARD_ROOT_ID": {
                "type": "DASHBOARD_ROOT_TYPE",
                "id": "DASHBOARD_ROOT_ID",
                "children": ["DASHBOARD_GRID_ID"]
            },
            "DASHBOARD_GRID_ID": {
                "type": "DASHBOARD_GRID_TYPE",
                "id": "DASHBOARD_GRID_ID",
                "children": ["DASHBOARD_CHART_TYPE-2"]
            },
            "DASHBOARD_CHART_TYPE-2": {
                "type": "CHART",
                "id": "DASHBOARD_CHART_TYPE-2",
                "children": [],
                "meta": {
                    "width": 4,
                    "height": 50,
                    "chartId": 118
                }
            },
        }
        """
        position_data = json.loads(dashboard.position_json)
        position_json = position_data.values()
        for value in position_json:
            if (
                isinstance(value, dict)
                and value.get("meta")
                and value.get("meta", {}).get("chartId")
            ):
                old_slice_id = value["meta"]["chartId"]

                if old_slice_id in old_to_new_slc_id_dict:
                    value["meta"]["chartId"] = old_to_new_slc_id_dict[old_slice_id]
        dashboard.position_json = json.dumps(position_data)

    def alter_native_filters(dashboard: Dashboard) -> None:
        json_metadata = json.loads(dashboard.json_metadata)
        native_filter_configuration = json_metadata.get("native_filter_configuration")
        if not native_filter_configuration:
            return
        for native_filter in native_filter_configuration:
            for target in native_filter.get("targets", []):
                old_dataset_id = target.get("datasetId")
                if dataset_id_mapping and old_dataset_id is not None:
                    target["datasetId"] = dataset_id_mapping.get(
                        old_dataset_id,
                        old_dataset_id,
                    )
        dashboard.json_metadata = json.dumps(json_metadata)

    logger.info("Started import of the dashboard: %s", dashboard_to_import.to_json())
    logger.info("Dashboard has %d slices", len(dashboard_to_import.slices))
    # copy slices object as Slice.import_slice will mutate the slice
    # and will remove the existing dashboard - slice association
    slices = copy(dashboard_to_import.slices)

    # Clearing the slug to avoid conflicts
    dashboard_to_import.slug = None

    old_json_metadata = json.loads(dashboard_to_import.json_metadata or "{}")
    old_to_new_slc_id_dict: dict[int, int] = {}
    new_timed_refresh_immune_slices = []
    new_expanded_slices = {}
    new_filter_scopes = {}
    i_params_dict = dashboard_to_import.params_dict
    remote_id_slice_map = {
        slc.params_dict["remote_id"]: slc
        for slc in db.session.query(Slice).all()
        if "remote_id" in slc.params_dict
    }
    new_slice_ids = []
    for slc in slices:
        logger.info(
            "Importing slice %s from the dashboard: %s",
            slc.to_json(),
            dashboard_to_import.dashboard_title,
        )
        remote_slc = remote_id_slice_map.get(slc.id)
        new_slc_id = import_chart(slc, remote_slc, import_time=import_time)
        new_slice_ids.append(new_slc_id)
        old_to_new_slc_id_dict[slc.id] = new_slc_id
        # update json metadata that deals with slice ids
        new_slc_id_str = str(new_slc_id)
        old_slc_id_str = str(slc.id)
        if (
            "timed_refresh_immune_slices" in i_params_dict
            and old_slc_id_str in i_params_dict["timed_refresh_immune_slices"]
        ):
            new_timed_refresh_immune_slices.append(new_slc_id_str)
        if (
            "expanded_slices" in i_params_dict
            and old_slc_id_str in i_params_dict["expanded_slices"]
        ):
            new_expanded_slices[new_slc_id_str] = i_params_dict["expanded_slices"][
                old_slc_id_str
            ]

    # since PR #9109, filter_immune_slices and filter_immune_slice_fields
    # are converted to filter_scopes
    # but dashboard create from import may still have old dashboard filter metadata
    # here we convert them to new filter_scopes metadata first
    filter_scopes = {}
    if (
        "filter_immune_slices" in i_params_dict
        or "filter_immune_slice_fields" in i_params_dict
    ):
        filter_scopes = convert_filter_scopes(old_json_metadata, slices)

    if "filter_scopes" in i_params_dict:
        filter_scopes = old_json_metadata.get("filter_scopes")

    # then replace old slice id to new slice id:
    if filter_scopes:
        new_filter_scopes = copy_filter_scopes(
            old_to_new_slc_id_dict=old_to_new_slc_id_dict,
            old_filter_scopes=filter_scopes,
        )

    # override the dashboard
    existing_dashboard = _find_existing_dashboard(dashboard_to_import.id)

    dashboard_to_import = dashboard_to_import.copy()
    dashboard_to_import.id = None
    dashboard_to_import.reset_ownership()
    # position_json can be empty for dashboards
    # with charts added from chart-edit page and without re-arranging
    if dashboard_to_import.position_json:
        alter_positions(dashboard_to_import, old_to_new_slc_id_dict)
    dashboard_to_import.alter_params(import_time=import_time)
    dashboard_to_import.remove_params(param_to_remove="filter_immune_slices")
    dashboard_to_import.remove_params(param_to_remove="filter_immune_slice_fields")
    if new_filter_scopes:
        dashboard_to_import.alter_params(filter_scopes=new_filter_scopes)
    if new_expanded_slices:
        dashboard_to_import.alter_params(expanded_slices=new_expanded_slices)
    if new_timed_refresh_immune_slices:
        dashboard_to_import.alter_params(
            timed_refresh_immune_slices=new_timed_refresh_immune_slices
        )

    alter_native_filters(dashboard_to_import)

    if existing_dashboard:
        existing_dashboard.override(dashboard_to_import)
    else:
        db.session.add(dashboard_to_import)

    dashboard = existing_dashboard or dashboard_to_import
    dashboard.slices = (
        db.session.query(Slice)
        .filter(Slice.id.in_(old_to_new_slc_id_dict.values()))
        .all()
    )
    # Migrate any filter-box charts to native dashboard filters.
    migrate_dashboard(dashboard)
    db.session.flush()
    return dashboard.id


def decode_dashboards(o: dict[str, Any]) -> Any:
    """
    Function to be passed into json.loads obj_hook parameter
    Recreates the dashboard object from a json representation.
    """

    if "__Dashboard__" in o:
        return Dashboard(**o["__Dashboard__"])
    if "__Slice__" in o:
        return Slice(**o["__Slice__"])
    if "__TableColumn__" in o:
        return TableColumn(**o["__TableColumn__"])
    if "__SqlaTable__" in o:
        return SqlaTable(**o["__SqlaTable__"])
    if "__SqlMetric__" in o:
        return SqlMetric(**o["__SqlMetric__"])
    if "__datetime__" in o:
        return datetime.strptime(o["__datetime__"], "%Y-%m-%dT%H:%M:%S")

    return o


def import_dashboards(
    content: str,
    database_id: Optional[int] = None,
    import_time: Optional[int] = None,
) -> None:
    """Imports dashboards from a stream to databases"""
    current_tt = int(time.time())
    import_time = current_tt if import_time is None else import_time
    data = json.loads(content, object_hook=decode_dashboards)
    if not data:
        raise DashboardImportException(_("No data in file"))
    dataset_id_mapping: dict[int, int] = {}
    # This legacy path creates/updates the embedded datasets. Mirror the
    # versioned (v1) import commands and require dataset write permission for the
    # objects being created here. Only enforced when there is something to import
    # and a request user is present, so the CLI import paths keep working.
    if (
        data["datasources"]
        and get_user()
        and not security_manager.can_access("can_write", "Dataset")
    ):
        raise ImportFailedError(
            "User doesn't have permission to create or update datasets"
        )
    for table in data["datasources"]:
        new_dataset_id = import_dataset(table, database_id, import_time=import_time)
        params = json.loads(table.params)
        dataset_id_mapping[params["remote_id"]] = new_dataset_id

    for dashboard in data["dashboards"]:
        import_dashboard(dashboard, dataset_id_mapping, import_time=import_time)


class ImportDashboardsCommand(BaseCommand):
    """
    Import dashboard in JSON format.

    This is the original unversioned format used to export and import dashboards
    in Superset.
    """

    # pylint: disable=unused-argument
    def __init__(
        self, contents: dict[str, str], database_id: Optional[int] = None, **kwargs: Any
    ):
        self.contents = contents
        self.database_id = database_id

    @transaction()
    def run(self) -> None:
        self.validate()

        for file_name, content in self.contents.items():
            logger.info("Importing dashboard from file %s", file_name)
            import_dashboards(content, self.database_id)

    def validate(self) -> None:
        # ensure all files are JSON
        for content in self.contents.values():
            try:
                json.loads(content)
            except ValueError:
                logger.exception("Invalid JSON file")
                raise

        # One error per file, so normalized_messages() can't drop one. Files in
        # the order run() imports them.
        earlier: list[dict[str, Any]] = []
        exceptions = [
            ValidationError({file_name: errors})
            for file_name, content in self.contents.items()
            if (errors := _limits_errors(content, self.database_id, earlier))
        ]
        if exceptions:
            raise CommandInvalidError(_("Error importing dashboard"), exceptions)
