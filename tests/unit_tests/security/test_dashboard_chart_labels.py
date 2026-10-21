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
"""Direct-call coverage for dashboard chart label authorization."""

from unittest.mock import MagicMock, patch

import pytest

from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.security.manager import SupersetSecurityManager


@pytest.mark.parametrize("is_guest", [False, True])
@pytest.mark.parametrize(
    "is_member,datasource_type", [(False, "table"), (True, "semantic_view")]
)
def test_chart_labels_require_sql_member_chart(
    is_guest: bool, is_member: bool, datasource_type: str
) -> None:
    """The public hook enforces its scope even without the dataset serializer."""
    chart = Slice(id=11, datasource_id=7, datasource_type=datasource_type)
    dashboard = Dashboard(id=17, slices=[chart] if is_member else [])
    manager = MagicMock(spec=SupersetSecurityManager)
    manager.is_guest_user.return_value = is_guest
    manager.can_access_chart.return_value = True
    manager._guest_token_allows_dataset.return_value = True

    assert not SupersetSecurityManager.can_access_dashboard_chart_labels(
        manager, dashboard, chart, guest_dashboard_access=True
    )
    manager.can_access_chart.assert_not_called()
    manager._guest_token_allows_dataset.assert_not_called()


@pytest.mark.parametrize("overridden_method", ["can_access_chart", "raise_for_access"])
def test_chart_labels_honor_base_class_access_wrappers(overridden_method: str) -> None:
    """Replacing a stock method in place must not bypass operator restrictions."""
    chart = Slice(id=11, datasource_id=7, datasource_type="table")
    dashboard = Dashboard(id=17, slices=[chart])
    manager = object.__new__(SupersetSecurityManager)
    custom_check = MagicMock()

    def can_access_chart(self: SupersetSecurityManager, chart: Slice) -> bool:
        """Deny the chart through an operator-installed wrapper."""
        custom_check(chart)
        return False

    def raise_for_access(self: SupersetSecurityManager, *, chart: Slice) -> None:
        """Deny the chart through an operator-installed wrapper."""
        custom_check(chart)
        raise SupersetSecurityException(
            self.get_dashboard_access_error_object(dashboard)
        )

    replacement = (
        can_access_chart
        if overridden_method == "can_access_chart"
        else raise_for_access
    )
    with (
        patch.object(manager, "is_guest_user", return_value=True),
        patch.object(manager, "_guest_token_allows_dataset", return_value=True),
        patch.object(SupersetSecurityManager, overridden_method, replacement),
    ):
        assert not manager.can_access_dashboard_chart_labels(
            dashboard, chart, guest_dashboard_access=True
        )
    custom_check.assert_called_once_with(chart)
