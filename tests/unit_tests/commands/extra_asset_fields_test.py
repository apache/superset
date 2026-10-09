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

from unittest.mock import MagicMock

from flask import current_app


def test_extra_export_fields_absent_by_default() -> None:
    """No hook configured leaves exports untouched."""
    from superset.commands.export.models import get_extra_export_fields

    current_app.config.pop("EXTRA_ASSET_EXPORT_FIELDS", None)
    assert get_extra_export_fields(MagicMock(), "dashboard") == {}


def test_extra_export_fields_uses_hook() -> None:
    """The hook's mapping is returned and receives the asset type."""
    from superset.commands.export.models import get_extra_export_fields

    model = MagicMock()
    hook = MagicMock(return_value={"owning_team": "analytics-platform"})
    current_app.config["EXTRA_ASSET_EXPORT_FIELDS"] = hook
    try:
        assert get_extra_export_fields(model, "chart") == {
            "owning_team": "analytics-platform"
        }
        hook.assert_called_once_with(model, "chart")
    finally:
        current_app.config.pop("EXTRA_ASSET_EXPORT_FIELDS", None)


def test_extra_export_fields_tolerates_none() -> None:
    """A hook returning None must not put a null under ``extra``."""
    from superset.commands.export.models import get_extra_export_fields

    current_app.config["EXTRA_ASSET_EXPORT_FIELDS"] = MagicMock(return_value=None)
    try:
        assert get_extra_export_fields(MagicMock(), "dashboard") == {}
    finally:
        current_app.config.pop("EXTRA_ASSET_EXPORT_FIELDS", None)


def test_extra_import_handler_invoked() -> None:
    """The handler receives the model, asset type and the extra mapping."""
    from superset.commands.importers.v1.utils import apply_extra_import_fields

    model = MagicMock()
    handler = MagicMock()
    current_app.config["EXTRA_ASSET_IMPORT_HANDLER"] = handler
    try:
        apply_extra_import_fields(
            model, "dashboard", {"owning_team": "analytics-platform"}
        )
        handler.assert_called_once_with(
            model, "dashboard", {"owning_team": "analytics-platform"}
        )
    finally:
        current_app.config.pop("EXTRA_ASSET_IMPORT_HANDLER", None)


def test_extra_import_handler_skipped_when_empty() -> None:
    """An absent or empty ``extra`` never reaches the handler."""
    from superset.commands.importers.v1.utils import apply_extra_import_fields

    handler = MagicMock()
    current_app.config["EXTRA_ASSET_IMPORT_HANDLER"] = handler
    try:
        apply_extra_import_fields(MagicMock(), "chart", None)
        apply_extra_import_fields(MagicMock(), "chart", {})
        handler.assert_not_called()
    finally:
        current_app.config.pop("EXTRA_ASSET_IMPORT_HANDLER", None)


def test_import_schemas_accept_extra() -> None:
    """``extra`` must survive schema validation, which defaults to RAISE."""
    from superset.charts.schemas import ImportV1ChartSchema
    from superset.dashboards.schemas import ImportV1DashboardSchema

    assert "extra" in ImportV1DashboardSchema().fields
    assert "extra" in ImportV1ChartSchema().fields
