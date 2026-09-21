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
"""HTTP chart saves must preserve semantic identity and datasource access checks."""

from typing import Any
from unittest.mock import Mock, patch

from flask import Response
from parameterized import parameterized

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.extensions import db, security_manager
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase


class TestSemanticChartSave(SupersetTestCase):
    """Use real API schema, commands and persisted view; never query a provider."""

    @parameterized.expand(
        [("create", False), ("update", False), ("create", True), ("update", True)]
    )
    def test_semantic_chart_save(self, operation: str, denied: bool) -> None:
        """Save-as and overwrite populate names and retain the access gate."""
        self.login("admin")
        layer: SemanticLayer = SemanticLayer(name="save-test-layer", type="test")
        view: SemanticView = SemanticView(name="save-test-view", semantic_layer=layer)
        db.session.add(view)
        db.session.commit()
        chart: Slice | None = None
        try:
            if operation == "update":
                chart = Slice(
                    slice_name="before",
                    datasource_id=view.id,
                    datasource_type="semantic_view",
                    viz_type="table",
                    params="{}",
                )
                db.session.add(chart)
                db.session.commit()
            payload: dict[str, Any] = {
                "slice_name": "semantic-save-result",
                "datasource_id": view.id,
                "datasource_type": "semantic_view",
                "viz_type": "table",
                "query_context": json.dumps(
                    {
                        "datasource": {"id": view.id, "type": "semantic_view"},
                        "queries": [],
                    }
                ),
            }
            access: Mock
            with patch.object(
                security_manager,
                "raise_for_access",
                wraps=security_manager.raise_for_access,
            ) as access:
                if denied:
                    access.side_effect = SupersetSecurityException(
                        SupersetError(
                            message="denied semantic view",
                            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                            level=ErrorLevel.ERROR,
                        )
                    )
                response: Response
                if operation == "create":
                    response = self.client.post("/api/v1/chart/", json=payload)
                else:
                    assert chart is not None
                    response = self.client.put(
                        f"/api/v1/chart/{chart.id}", json=payload
                    )
            assert response.status_code == (
                403 if denied else 201 if operation == "create" else 200
            )
            access.assert_any_call(datasource=view)
            if denied:
                assert (
                    db.session.query(Slice)
                    .filter_by(slice_name="semantic-save-result")
                    .count()
                    == 0
                )
                if chart is not None:
                    db.session.refresh(chart)
                    assert chart.slice_name == "before"
                return
            chart = db.session.get(Slice, response.json["id"])
            assert chart is not None
            db.session.refresh(chart)
            assert chart.datasource_type == "semantic_view"
            assert chart.datasource_id == view.id
            assert chart.datasource_name == view.name
            assert chart.resolved_datasource == view
            assert chart.table is None
        finally:
            db.session.rollback()
            if chart is not None:
                db.session.delete(chart)
            db.session.delete(view)
            db.session.delete(layer)
            db.session.commit()

    @parameterized.expand([("query",), ("saved_query",)])
    def test_unsavable_datasource_stays_422(self, datasource_type: str) -> None:
        """The unsupported-type crash protection from #43500 remains intact."""
        self.login("admin")
        response: Response = self.client.post(
            "/api/v1/chart/",
            json={
                "slice_name": "unsupported",
                "datasource_id": 123,
                "datasource_type": datasource_type,
                "viz_type": "table",
            },
        )
        assert response.status_code == 422
        assert response.json["message"]["datasource_type"] == [
            "Datasource type is invalid"
        ]
