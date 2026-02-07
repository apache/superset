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
"""Programmatic loader for a Remita Table showcase dashboard.

This loader creates a small dataset and three `remita_table` charts to
demonstrate:
- Row + Header actions
- Selection + Bulk actions
- Server pagination + URL allowlist (set to allow-all for example)

It is meant for local/demo environments. Do not use allow-all origins in production.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.examples.utils import get_uuid
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.database import get_example_database
from superset.utils import json

logger = logging.getLogger(__name__)

SAMPLE_TABLE = "remita_transactions"


def _ensure_sample_table(database: Database) -> SqlaTable:
    """Create a tiny in-memory dataset for showcasing."""
    from sqlalchemy import text
    from datetime import datetime, timedelta
    import pandas as pd

    # Generate 250 sample rows to better demonstrate server pagination
    customers = [
        "Acme Corp",
        "Globex",
        "Initech",
        "Umbrella",
        "Wayne",
        "Stark",
        "Soylent",
        "Wonka",
        "Gringotts",
        "Aperture",
    ]
    statuses = ["PAID", "PENDING", "FAILED", "REFUNDED"]
    start = datetime(2024, 10, 1, 8, 0, 0)
    rows: List[Dict[str, Any]] = []
    for i in range(1, 251):
        rows.append(
            {
                "id": i,
                "account_id": 1000 + ((i - 1) % 10) + 1,  # 1001..1010
                "customer": customers[(i - 1) % len(customers)],
                # Deterministic numeric distribution
                "amount": round(((i % 25) * 123.45) + ((i % 7) * 17.89) + 50, 2),
                "status": statuses[(i - 1) % len(statuses)],
                "created_at": (start + timedelta(minutes=30 * i)).strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
            }
        )

    pdf = pd.DataFrame(rows)
    with database.get_sqla_engine() as engine:
        # Replace table
        pdf.to_sql(SAMPLE_TABLE, engine, if_exists="replace", index=False)
        # Set a primary key where supported (best-effort)
        try:
            engine.execute(text(f"ALTER TABLE {SAMPLE_TABLE} ADD PRIMARY KEY (id)"))
        except Exception:  # pragma: no cover - best-effort
            pass

    # Register/refresh SqlaTable metadata
    tbl = (
        db.session.query(SqlaTable)
        .filter_by(table_name=SAMPLE_TABLE, database_id=database.id)
        .first()
    )
    if not tbl:
        tbl = SqlaTable(table_name=SAMPLE_TABLE, database_id=database.id)
        tbl.database = database
    tbl.fetch_metadata()
    db.session.merge(tbl)
    db.session.commit()
    return tbl


def _mk_chart(
    dataset: SqlaTable,
    name: str,
    form_data: Dict[str, Any],
) -> Slice:
    slice_params: Dict[str, Any] = {
        "slice_name": name,
        "viz_type": "remita_table",
        "datasource_id": dataset.id,
        "datasource_type": "table",
        # Persist params as JSON string, aligning with model expectations
        "params": json.dumps(form_data, indent=2, sort_keys=True),
        "uuid": get_uuid(),
    }
    # Use DAO.create with attributes to avoid passing a dict as a mapped instance
    slc = ChartDAO.create(attributes=slice_params)
    return slc


def load_remita_showcase() -> Dashboard:
    """Create a Remita Showcase dashboard with 3 charts.

    This loader sets the frontend allowlist to allow all origins by configuring
    the form data to include URLs for different origins. Since the Remita URL
    validator reads `window.REMITA_TABLE_ALLOWED_ACTION_ORIGINS`, ensure your
    local dev injects `['*']` to simplify examples (see note below).
    """
    # If the dashboard already exists, don't create duplicates.
    # Keep this loader idempotent so running `superset load_examples` multiple times
    # won’t keep adding new Remita dashboards/charts.
    existing_dash = (
        db.session.query(Dashboard)
        .filter(Dashboard.dashboard_title == "Remita Showcase")
        .first()
    )

    # Ensure dataset exists
    database = get_example_database()
    table = _ensure_sample_table(database)

    # If dashboard exists, ensure it has the 4 showcase charts; create missing ones
    if existing_dash:
        logger.info("Remita Showcase dashboard already exists; verifying charts…")
        # Build a map by slice_name
        by_name = {slc.slice_name: slc for slc in (existing_dash.slices or [])}
        needed: list[Slice] = []

        def ensure_chart(name: str, form_data: Dict[str, Any]) -> Slice:
            slc = by_name.get(name)
            if slc and getattr(slc, "viz_type", None) == "remita_table":
                return slc
            # create new chart if missing or wrong viz_type
            return _mk_chart(table, name, form_data)

        c1 = ensure_chart(
            "Remita Actions (Header + Row)",
            {
                "include_search": True,
                "allow_render_html": True,
                "all_columns": ["id", "customer", "account_id", "amount", "status", "created_at"],
                "actions_config": {
                    "bulk_action_label": "Actions",
                    "show_split_buttons_in_slice_header": True,
                    "split_actions": (
                        "["
                        "{\"key\":\"create-ticket\",\"label\":\"Create Ticket\",\"actionUrl\":\"/tickets/new?customer={customer}\",\"showInSliceHeader\":true}",
                        "{\"key\":\"open-reports\",\"label\":\"Open Reports\",\"actionUrl\":\"https://allowed.example.com/reports?id={id}\",\"showInSliceHeader\":true}"
                        "]"
                    ),
                    "non_split_actions": (
                        "[" "{\"key\":\"refresh\",\"label\":\"Refresh\",\"showInSliceHeader\":true}" "]"
                    ),
                    "enable_table_actions": True,
                    "row_id_column": "id",
                    "table_actions": (
                        "["
                        "{\"key\":\"view\",\"label\":\"View\",\"actionUrl\":\"/superset/explore/?id={id}\"}",
                        "{\"key\":\"delete\",\"label\":\"Delete\"}"
                        "]"
                    ),
                },
            },
        )
        c2 = ensure_chart(
            "Remita Selection + Bulk (Multi)",
            {
                "include_search": True,
                "all_columns": ["id", "customer", "account_id", "amount", "status", "created_at"],
            "actions_config": {
                "bulk_action_label": "Bulk Actions",
                "show_split_buttons_in_slice_header": True,
                "selection_enabled": True,
                "selection_mode": "multiple",
                "row_id_column": "id",
                "enable_bulk_actions": True,
                    "split_actions": (
                        "["
                        "{\"key\":\"add-new\",\"label\":\"Add New\",\"showInSliceHeader\":true}",
                        "{\"key\":\"export-selected\",\"label\":\"Export Selected\",\"boundToSelection\":true,\"showInSliceHeader\":true}"
                        "]"
                    ),
                    "non_split_actions": ("[" "{\"key\":\"clear\",\"label\":\"Clear\"}" "]"),
                },
            },
        )
        c3 = ensure_chart(
            "Remita Selection + Bulk (Single)",
            {
                "include_search": True,
                "all_columns": ["id", "customer", "account_id", "amount", "status", "created_at"],
            "actions_config": {
                "bulk_action_label": "Single Select Actions",
                "show_split_buttons_in_slice_header": True,
                "selection_enabled": True,
                "selection_mode": "single",
                "row_id_column": "id",
                "enable_bulk_actions": True,
                    "split_actions": (
                        "["
                        "{\"key\":\"open-details\",\"label\":\"Open Details\",\"boundToSelection\":true,\"showInSliceHeader\":true}"
                        "]"
                    ),
                    "non_split_actions": ("[" "{\"key\":\"reset\",\"label\":\"Reset\"}" "]"),
                },
            },
        )
        c4 = ensure_chart(
            "Remita Table Actions (Row Column)",
            {
                "include_search": True,
                "server_pagination": True,
                "server_page_length": 10,
                "all_columns": ["id", "customer", "account_id", "amount", "status", "created_at"],
                "actions_config": {
                    "enable_table_actions": True,
                    "row_id_column": "id",
                    "table_actions": (
                        "["
                        "{\"key\":\"view\",\"label\":\"View\",\"actionUrl\":\"/superset/explore/?id={id}\"}",
                        "{\"key\":\"edit\",\"label\":\"Edit\"}",
                        "{\"key\":\"delete\",\"label\":\"Delete\"}"
                        "]"
                    ),
                },
            },
        )

        names_needed = {
            "Remita Actions (Header + Row)",
            "Remita Selection + Bulk (Multi)",
            "Remita Selection + Bulk (Single)",
            "Remita Table Actions (Row Column)",
        }
        new_slices: list[Slice] = []
        for slc in existing_dash.slices or []:
            if slc.slice_name not in names_needed:
                new_slices.append(slc)
        new_slices.extend([c1, c2, c3, c4])
        existing_dash.slices = new_slices
        db.session.flush()

        # Update layout to two rows (2 charts per row)
        def chart_component(slc: Slice, width: int = 6, height: int = 50) -> Dict[str, Any]:
            key = f"CHART-{slc.id}"
            return key, {
                "type": "CHART",
                "id": key,
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID"],
                "meta": {
                    "chartId": slc.id,
                    "uuid": str(slc.uuid),
                    "sliceName": slc.slice_name,
                    "width": width,
                    "height": height,
                },
            }

        c1_key, c1_comp = chart_component(c1)
        c2_key, c2_comp = chart_component(c2)
        c3_key, c3_comp = chart_component(c3)
        c4_key, c4_comp = chart_component(c4)

        row1_id = "ROW-REM-1"
        row2_id = "ROW-REM-2"
        position = {
            "DASHBOARD_VERSION_KEY": "v2",
            "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"], "parents": []},
            "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": [row1_id, row2_id], "parents": ["ROOT_ID"]},
        row1_id: {"type": "ROW", "id": row1_id, "children": [c1_key, c2_key], "parents": ["ROOT_ID", "GRID_ID"], "meta": {"width": 12}},
        row2_id: {"type": "ROW", "id": row2_id, "children": [c3_key, c4_key], "parents": ["ROOT_ID", "GRID_ID"], "meta": {"width": 12}},
            c1_key: c1_comp,
            c2_key: c2_comp,
            c3_key: c3_comp,
            c4_key: c4_comp,
        }
        existing_dash.position_json = json.dumps(position)

        # Ensure native (horizontal) filters are configured for the showcase
        try:
            meta = json.loads(existing_dash.json_metadata or "{}")
        except Exception:
            meta = {}
        meta["native_filter_configuration"] = [
            {
                "id": "nf_time",
                "name": "Time",
                "filterType": "filter_time",
                "cascadeParentIds": [],
                "chartsInScope": [],
            },
            {
                "id": "nf_status",
                "name": "Status",
                "filterType": "filter_select",
                "cascadeParentIds": [],
                "chartsInScope": [],
                "targets": [
                    {
                        "datasetId": table.id,
                        "column": {"name": "status"},
                    }
                ],
            },
            {
                "id": "nf_customer",
                "name": "Customer",
                "filterType": "filter_select",
                "cascadeParentIds": [],
                "chartsInScope": [],
                "targets": [
                    {
                        "datasetId": table.id,
                        "column": {"name": "customer"},
                    }
                ],
            },
        ]
        existing_dash.json_metadata = json.dumps(meta)
        db.session.commit()
        return existing_dash


    # Chart 1: Actions in header + row actions column (table actions)
    c1 = _mk_chart(
        table,
        "Remita Actions (Header + Row)",
        {
            "include_search": True,
            "allow_render_html": True,
            "all_columns": [
                "id",
                "customer",
                "account_id",
                "amount",
                "status",
                "created_at",
            ],
            "actions_config": {
                "bulk_action_label": "Actions",
                "show_split_buttons_in_slice_header": True,
                # Header split buttons (always visible)
                "split_actions": (
                    "["
                    "{\"key\":\"create-ticket\",\"label\":\"Create Ticket\",\"publishEvent\":true,\"actionUrl\":\"/tickets/new?customer={customer}\",\"showInSliceHeader\":true}",
                    "{\"key\":\"open-reports\",\"label\":\"Open Reports\",\"publishEvent\":true,\"actionUrl\":\"https://allowed.example.com/reports?id={id}\",\"showInSliceHeader\":true}"
                    "]"
                ),
                # Header non-split buttons (more menu)
                "non_split_actions": (
                    "["
                    "{\"key\":\"refresh\",\"label\":\"Refresh\",\"publishEvent\":true,\"showInSliceHeader\":true}"
                    "]"
                ),
                # Row actions (right column)
                "enable_table_actions": True,
                "row_id_column": "id",
                "table_actions": (
                    "["
                    "{\"key\":\"view\",\"label\":\"View\",\"publishEvent\":true,\"actionUrl\":\"/superset/explore/?id={id}\"}",
                    "{\"key\":\"delete\",\"label\":\"Delete\",\"publishEvent\":true}"
                    "]"
                ),
            },
        },
    )

    # Chart 2: Selection + Bulk (multiple)
    c2 = _mk_chart(
        table,
        "Remita Selection + Bulk (Multi)",
        {
            "include_search": True,
            "all_columns": [
                "id",
                "customer",
                "account_id",
                "amount",
                "status",
                "created_at",
            ],
            "actions_config": {
                "bulk_action_label": "Bulk Actions",
                "show_split_buttons_in_slice_header": True,
                "selection_enabled": True,
                "selection_mode": "multiple",
                "row_id_column": "id",
                "enable_bulk_actions": True,
                "split_actions": (
                    "["
                    "{\"key\":\"add-new\",\"label\":\"Add New\",\"publishEvent\":true,\"showInSliceHeader\":true}",
                    "{\"key\":\"export-selected\",\"label\":\"Export Selected\",\"publishEvent\":true,\"boundToSelection\":true,\"showInSliceHeader\":true}"
                    "]"
                ),
                "non_split_actions": (
                    "["
                    "{\"key\":\"clear\",\"label\":\"Clear\",\"publishEvent\":true}"
                    "]"
                ),
            },
        },
    )

    # Chart 3: Selection + Bulk (single)
    c3 = _mk_chart(
        table,
        "Remita Selection + Bulk (Single)",
        {
            "include_search": True,
            "all_columns": [
                "id",
                "customer",
                "account_id",
                "amount",
                "status",
                "created_at",
            ],
            "actions_config": {
                "bulk_action_label": "Single Select Actions",
                "show_split_buttons_in_slice_header": True,
                "selection_enabled": True,
                "selection_mode": "single",
                "row_id_column": "id",
                "enable_bulk_actions": True,
                "split_actions": (
                    "["
                    "{\"key\":\"open-details\",\"label\":\"Open Details\",\"publishEvent\":true,\"boundToSelection\":true,\"showInSliceHeader\":true}"
                    "]"
                ),
                "non_split_actions": (
                    "["
                    "{\"key\":\"reset\",\"label\":\"Reset\",\"publishEvent\":true}"
                    "]"
                ),
            },
        },
    )

    # Chart 4: Table actions focused (view/edit/delete)
    c4 = _mk_chart(
        table,
        "Remita Table Actions (Row Column)",
        {
            "include_search": True,
            "server_pagination": True,
            "server_page_length": 10,
            "all_columns": [
                "id",
                "customer",
                "account_id",
                "amount",
                "status",
                "created_at",
            ],
            "actions_config": {
                "enable_table_actions": True,
                "row_id_column": "id",
                "table_actions": (
                    "["
                    "{\"key\":\"view\",\"label\":\"View\",\"publishEvent\":true,\"actionUrl\":\"/superset/explore/?id={id}\"}",
                    "{\"key\":\"edit\",\"label\":\"Edit\",\"publishEvent\":true}",
                    "{\"key\":\"delete\",\"label\":\"Delete\",\"publishEvent\":true}"
                    "]"
                ),
            },
        },
    )

    # Create Dashboard
    dash_params = {
        "dashboard_title": "Remita Showcase",
        "slug": None,
        "position_json": None,
        "uuid": get_uuid(),
        "published": True,
    }
    dash: Dashboard = DashboardDAO.create(attributes=dash_params)
    # Add slices to dashboard by assigning the relationship
    dashboard_slices = [c1, c2, c3, c4]
    dash.slices = dashboard_slices
    # Ensure IDs are assigned
    db.session.flush()

    # Build a simple two-rows layout (2 charts per row)
    def chart_component(slc: Slice, width: int = 6, height: int = 50) -> Dict[str, Any]:
        key = f"CHART-{slc.id}"
        return key, {
            "type": "CHART",
            "id": key,
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {
                "chartId": slc.id,
                "uuid": str(slc.uuid),
                "sliceName": slc.slice_name,
                "width": width,
                "height": height,
            },
        }

    c1_key, c1_comp = chart_component(c1)
    c2_key, c2_comp = chart_component(c2)
    c3_key, c3_comp = chart_component(c3)
    c4_key, c4_comp = chart_component(c4)

    row1_id = "ROW-REM-1"
    row2_id = "ROW-REM-2"
    position = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["GRID_ID"],
            "parents": [],
        },
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": [row1_id, row2_id],
            "parents": ["ROOT_ID"],
        },
        row1_id: {
            "type": "ROW",
            "id": row1_id,
            "children": [c1_key, c2_key],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"width": 12},
        },
        row2_id: {
            "type": "ROW",
            "id": row2_id,
            "children": [c3_key, c4_key],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"width": 12},
        },
        c1_key: c1_comp,
        c2_key: c2_comp,
        c3_key: c3_comp,
        c4_key: c4_comp,
    }

    dash.position_json = json.dumps(position)

    # Add native (horizontal) filters appropriate for this dataset
    dash.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "nf_time",
                    "name": "Time",
                    "filterType": "filter_time",
                    "cascadeParentIds": [],
                    "chartsInScope": [],
                },
                {
                    "id": "nf_status",
                    "name": "Status",
                    "filterType": "filter_select",
                    "cascadeParentIds": [],
                    "chartsInScope": [],
                    "targets": [
                        {
                            "datasetId": table.id,
                            "column": {"name": "status"},
                        }
                    ],
                },
                {
                    "id": "nf_customer",
                    "name": "Customer",
                    "filterType": "filter_select",
                    "cascadeParentIds": [],
                    "chartsInScope": [],
                    "targets": [
                        {
                            "datasetId": table.id,
                            "column": {"name": "customer"},
                        }
                    ],
                },
            ]
        }
    )
    db.session.commit()

    logger.info("Created Remita Showcase dashboard with %d charts", len(dashboard_slices))
    return dash


def allow_all_origins_in_dev() -> None:
    """Set frontend window variable to allow all origins (example only).

    NOTE: For demonstration only. In production, never allow all origins.
    To enable this at runtime in dev, append the following in a custom template
    or theme extension that runs after bootstrap:

    <script>
      window.REMITA_TABLE_ALLOWED_ACTION_ORIGINS = ['*'];
    </script>
    """
    logger.warning("Allow-all origins is intended for demo only. Use with caution.")
