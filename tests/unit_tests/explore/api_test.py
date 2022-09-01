from typing import Any

import pytest


def test_explore_datasource_not_found(client: Any, full_api_access: None) -> None:
    # validating the payload for a dataset that doesn't exist
    # user should be expecting missing_datasource view
    response = client.get(
        "/api/v1/explore/?dataset_id=50000&dataset_type=table",
    )
    response.json["result"]["dataset"]["name"] == "[Missing Dataset]"
    assert response.status_code == 200
