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
"""Chart export endpoint error mapping."""

from collections.abc import Callable, Iterator
from typing import Any

from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import DatasetNotFoundError


def test_export_maps_inaccessible_dataset_to_not_found(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    """sc-123442: a chart whose dataset the caller cannot access returns the
    dataset export's bounded 404 instead of a 500, without naming the dataset."""

    def run() -> Iterator[tuple[str, Callable[[], str]]]:
        yield "charts/chart.yaml", lambda: "slice_name: chart\n"
        # ExportDatasetsCommand hides datasets outside the caller's access.
        raise DatasetNotFoundError()

    command: Any = mocker.patch("superset.charts.api.ExportChartsCommand")
    command.return_value.run.side_effect = run

    response: Any = client.get("/api/v1/chart/export/?q=!(1)")

    assert response.status_code == 404
    assert response.json == {"message": "Not found"}
