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
import json
import logging
import time
from copy import copy
from datetime import datetime
from typing import Any, Dict, Optional

from flask_babel import lazy_gettext as _
from sqlalchemy.orm import make_transient, Session

from superset import ConnectorRegistry, db
from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.datasets.commands.importers.v0 import import_dataset
from superset.exceptions import DashboardImportException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.dashboard_filter_scopes_converter import (
    convert_filter_scopes,
    copy_filter_scopes,
)

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
    session = db.session
    make_transient(slc_to_import)
    slc_to_import.dashboards = []
    slc_to_import.alter_params(remote_id=slc_to_import.id, import_time=import_time)

    slc_to_import = slc_to_import.copy()
    slc_to_import.reset_ownership()
    params = slc_to_import.params_dict
    datasource = ConnectorRegistry.get_datasource_by_name(
        session,
        slc_to_import.datasource_type,
        params["datasource_name"],
        params["schema"],
        params["database_name"],
    )
    slc_to_import.datasource_id = datasource.id  # type: ignore
    if slc_to_override:
        slc_to_override.override(slc_to_import)
        session.flush()
        return slc_to_override.id
    session.add(slc_to_import)
    logger.info("Final slice: %s", str(slc_to_import.to_json()))
    session.flush()
    return slc_to_import.id


def import_dashboard(
    # pylint: disable=too-many-locals,too-many-statements
    dashboard_to_import: Dashboard,
    dataset_id_mapping: Optional[Dict[int, int]] = None,
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
        dashboard: Dashboard, old_to_new_slc_id_dict: Dict[int, int]
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
                        old_dataset_id, old_dataset_id,
                    )
        dashboard.json_metadata = json.dumps(json_metadata)

    logger.info("Started import of the dashboard: %s", dashboard_to_import.to_json())
    session = db.session
    logger.info("Dashboard has %d slices", len(dashboard_to_import.slices))
    # copy slices object as Slice.import_slice will mutate the slice
    # and will remove the existing dashboard - slice association
    slices = copy(dashboard_to_import.slices)

    # Clearing the slug to avoid conflicts
    dashboard_to_import.slug = None

    old_json_metadata = json.loads(dashboard_to_import.json_metadata or "{}")
    old_to_new_slc_id_dict: Dict[int, int] = {}
    new_timed_refresh_immune_slices = []
    new_expanded_slices = {}
    new_filter_scopes = {}
    i_params_dict = dashboard_to_import.params_dict
    remote_id_slice_map = {
        slc.params_dict["remote_id"]: slc
        for slc in session.query(Slice).all()
        if "remote_id" in slc.params_dict
    }
    for slc in slices:
        logger.info(
            "Importing slice %s from the dashboard: %s",
            slc.to_json(),
            dashboard_to_import.dashboard_title,
        )
        remote_slc = remote_id_slice_map.get(slc.id)
        new_slc_id = import_chart(slc, remote_slc, import_time=import_time)
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
    existing_dashboard = None
    for dash in session.query(Dashboard).all():
        if (
            "remote_id" in dash.params_dict
            and dash.params_dict["remote_id"] == dashboard_to_import.id
        ):
            existing_dashboard = dash

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

    new_slices = (
        session.query(Slice).filter(Slice.id.in_(old_to_new_slc_id_dict.values())).all()
    )

    if existing_dashboard:
        existing_dashboard.override(dashboard_to_import)
        existing_dashboard.slices = new_slices
        session.flush()
        return existing_dashboard.id

    dashboard_to_import.slices = new_slices
    session.add(dashboard_to_import)
    session.flush()
    return dashboard_to_import.id  # type: ignore


def decode_dashboards(  # pylint: disable=too-many-return-statements
    o: Dict[str, Any]
) -> Any:
    """
    Function to be passed into json.loads obj_hook parameter
    Recreates the dashboard object from a json representation.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.druid.models import (
        DruidCluster,
        DruidColumn,
        DruidDatasource,
        DruidMetric,
    )

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
    if "__DruidCluster__" in o:
        return DruidCluster(**o["__DruidCluster__"])
    if "__DruidColumn__" in o:
        return DruidColumn(**o["__DruidColumn__"])
    if "__DruidDatasource__" in o:
        return DruidDatasource(**o["__DruidDatasource__"])
    if "__DruidMetric__" in o:
        return DruidMetric(**o["__DruidMetric__"])
    if "__datetime__" in o:
        return datetime.strptime(o["__datetime__"], "%Y-%m-%dT%H:%M:%S")

    return o


def import_dashboards(
    session: Session,
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
    dataset_id_mapping: Dict[int, int] = {}
    for table in data["datasources"]:
        new_dataset_id = import_dataset(table, database_id, import_time=import_time)
        params = json.loads(table.params)
        dataset_id_mapping[params["remote_id"]] = new_dataset_id

    session.commit()
    for dashboard in data["dashboards"]:
        import_dashboard(dashboard, dataset_id_mapping, import_time=import_time)
    session.commit()


class ImportDashboardsCommand(BaseCommand):
    """
    Import dashboard in JSON format.

    This is the original unversioned format used to export and import dashboards
    in Superset.
    """

    # pylint: disable=unused-argument
    def __init__(
        self, contents: Dict[str, str], database_id: Optional[int] = None, **kwargs: Any
    ):
        self.contents = contents
        self.database_id = database_id

    def run(self) -> None:
        self.validate()

        for file_name, content in self.contents.items():
            logger.info("Importing dashboard from file %s", file_name)
            import_dashboards(db.session, content, self.database_id)

    def validate(self) -> None:
        # ensure all files are JSON
        for content in self.contents.values():
            try:
                json.loads(content)
            except ValueError:
                logger.exception("Invalid JSON file")
                raise
