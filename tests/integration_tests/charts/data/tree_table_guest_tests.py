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
Guest (embedded) chart-data requests for a Tree table chart.

The Tree table's children and counts queries carry columns, metrics and
orderby pairs that its stored level-1 query doesn't. They pass Superset's
guest payload check (``query_context_modified``) only through the hidden
``columns`` / ``metrics`` / ``orderby`` mirrors saved in the chart params.
"""

import copy
import csv
import io
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest import mock

import pytest
from flask import current_app, g
from flask.ctx import AppContext
from flask.testing import FlaskClient
from flask_login import current_user

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import EmbeddedDashboardDAO
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.security import manager as security_manager_module
from superset.security.guest_token import GuestTokenResourceType
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)

FORBIDDEN = {"message": "Forbidden"}

LEVELS: list[dict[str, Any]] = [
    {
        "key": "level-1",
        "name": "State",
        "id_column": "state",
        "time_column": "ds",
        "columns": ["gender"],
        "detail_fields": [],
    },
    {
        "key": "level-2",
        "name": "Name",
        "id_column": "name",
        "parent_column": "state",
        "columns": ["num"],
        "detail_fields": [],
        "children_shown": 100,
        "apply_date_filter": False,
    },
]

# Pasted from levelsToMirrors.test.ts ("birth_names levels give the mirrors the
# guest tests paste") and also used in tests/unit_tests/security/manager_test.py.
MIRRORS: dict[str, Any] = {
    "tree_columns": ["state", "gender", "name", "num"],
    "tree_metrics": [
        {
            "expressionType": "SIMPLE",
            "aggregate": "COUNT_DISTINCT",
            "column": {"column_name": "name"},
            "label": "COUNT_DISTINCT(name)",
        }
    ],
    "tree_orderby": [
        ["state", True],
        ["state", False],
        ["gender", True],
        ["gender", False],
        ["name", True],
        ["name", False],
        ["num", True],
        ["num", False],
    ],
}

# Pasted from buildChildrenQuery.test.ts: "birth_names three-level batch and
# mirrors for the guest HTTP test".
LEVELS_3: list[dict[str, Any]] = [
    {
        "key": "level-1",
        "name": "State",
        "id_column": "state",
        "time_column": "ds",
        "columns": [],
        "detail_fields": [],
    },
    {
        "key": "level-2",
        "name": "Gender",
        "id_column": "gender",
        "parent_column": "state",
        "columns": [],
        "detail_fields": [],
    },
    {
        "key": "level-3",
        "name": "Name",
        "id_column": "name",
        "parent_column": "gender",
        "columns": ["num"],
        "detail_fields": [],
        "children_shown": 100,
    },
]
COUNT_DISTINCT_GENDER = {
    "expressionType": "SIMPLE",
    "aggregate": "COUNT_DISTINCT",
    "column": {"column_name": "gender"},
    "label": "COUNT_DISTINCT(gender)",
}
MIRRORS_3: dict[str, Any] = {
    "tree_columns": ["state", "gender", "name", "num"],
    "tree_metrics": [COUNT_DISTINCT_GENDER, *MIRRORS["tree_metrics"]],
    "tree_orderby": MIRRORS["tree_orderby"],
}

CHILDREN_COLUMNS = ["name", "state", "num"]
CHILDREN_ORDERBY = [["state", True], ["name", True]]
COUNTS_COLUMNS = ["state"]
LEVEL_1_QUERY = {
    "columns": ["state", "gender"],
    "metrics": [],
    "orderby": [["state", True]],
}


@pytest.fixture
def tree_guest_chart_read(app_context: AppContext) -> Iterator[None]:
    """Give the test guest the chart endpoint permission for each test."""
    role = security_manager.find_role(current_app.config["GUEST_ROLE_NAME"])
    permission = security_manager.find_permission_view_menu("can_read", "Chart")
    already_granted = permission in role.permissions
    if not already_granted:
        security_manager.add_permission_role(role, permission)
    try:
        yield
    finally:
        if not already_granted:
            security_manager.del_permission_role(role, permission)


@pytest.mark.usefixtures(
    "load_birth_names_dashboard_with_slices", "tree_guest_chart_read"
)
class TestTreeTableGuestChartData(SupersetTestCase):
    """
    The guest payload check for a Tree table's children and counts queries.

    On master a plain embedded guest sees the charts of its token's dashboard
    (``ChartFilter``, superset/charts/filters.py), so the payload check
    (``query_context_modified``) runs for it without any broad grant. Every
    403 has the bare ``{"message": "Forbidden"}`` body
    (superset/charts/data/api.py), so each request also records what the
    payload check returned: ``[True]`` proves the 403 came from it, ``[False]``
    that it passed. Tree table doesn't change base Superset's guest check.
    """

    def setUp(self) -> None:
        self.dash: Dashboard = self.get_dash_by_slug("births")
        self.table: SqlaTable = (
            db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
        )
        self.chart_a = self._create_chart("Tree table A", MIRRORS)
        self.chart_b = self._create_chart("Tree table B", {})
        self.chart_c = self._create_chart("Tree table C", MIRRORS_3, LEVELS_3)
        self.dash.slices = [
            *self.dash.slices,
            self.chart_a,
            self.chart_b,
            self.chart_c,
        ]
        db.session.commit()
        self.embedded = EmbeddedDashboardDAO.upsert(self.dash, [])
        db.session.commit()
        with self.app.test_request_context():
            self.token = security_manager.create_guest_access_token(
                {"username": "tree-table-guest"},
                [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": str(self.embedded.uuid),
                    }
                ],
                [],
            )

    def tearDown(self) -> None:
        charts = (self.chart_a, self.chart_b, self.chart_c)
        self.dash.slices = [
            chart
            for chart in self.dash.slices
            if chart.id not in {item.id for item in charts}
        ]
        for chart in charts:
            db.session.delete(chart)
        db.session.commit()

    def _create_chart(
        self,
        name: str,
        mirrors: dict[str, Any],
        levels: list[dict[str, Any]] = LEVELS,
    ) -> Slice:
        params = {
            "datasource": f"{self.table.id}__table",
            "viz_type": "ag-grid-table",
            "query_mode": "tree",
            "levels": levels,
            **mirrors,
        }
        chart = Slice(
            slice_name=name,
            viz_type="ag-grid-table",
            datasource_type="table",
            datasource_id=self.table.id,
            params=json.dumps(params),
            query_context=json.dumps(
                {
                    "datasource": {"id": self.table.id, "type": "table"},
                    "queries": [LEVEL_1_QUERY],
                    "form_data": params,
                }
            ),
        )
        db.session.add(chart)
        db.session.flush()
        return chart

    @contextmanager
    def _payload_checks(self) -> Iterator[list[bool]]:
        """Record what each real ``query_context_modified`` call returns."""
        results: list[bool] = []
        check = security_manager_module.query_context_modified

        def spy(query_context: Any) -> bool:
            results.append(check(query_context))
            return results[-1]

        with mock.patch.object(
            security_manager_module, "query_context_modified", side_effect=spy
        ):
            yield results

    def _post(self, payload: dict[str, Any]) -> tuple[Any, list[bool]]:
        g.pop("_login_user", None)
        g.pop("user", None)
        client: FlaskClient = self.app.test_client()
        with self._payload_checks() as modified:
            response = client.post(
                "/api/v1/chart/data",
                json=payload,
                headers={self.app.config["GUEST_TOKEN_HEADER_NAME"]: self.token},
            )
        return response, modified

    def _payload(
        self,
        chart: Slice,
        mirrors: dict[str, Any],
        queries: list[dict[str, Any]],
        result_type: str = "full",
    ) -> dict[str, Any]:
        return {
            "datasource": {"id": self.table.id, "type": "table"},
            "form_data": {
                "slice_id": chart.id,
                "dashboardId": self.dash.id,
                "viz_type": "ag-grid-table",
                "query_mode": "tree",
                **mirrors,
            },
            "queries": queries,
            "result_format": "json",
            "result_type": result_type,
        }

    def _post_as_guest(
        self,
        chart: Slice,
        mirrors: dict[str, Any],
        children_columns: list[str] = CHILDREN_COLUMNS,
    ) -> tuple[Any, list[bool]]:
        return self._post(
            self._payload(
                chart,
                mirrors,
                [
                    {
                        "columns": children_columns,
                        "metrics": [],
                        "orderby": CHILDREN_ORDERBY,
                    },
                    {
                        "columns": COUNTS_COLUMNS,
                        "metrics": MIRRORS["tree_metrics"],
                    },
                ],
            )
        )

    def _post_level_1(self, chart: Slice) -> tuple[Any, list[bool]]:
        return self._post(self._payload(chart, {}, [LEVEL_1_QUERY]))

    @staticmethod
    def _assert_allowed(sent: tuple[Any, list[bool]]) -> Any:
        response, modified = sent
        assert response.status_code == 200, response.json
        assert modified == [False]
        return response

    @staticmethod
    def _assert_payload_rejected(sent: tuple[Any, list[bool]]) -> None:
        response, modified = sent
        assert response.status_code == 403, response.json
        assert response.json == FORBIDDEN
        assert modified == [True]

    def _prime_cached_user(self) -> None:
        with self.app.test_request_context("/"):
            bool(current_user.is_authenticated)

    def _assert_no_broad_grant(self) -> None:
        role = security_manager.find_role(self.app.config["GUEST_ROLE_NAME"])
        grant = security_manager.find_permission_view_menu(
            "all_datasource_access", "all_datasource_access"
        )
        assert grant.id not in {perm.id for perm in role.permissions}

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_stored_mode_and_identity_gate_tree_mirrors(self) -> None:
        """Tree claims in a request cannot grant dormant mirrors on other charts."""
        for viz_type, query_mode in (
            ("ag-grid-table", "aggregate"),
            ("ag-grid-table", "raw"),
            ("table", "tree"),
        ):
            params = {
                **self.chart_a.params_dict,
                "viz_type": viz_type,
                "query_mode": query_mode,
            }
            self.chart_a.viz_type = viz_type
            self.chart_a.params = json.dumps(params)
            db.session.commit()
            self._assert_payload_rejected(self._post_as_guest(self.chart_a, MIRRORS))

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_cannot_introduce_an_arbitrary_tree_sort(self) -> None:
        """Only the stored Tree sort mirrors can authorize child ordering."""
        payload = self._payload(
            self.chart_a,
            MIRRORS,
            [
                {
                    "columns": CHILDREN_COLUMNS,
                    "metrics": [],
                    "orderby": [["random()", True]],
                }
            ],
        )
        self._assert_payload_rejected(self._post(payload))

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_forged_tree_export_on_stored_aggregate_chart_is_rejected(self) -> None:
        """The export swap still passes through the stored-chart subset check."""
        self.chart_a.params = json.dumps(
            {**self.chart_a.params_dict, "query_mode": "aggregate"}
        )
        db.session.commit()
        role = security_manager.find_role(self.app.config["GUEST_ROLE_NAME"])
        can_csv = security_manager.find_permission_view_menu("can_csv", "Superset")
        granted = can_csv not in role.permissions
        if granted:
            security_manager.add_permission_role(role, can_csv)
        try:
            payload = self._payload(self.chart_a, MIRRORS, [LEVEL_1_QUERY])
            payload["result_format"] = "csv"
            payload["form_data"]["tree_export"] = {
                "query": {
                    "columns": ["state", "num_boys"],
                    "metrics": [],
                    "orderby": [["state", True]],
                    "post_processing": [],
                }
            }
            self._assert_payload_rejected(self._post(payload))
        finally:
            if granted:
                security_manager.del_permission_role(role, can_csv)

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_payload_check_uses_the_mirrors(self) -> None:
        self._assert_no_broad_grant()
        response = self._assert_allowed(self._post_as_guest(self.chart_a, MIRRORS))
        assert [result["colnames"] for result in response.json["result"]] == [
            CHILDREN_COLUMNS,
            ["state", "COUNT_DISTINCT(name)"],
        ]
        self._assert_payload_rejected(
            self._post_as_guest(self.chart_a, MIRRORS, [*CHILDREN_COLUMNS, "num_boys"])
        )

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_plain_guest_without_mirrors_gets_only_the_stored_query(self) -> None:
        self._assert_no_broad_grant()
        self._assert_allowed(self._post_level_1(self.chart_b))
        self._assert_payload_rejected(self._post_as_guest(self.chart_b, {}))

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_payload_check_ignores_a_cached_anonymous_user(self) -> None:
        self._assert_no_broad_grant()
        self._prime_cached_user()
        self._assert_allowed(self._post_as_guest(self.chart_a, MIRRORS))

        self._prime_cached_user()
        self._assert_allowed(self._post_level_1(self.chart_b))

        self._prime_cached_user()
        self._assert_payload_rejected(self._post_as_guest(self.chart_b, {}))

        self._prime_cached_user()
        self._assert_payload_rejected(
            self._post_as_guest(self.chart_a, MIRRORS, [*CHILDREN_COLUMNS, "num_boys"])
        )

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_parent_page_and_count(self) -> None:
        """The real parent queries fit the mirrors, including sort and search."""
        # Pasted from buildQuery.test.ts: "birth_names parent request for the
        # guest HTTP test". Omitted granularity is undefined in that output.
        page = {
            "columns": ["state", "gender"],
            "metrics": [],
            "orderby": [["gender", False], ["state", True]],
            "filters": [{"col": "state", "op": "ILIKE", "val": "CA%"}],
            "row_limit": 50,
            "row_offset": 0,
        }
        count = {
            **page,
            "orderby": [],
            "row_limit": 120,
            "post_processing": [],
            "is_rowcount": True,
        }
        payload = self._payload(self.chart_a, MIRRORS, [page, count])
        self._assert_no_broad_grant()
        for tampered in (False, True):
            if tampered:
                page["orderby"] = [["num_boys", False]]
            self._prime_cached_user()
            sent = self._post(payload)
            if tampered:
                self._assert_payload_rejected(sent)
            else:
                response = self._assert_allowed(sent)
                assert response.json["result"][1]["data"][0]["rowcount"] > 0

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_children_batch(self) -> None:
        """The real children batch (rows + counts) fits the mirrors."""
        # Pasted from buildChildrenQuery.test.ts: "birth_names children batch
        # for the guest HTTP test".
        children_filters = [
            {"col": "state", "op": "IN", "val": ["CA", "NY"]},
            {"col": "name", "op": "IS NOT NULL"},
        ]
        rows = {
            "columns": ["name", "state", "num"],
            "metrics": [],
            "orderby": [["state", True], ["name", True]],
            "filters": children_filters,
            "row_limit": 100000,
            "row_offset": 0,
            "post_processing": [
                {
                    "operation": "first_n_per_group",
                    "options": {"groupby": ["state"], "n": 100},
                }
            ],
        }
        counts = {
            "columns": ["state"],
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "aggregate": "COUNT_DISTINCT",
                    "column": {"column_name": "name"},
                    "label": "COUNT_DISTINCT(name)",
                }
            ],
            "orderby": [],
            "filters": children_filters,
            "row_limit": 2,
            "row_offset": 0,
            "post_processing": [],
        }
        payload = self._payload(self.chart_a, MIRRORS, [rows, counts], "results")
        self._assert_no_broad_grant()
        for tampered in (False, True):
            if tampered:
                rows["orderby"] = [["num_boys", True]]
            self._prime_cached_user()
            sent = self._post(payload)
            if tampered:
                self._assert_payload_rejected(sent)
            else:
                response = self._assert_allowed(sent)
                rows_result, counts_result = response.json["result"]
                assert rows_result["colnames"] == ["name", "state", "num"]
                assert {row["state"] for row in rows_result["data"]} == {"CA", "NY"}
                totals = {
                    row["state"]: row["COUNT_DISTINCT(name)"]
                    for row in counts_result["data"]
                }
                assert set(totals) == {"CA", "NY"}
                for state, total in totals.items():
                    shown = [
                        row for row in rows_result["data"] if row["state"] == state
                    ]
                    assert len(shown) == min(total, 100)

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_children_load_more_and_sorted_batch(self) -> None:
        """The Load more query and a descending child sort fit the mirrors."""
        # Pasted from buildChildrenQuery.test.ts: "birth_names Load more and
        # descending batch for the guest HTTP test".
        load_more = {
            "columns": ["name", "state", "num"],
            "metrics": [],
            "orderby": [["state", True], ["name", True]],
            "filters": [
                {"col": "state", "op": "IN", "val": ["CA"]},
                {"col": "name", "op": "IS NOT NULL"},
            ],
            "row_limit": 100,
            "row_offset": 100,
            "post_processing": [],
        }
        sorted_filters = [
            {"col": "state", "op": "IN", "val": ["CA", "NY"]},
            {"col": "name", "op": "IS NOT NULL"},
        ]
        sorted_rows = {
            "columns": ["name", "state", "num"],
            "metrics": [],
            "orderby": [["state", True], ["num", False], ["name", True]],
            "filters": sorted_filters,
            "row_limit": 100000,
            "row_offset": 0,
            "post_processing": [
                {
                    "operation": "first_n_per_group",
                    "options": {"groupby": ["state"], "n": 100},
                }
            ],
        }
        sorted_counts = {
            "columns": ["state"],
            "metrics": [
                {
                    "expressionType": "SIMPLE",
                    "aggregate": "COUNT_DISTINCT",
                    "column": {"column_name": "name"},
                    "label": "COUNT_DISTINCT(name)",
                }
            ],
            "orderby": [],
            "filters": sorted_filters,
            "row_limit": 2,
            "row_offset": 0,
            "post_processing": [],
        }
        self._assert_no_broad_grant()
        responses = []
        for queries in ([load_more], [sorted_rows, sorted_counts]):
            self._prime_cached_user()
            responses.append(
                self._assert_allowed(
                    self._post(self._payload(self.chart_a, MIRRORS, queries, "results"))
                )
            )
        more_response, sorted_response = responses
        (more_result,) = more_response.json["result"]
        assert more_result["colnames"] == ["name", "state", "num"]
        assert {row["state"] for row in more_result["data"]} <= {"CA"}
        rows_result, _ = sorted_response.json["result"]
        for state in ("CA", "NY"):
            nums = [row["num"] for row in rows_result["data"] if row["state"] == state]
            assert nums == sorted(nums, reverse=True)
        self._prime_cached_user()
        sorted_rows["orderby"] = [["state", True], ["num_boys", False]]
        self._assert_payload_rejected(
            self._post(
                self._payload(
                    self.chart_a, MIRRORS, [sorted_rows, sorted_counts], "results"
                )
            )
        )

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_three_level_batch(self) -> None:
        """The level-3 batch (two link filters, grouped by both) fits the mirrors."""
        # Pasted from buildChildrenQuery.test.ts: "birth_names three-level batch
        # and mirrors for the guest HTTP test".
        filters = [
            {"col": "state", "op": "IN", "val": ["CA", "NY"]},
            {"col": "gender", "op": "IN", "val": ["boy", "girl"]},
            {"col": "name", "op": "IS NOT NULL"},
        ]
        rows = {
            "columns": ["name", "gender", "num", "state"],
            "metrics": [],
            "orderby": [["state", True], ["gender", True], ["name", True]],
            "filters": filters,
            "row_limit": 100000,
            "row_offset": 0,
            "post_processing": [
                {
                    "operation": "first_n_per_group",
                    "options": {"groupby": ["state", "gender"], "n": 100},
                }
            ],
        }
        counts = {
            "columns": ["state", "gender"],
            "metrics": MIRRORS["tree_metrics"],
            "orderby": [],
            "filters": filters,
            "row_limit": 4,
            "row_offset": 0,
            "post_processing": [],
        }
        payload = self._payload(self.chart_c, MIRRORS_3, [rows, counts], "results")
        self._assert_no_broad_grant()
        for tampered in (False, True):
            if tampered:
                rows["orderby"] = [["state", True], ["num_boys", True]]
            self._prime_cached_user()
            sent = self._post(payload)
            if tampered:
                self._assert_payload_rejected(sent)
                continue
            response = self._assert_allowed(sent)
            rows_result, counts_result = response.json["result"]
            assert rows_result["colnames"] == ["name", "gender", "num", "state"]
            totals = {
                (row["state"], row["gender"]): row["COUNT_DISTINCT(name)"]
                for row in counts_result["data"]
            }
            assert set(totals) == {
                ("CA", "boy"),
                ("CA", "girl"),
                ("NY", "boy"),
                ("NY", "girl"),
            }
            for (state, gender), total in totals.items():
                shown = [
                    row
                    for row in rows_result["data"]
                    if row["state"] == state and row["gender"] == gender
                ]
                assert len(shown) == min(total, 100)

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_children_keep_rls_with_cleared_sql_filters(self) -> None:
        """Clearing chart filters keeps plain guest RLS and rejects new SQL."""
        self._assert_no_broad_grant()
        with self.app.test_request_context():
            self.token = security_manager.create_guest_access_token(
                {"username": "tree-table-filter-guest"},
                [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": str(self.embedded.uuid),
                    }
                ],
                [{"dataset": str(self.table.id), "clause": "gender = 'boy'"}],
            )
        for stored_sql in (False, True):
            params = json.loads(self.chart_c.params)
            context = json.loads(self.chart_c.query_context)
            params["levels"][1].update(
                {"columns": ["num"], "time_column": "ds", "apply_date_filter": True}
            )
            if stored_sql:
                params["adhoc_filters"] = [
                    {
                        "expressionType": "SQL",
                        "clause": "WHERE",
                        "sqlExpression": "num > 0",
                    }
                ]
                context["queries"][0]["extras"] = {"where": "(num > 0)"}
            self.chart_c.params = json.dumps(params)
            self.chart_c.query_context = json.dumps(context)
            db.session.commit()
            parent = self._payload(
                self.chart_c, MIRRORS_3, context["queries"], "results"
            )
            parent["form_data"].update(params)
            self._assert_allowed(self._post(parent))
            # Paired literal in superset-frontend/plugins/plugin-chart-ag-grid-table/
            # src/TreeTable/buildChildrenQuery.test.ts:
            # "birth_names date-filtered guest children with cleared SQL".
            filters = [
                {"col": "ds", "op": "TEMPORAL_RANGE", "val": "1900-01-01 : 2100-01-01"},
                {"col": "state", "op": "IN", "val": ["CA", "NY"]},
                {"col": "gender", "op": "IS NOT NULL"},
            ]
            common = {
                "filters": filters,
                "time_range": "1900-01-01 : 2100-01-01",
                "extras": {"where": "", "having": ""},
                "row_offset": 0,
            }
            rows = {
                **common,
                "columns": ["gender", "state", "num"],
                "metrics": [],
                "orderby": [["state", True], ["gender", True]],
                "row_limit": 100000,
                "post_processing": [
                    {
                        "operation": "first_n_per_group",
                        "options": {"groupby": ["state"], "n": 100},
                    }
                ],
            }
            counts = {
                **common,
                "columns": ["state"],
                "metrics": [COUNT_DISTINCT_GENDER],
                "orderby": [],
                "row_limit": 2,
                "post_processing": [],
            }
            payload = self._payload(self.chart_c, MIRRORS_3, [rows, counts], "results")
            payload["form_data"].update(params)
            payload["form_data"]["adhoc_filters"] = [
                *params.get("adhoc_filters", []),
                {
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                    "subject": "name",
                    "operator": "IN",
                    "comparator": ["Aaron"],
                    "isExtra": True,
                },
            ]
            response = self._assert_allowed(self._post(payload))
            rows_result, counts_result = response.json["result"]
            assert rows_result["data"]
            assert {row["gender"] for row in rows_result["data"]} == {"boy"}
            assert {
                row["state"]: row["COUNT_DISTINCT(gender)"]
                for row in counts_result["data"]
            } == {"CA": 1, "NY": 1}
            rows["orderby"] = [["num_boys", True]]
            self._assert_payload_rejected(self._post(payload))
            rows["orderby"] = [["state", True], ["gender", True]]
            rows["extras"] = {"where": "num_boys > 0", "having": ""}
            self._assert_payload_rejected(self._post(payload))

    @with_feature_flags(EMBEDDED_SUPERSET=True)
    def test_guest_csv_export(self) -> None:
        """The Tree table CSV query keeps guest RLS and the payload check."""
        self._assert_no_broad_grant()
        # Pasted from superset-frontend/plugins/plugin-chart-ag-grid-table/src/
        # TreeTable/exportQuery.test.ts: "birth_names three-level CSV body for
        # the guest HTTP test".
        export: dict[str, Any] = {
            "query": {
                "time_range": "No filter",
                "filters": [],
                "extras": {"having": "", "where": ""},
                "applied_time_extras": {},
                "annotation_layers": [],
                "series_limit": 0,
                "group_others_when_limit_reached": False,
                "order_desc": True,
                "url_params": {},
                "custom_params": {},
                "custom_form_data": {},
                "columns": ["state", "gender", "name", "num"],
                "metrics": [],
                "orderby": [["state", True], ["gender", True], ["name", True]],
                "row_limit": 0,
                "row_offset": 0,
                "post_processing": [
                    {
                        "operation": "tree_rows",
                        "options": {
                            "levels": [
                                {"id_column": "state", "columns": ["state"]},
                                {"id_column": "gender", "columns": ["gender"]},
                                {"id_column": "name", "columns": ["name", "num"]},
                            ],
                            "time_ranges": [],
                        },
                    }
                ],
            },
            "child_filters": [],
        }
        with self.app.test_request_context():
            self.token = security_manager.create_guest_access_token(
                {"username": "tree-table-csv-guest"},
                [
                    {
                        "type": GuestTokenResourceType.DASHBOARD,
                        "id": str(self.embedded.uuid),
                    }
                ],
                [{"dataset": str(self.table.id), "clause": "gender = 'boy'"}],
            )
        role = security_manager.find_role(self.app.config["GUEST_ROLE_NAME"])
        can_csv = security_manager.find_permission_view_menu("can_csv", "Superset")
        granted = can_csv not in role.permissions
        if granted:
            security_manager.add_permission_role(role, can_csv)
        try:
            for stored_sql in (False, True):
                params = json.loads(self.chart_c.params)
                context = json.loads(self.chart_c.query_context)
                body: dict[str, Any] = copy.deepcopy(export)
                body["query"]["filters"] = [
                    {"col": "gender", "op": "IN", "val": ["boy"]}
                ]
                if stored_sql:
                    params["adhoc_filters"] = [
                        {
                            "expressionType": "SQL",
                            "clause": "WHERE",
                            "sqlExpression": "num > 0",
                        }
                    ]
                    context["queries"][0]["extras"] = {"where": "(num > 0)"}
                    body["query"]["extras"] = {"having": "", "where": "(num > 0)"}
                self.chart_c.params = json.dumps(params)
                self.chart_c.query_context = json.dumps(context)
                db.session.commit()
                payload = self._payload(self.chart_c, MIRRORS_3, context["queries"])
                payload["form_data"].update(params)
                payload["form_data"]["tree_export"] = body
                payload["result_format"] = "csv"
                self._prime_cached_user()
                response = self._assert_allowed(self._post(payload))
                assert response.mimetype == "text/csv"
                header, *rows = csv.reader(
                    io.StringIO(response.data.decode("utf-8-sig"))
                )
                assert header == ["state", "gender", "name", "num"]
                assert rows
                assert {row[1] for row in rows} == {"boy"}

                body["query"]["columns"] = [*body["query"]["columns"], "num_boys"]
                self._prime_cached_user()
                self._assert_payload_rejected(self._post(payload))
                body["query"]["columns"] = body["query"]["columns"][:-1]
                body["query"]["extras"] = {"having": "", "where": "num_boys > 0"}
                self._prime_cached_user()
                self._assert_payload_rejected(self._post(payload))
        finally:
            if granted:
                security_manager.del_permission_role(role, can_csv)
