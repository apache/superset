# dodo added 44211751
from __future__ import annotations

from typing import Any, TYPE_CHECKING

from tests.integration_tests.dashboards.filter_sets.consts import (
    DASHBOARD_OWNER_USERNAME,
    FILTER_SET_OWNER_USERNAME,
    REGULAR_USER,
)
from tests.integration_tests.dashboards.filter_sets.utils import (
    call_get_filter_sets,
    collect_all_ids,
)
from tests.integration_tests.test_app import login

if TYPE_CHECKING:
    from flask.testing import FlaskClient

    from superset.models.filter_set import FilterSet


class TestGetFilterSetsApi:
    def test_with_dashboard_not_exists__404(
        self,
        not_exists_dashboard_id: int,
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")

        # act
        response = call_get_filter_sets(client, not_exists_dashboard_id)

        # assert
        assert response.status_code == 404

    def test_dashboards_without_filtersets__200(
        self, dashboard_id: int, client: FlaskClient[Any]
    ):
        # arrange
        login(client, "admin")

        # act
        response = call_get_filter_sets(client, dashboard_id)

        # assert
        assert response.status_code == 200
        assert response.is_json and response.json["count"] == 0

    def test_when_caller_admin__200(
        self,
        dashboard_id: int,
        filtersets: dict[str, list[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, "admin")
        expected_ids: set[int] = collect_all_ids(filtersets)

        # act
        response = call_get_filter_sets(client, dashboard_id)

        # assert
        assert response.status_code == 200
        assert response.is_json and set(response.json["ids"]) == expected_ids

    def test_when_caller_dashboard_owner__200(
        self,
        dashboard_id: int,
        filtersets: dict[str, list[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, DASHBOARD_OWNER_USERNAME)
        expected_ids = collect_all_ids(filtersets["Dashboard"])

        # act
        response = call_get_filter_sets(client, dashboard_id)

        # assert
        assert response.status_code == 200
        assert response.is_json and set(response.json["ids"]) == expected_ids

    def test_when_caller_filterset_owner__200(
        self,
        dashboard_id: int,
        filtersets: dict[str, list[FilterSet]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, FILTER_SET_OWNER_USERNAME)
        expected_ids = collect_all_ids(filtersets[FILTER_SET_OWNER_USERNAME])

        # act
        response = call_get_filter_sets(client, dashboard_id)

        # assert
        assert response.status_code == 200
        assert response.is_json and set(response.json["ids"]) == expected_ids

    def test_when_caller_regular_user__200(
        self,
        dashboard_id: int,
        filtersets: dict[str, list[int]],
        client: FlaskClient[Any],
    ):
        # arrange
        login(client, REGULAR_USER)
        expected_ids: set[int] = set()

        # act
        response = call_get_filter_sets(client, dashboard_id)

        # assert
        assert response.status_code == 200
        assert response.is_json and set(response.json["ids"]) == expected_ids
