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
from copy import deepcopy
from textwrap import dedent

import click
from click_option_group import optgroup, RequiredMutuallyExclusiveOptionGroup
from flask.cli import with_appcontext
from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db, is_feature_enabled

Base = declarative_base()


dashboard_slices = Table(
    "dashboard_slices",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("dashboard_id", Integer, ForeignKey("dashboards.id")),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


slice_user = Table(
    "slice_user",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    Column("slice_id", Integer, ForeignKey("slices.id")),
)


class Dashboard(Base):  # type: ignore # pylint: disable=too-few-public-methods
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)
    slices = relationship("Slice", secondary=dashboard_slices, backref="dashboards")
    position_json = Column()

    def __repr__(self) -> str:
        return f"Dashboard<{self.id}>"


class Slice(Base):  # type: ignore # pylint: disable=too-few-public-methods
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    datasource_id = Column(Integer)
    params = Column(Text)
    slice_name = Column(String(250))
    viz_type = Column(String(250))

    def __repr__(self) -> str:
        return f"Slice<{self.id}>"


@click.group()
def native_filters() -> None:
    """
    Perform native filter operations.
    """


@native_filters.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--all",
    "all_",
    default=False,
    help="Upgrade all dashboards",
    is_flag=True,
)
@optgroup.option(
    "--id",
    "dashboard_ids",
    help="Upgrade the specific dashboard. Can be supplied multiple times.",
    multiple=True,
    type=int,
)
def upgrade(
    all_: bool,  # pylint: disable=unused-argument
    dashboard_ids: tuple[int, ...],
) -> None:
    """
    Upgrade legacy filter-box charts to native dashboard filters.
    """

    # pylint: disable=import-outside-toplevel
    from superset.utils.dashboard_filter_scopes_converter import (
        convert_filter_scopes_to_native_filters,
    )

    if not is_feature_enabled("DASHBOARD_NATIVE_FILTERS"):
        click.echo("The 'DASHBOARD_NATIVE_FILTERS' feature needs to be enabled.")
        return

    # Mapping between the CHART- and MARKDOWN- IDs.
    mapping = {}

    for dashboard in (  # pylint: disable=too-many-nested-blocks
        db.session.query(Dashboard)
        .filter(*[Dashboard.id.in_(dashboard_ids)] if dashboard_ids else [])
        .all()
    ):
        click.echo(f"Upgrading {str(dashboard)}")

        try:
            json_metadata = json.loads(dashboard.json_metadata or "{}")
            position_json = json.loads(dashboard.position_json or "{}")

            if "native_filter_migration" in json_metadata:
                click.echo(f"{dashboard} has already been upgraded")
                continue

            # Save the native and legacy filter configurations for recovery purposes.
            json_metadata["native_filter_migration"] = {
                key: deepcopy(json_metadata[key])
                for key in (
                    "default_filters",
                    "filter_scopes",
                    "native_filter_configuration",
                )
                if key in json_metadata
            }

            filter_boxes_by_id = {
                slc.id: slc for slc in dashboard.slices if slc.viz_type == "filter_box"
            }

            # Convert the legacy filter configurations to native filters.
            native_filter_configuration = json_metadata.setdefault(
                "native_filter_configuration",
                [],
            )

            native_filter_configuration.extend(
                convert_filter_scopes_to_native_filters(
                    json_metadata,
                    position_json,
                    filter_boxes=list(filter_boxes_by_id.values()),
                ),
            )

            # Remove the legacy filter configuration.
            for key in ["default_filters", "filter_scopes"]:
                json_metadata.pop(key, None)

            # Replace the filter-box charts with markdown elements.
            for key, value in list(position_json.items()):  # Immutable iteration
                if (
                    isinstance(value, dict)
                    and value["type"] == "CHART"
                    and (meta := value.get("meta"))
                    and meta["chartId"] in filter_boxes_by_id
                ):
                    slc = filter_boxes_by_id[meta["chartId"]]
                    mapping[key] = key.replace("CHART-", "MARKDOWN-")

                    value["id"] = mapping[key]
                    value["type"] = "MARKDOWN"

                    meta["code"] = dedent(
                        f"""
                        &#9888; The <a href="/superset/slice/{slc.id}/">{slc.slice_name}
                        </a> filter-box chart has been migrated to a native filter.

                        This placeholder markdown element can be safely removed after
                        verifying that the native filter(s) have been correctly applied,
                        otherwise ask an admin to revert the migration.
                        """
                    )

                    # Save the filter-box info for recovery purposes.
                    meta["native_filter_migration"] = {
                        key: meta.pop(key)
                        for key in (
                            "chartId",
                            "sliceName",
                            "sliceNameOverride",
                        )
                        if key in meta
                    }

                    position_json[mapping[key]] = value
                    del position_json[key]

            # Replace the relevant CHART- references.
            for value in position_json.values():
                if isinstance(value, dict):
                    for relation in ["children", "parents"]:
                        if relation in value:
                            for idx, key in enumerate(value[relation]):
                                if key in mapping:
                                    value[relation][idx] = mapping[key]

            # Remove the filter-box charts from the dashboard/slice mapping
            dashboard.slices = [
                slc for slc in dashboard.slices if slc.viz_type != "filter_box"
            ]

            dashboard.json_metadata = json.dumps(json_metadata)
            dashboard.position_json = json.dumps(position_json)
        except Exception:  # pylint: disable=broad-except
            click.echo(f"Unable to upgrade {str(dashboard)}")

    db.session.commit()
    db.session.close()


@native_filters.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--all",
    "all_",
    default=False,
    help="Downgrade all dashboards",
    is_flag=True,
)
@optgroup.option(
    "--id",
    "dashboard_ids",
    help="Downgrade the specific dashboard. Can be supplied multiple times.",
    multiple=True,
    type=int,
)
def downgrade(
    all_: bool,  # pylint: disable=unused-argument
    dashboard_ids: tuple[int, ...],
) -> None:
    """
    Downgrade native dashboard filters to legacy filter-box charts (where applicable).
    """

    # Mapping between the MARKDOWN- and CHART- IDs.
    mapping = {}

    for dashboard in (  # pylint: disable=too-many-nested-blocks
        db.session.query(Dashboard)
        .filter(*[Dashboard.id.in_(dashboard_ids)] if dashboard_ids else [])
        .all()
    ):
        click.echo(f"Downgrading {str(dashboard)}")

        try:
            json_metadata = json.loads(dashboard.json_metadata or "{}")
            position_json = json.loads(dashboard.position_json or "{}")

            if "native_filter_migration" not in json_metadata:
                click.echo(f"{str(dashboard)} has not been upgraded")
                continue

            # Restore the native and legacy filter configurations.
            for key in (
                "default_filters",
                "filter_scopes",
                "native_filter_configuration",
            ):
                json_metadata.pop(key, None)

            json_metadata.update(json_metadata.pop("native_filter_migration"))

            # Replace the relevant markdown elements with filter-box charts.
            slice_ids = set()

            for key, value in list(position_json.items()):  # Immutable iteration
                if (
                    isinstance(value, dict)
                    and value["type"] == "MARKDOWN"
                    and (meta := value.get("meta"))
                    and "native_filter_migration" in meta
                ):
                    meta.update(meta.pop("native_filter_migration"))
                    slice_ids.add(meta["chartId"])
                    mapping[key] = key.replace("MARKDOWN-", "CHART-")
                    value["id"] = mapping[key]
                    del meta["code"]
                    value["type"] = "CHART"
                    position_json[mapping[key]] = value
                    del position_json[key]

            # Replace the relevant CHART- references.
            for value in position_json.values():
                if isinstance(value, dict):
                    for relation in ["children", "parents"]:
                        if relation in value:
                            for idx, key in enumerate(value[relation]):
                                if key in mapping:
                                    value[relation][idx] = mapping[key]

            # Restore the filter-box charts to the dashboard/slice mapping.
            for slc in db.session.query(Slice).filter(Slice.id.in_(slice_ids)).all():
                dashboard.slices.append(slc)

            dashboard.json_metadata = json.dumps(json_metadata)
            dashboard.position_json = json.dumps(position_json)
        except Exception:  # pylint: disable=broad-except
            click.echo(f"Unable to downgrade {str(dashboard)}")

    db.session.commit()
    db.session.close()


@native_filters.command()
@with_appcontext
@optgroup.group(
    "Grouped options",
    cls=RequiredMutuallyExclusiveOptionGroup,
)
@optgroup.option(
    "--all",
    "all_",
    default=False,
    help="Cleanup all dashboards",
    is_flag=True,
)
@optgroup.option(
    "--id",
    "dashboard_ids",
    help="Cleanup the specific dashboard. Can be supplied multiple times.",
    multiple=True,
    type=int,
)
def cleanup(
    all_: bool,  # pylint: disable=unused-argument
    dashboard_ids: tuple[int, ...],
) -> None:
    """
    Cleanup obsolete legacy filter-box charts and interim metadata.

    Note this operation is irreversible.
    """

    slice_ids: set[int] = set()

    # Cleanup the dashboard which contains legacy fields used for downgrading.
    for dashboard in (
        db.session.query(Dashboard)
        .filter(*[Dashboard.id.in_(dashboard_ids)] if dashboard_ids else [])
        .all()
    ):
        click.echo(f"Cleaning up {str(dashboard)}")

        try:
            json_metadata = json.loads(dashboard.json_metadata or "{}")
            position_json = json.loads(dashboard.position_json or "{}")

            # Remove the saved filter configurations.
            if "native_filter_migration" in json_metadata:
                del json_metadata["native_filter_migration"]
                dashboard.json_metadata = json.dumps(json_metadata)

            for value in position_json.values():
                if (
                    isinstance(value, dict)
                    and value["type"] == "MARKDOWN"
                    and (meta := value.get("meta"))
                    and "native_filter_migration" in meta
                ):
                    slice_ids.add(meta["native_filter_migration"]["chartId"])
                    del meta["native_filter_migration"]

            dashboard.json_metadata = json.dumps(json_metadata)
            dashboard.position_json = json.dumps(position_json)
        except Exception:  # pylint: disable=broad-except
            click.echo(f"Unable to cleanup {str(dashboard)}")

    # Delete the obsolete filter-box charts associated with the dashboards.
    db.session.query(slice_user).filter(slice_user.c.slice_id.in_(slice_ids)).delete()
    db.session.query(Slice).filter(Slice.id.in_(slice_ids)).delete()

    db.session.commit()
    db.session.close()
