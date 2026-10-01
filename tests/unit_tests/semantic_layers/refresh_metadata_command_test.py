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
from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import cast
from unittest.mock import MagicMock, Mock, patch
from uuid import UUID

import pytest
from flask import Flask, g
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    MetadataRefreshResult,
)

MODULE: str = "superset.commands.semantic_layer.refresh_metadata"
VIEW_UUID: UUID = UUID("bd2f07da-c65e-40da-b75e-c62b7cdd67f1")


@pytest.fixture
def refresh_context(app: Flask) -> Iterator[tuple[Mock, Mock, Mock]]:
    """Authorize synthetic records; provider construction is always observable."""
    from superset.commands.semantic_layer import refresh_metadata as module

    layer: Mock = Mock(uuid="connection", type="test", configuration='{"token":"test"}')
    view: Mock = Mock(
        uuid=VIEW_UUID, semantic_layer_uuid="connection", configuration="{}"
    )
    view.name = "full"
    view.semantic_layer = layer
    provider: Mock = Mock()
    provider.supports_metadata_refresh.return_value = True
    manager: Mock = Mock()
    with (
        app.app_context(),
        patch.object(
            g,
            "user",
            Mock(id=1, is_anonymous=False, is_guest_user=False),
            create=True,
        ),
        patch.object(module, "Session", return_value=MagicMock()),
        patch.object(module, "operation_deadline", return_value=130.0),
        patch.object(module, "metadata_refresh_enabled", return_value=True),
        patch.object(module, "security_manager", manager),
        patch.object(module, "current_user_can_modify_object", return_value=True),
        patch.object(module, "connection_metadata_scope", return_value="scope"),
        patch.dict(module.registry, {"test": provider}),
        patch.object(module.SemanticViewDAO, "find_by_uuid", return_value=view),
        patch.object(module, "guarded_store"),
        patch.object(module.db, "session", MagicMock()),
    ):
        cast(
            Mock, module.Session
        ).return_value.__enter__.return_value.get.return_value = Mock(
            id=1, is_anonymous=False, is_guest_user=False, is_active=True
        )
        yield view, provider, manager


def test_refresh_uses_stored_connection_after_all_authority_checks(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.refresh_metadata import RefreshMetadataCommand

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    result: MetadataRefreshResult = RefreshMetadataCommand(VIEW_UUID).run()
    provider.from_configuration.assert_called_once_with({"token": "test"})
    adapter: Mock = provider.from_configuration.return_value.metadata_refresh
    assert result is adapter.refresh.return_value
    adapter.bind.assert_called_once_with(
        cast(Mock, module.guarded_store).return_value,
        deadline=130.0,
    )
    adapter.refresh.assert_called_once_with(deadline=130.0)
    manager.can_access.assert_any_call("can_read", "SemanticView")
    manager.can_access.assert_any_call("can_read", "SemanticLayer")
    manager.can_access.assert_any_call("can_write", "SemanticLayer")
    view.raise_for_access.assert_called_once()
    view.semantic_layer.raise_for_access.assert_called_once()


@pytest.mark.parametrize(
    "permission",
    [
        ("can_read", "SemanticView"),
        ("can_read", "SemanticLayer"),
        ("can_write", "SemanticLayer"),
    ],
)
def test_denied_permissions_do_no_provider_or_cache_work(
    refresh_context: tuple[Mock, Mock, Mock],
    permission: tuple[str, str],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    manager.can_access.side_effect = (
        lambda action, resource: (action, resource) != permission
    )
    with pytest.raises(SemanticLayerForbiddenError):
        module.RefreshMetadataCommand(VIEW_UUID).run()
    assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


def test_creator_without_edit_authority_cannot_refresh(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError

    view: Mock
    provider: Mock
    view, provider, _ = refresh_context
    with patch.object(module, "current_user_can_modify_object", return_value=False):
        with pytest.raises(SemanticLayerForbiddenError):
            module.RefreshMetadataCommand(VIEW_UUID).run()
        assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()


def test_disabled_refresh_is_unavailable_without_discovery(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import SemanticViewNotFoundError

    view: Mock
    provider: Mock
    view, provider, _ = refresh_context
    with patch.object(module, "metadata_refresh_enabled", return_value=False):
        with pytest.raises(SemanticViewNotFoundError):
            module.RefreshMetadataCommand(VIEW_UUID).run()
        assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()


def test_unsupported_provider_is_not_constructed(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    view: Mock
    provider: Mock
    view, provider, _ = refresh_context
    provider.supports_metadata_refresh.return_value = False
    with pytest.raises(MetadataRefreshError, match="unsupported"):
        module.RefreshMetadataCommand(VIEW_UUID).run()
    assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()


@pytest.mark.parametrize(
    "changed", ["missing", "connection", "configuration", "name", "authority"]
)
def test_publication_revalidates_view_in_supplied_fresh_session(
    refresh_context: tuple[Mock, Mock, Mock],
    changed: str,
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    module.RefreshMetadataCommand(VIEW_UUID).run()
    guard: Callable[[], None] = cast(Mock, module.guarded_store).call_args.kwargs[
        "before_publish"
    ]
    fresh: Mock = Mock(
        uuid=VIEW_UUID, semantic_layer_uuid="connection", configuration="{}"
    )
    fresh.name = "full"
    fresh.semantic_layer = view.semantic_layer
    session: Mock = cast(Mock, module.Session).return_value.__enter__.return_value
    cast(Mock, module.SemanticViewDAO.find_by_uuid).return_value = fresh
    if changed == "missing":
        cast(Mock, module.SemanticViewDAO.find_by_uuid).return_value = None
    elif changed == "connection":
        fresh.semantic_layer_uuid = "another"
    elif changed == "configuration":
        fresh.configuration = '{"metrics": ["old"]}'
    elif changed == "name":
        fresh.name = "another"
    else:
        manager.can_access.return_value = False
    with pytest.raises((MetadataRefreshError, SemanticLayerForbiddenError)):
        guard()
    session.commit.assert_not_called()
    session.rollback.assert_not_called()


def test_incomplete_configuration_is_sanitized_before_construction(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    provider.supports_metadata_refresh.side_effect = ValueError("private configuration")
    with pytest.raises(MetadataRefreshError, match="^configuration$"):
        module.RefreshMetadataCommand(VIEW_UUID).run()
    assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


@pytest.mark.parametrize("resource", ["view", "layer"])
def test_datasource_access_denial_matches_capability_and_prevents_construction(
    refresh_context: tuple[Mock, Mock, Mock], resource: str
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    target: Mock = view if resource == "view" else view.semantic_layer
    target.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="controlled denial",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    with pytest.raises(SemanticLayerForbiddenError):
        module.RefreshMetadataCommand(VIEW_UUID).run()
    assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


@pytest.mark.parametrize("target", ["view", "layer"])
def test_missing_stored_target_does_not_construct_provider(
    refresh_context: tuple[Mock, Mock, Mock], target: str
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import (
        SemanticLayerNotFoundError,
        SemanticViewNotFoundError,
    )

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    if target == "view":
        cast(Mock, module.SemanticViewDAO.find_by_uuid).return_value = None
    else:
        view.semantic_layer = None
    with pytest.raises((SemanticViewNotFoundError, SemanticLayerNotFoundError)):
        module.RefreshMetadataCommand(VIEW_UUID).run()
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


@pytest.mark.parametrize("principal", ["anonymous", "guest", "inactive"])
def test_ineligible_principal_has_no_capability_or_provider_work(
    refresh_context: tuple[Mock, Mock, Mock], principal: str
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    user: Mock = Mock(
        id=1,
        is_anonymous=principal == "anonymous",
        is_guest_user=principal == "guest",
        is_active=principal != "inactive",
    )
    cast(
        Mock, module.Session
    ).return_value.__enter__.return_value.get.return_value = user
    with patch.object(g, "user", user):
        with pytest.raises(SemanticLayerForbiddenError):
            module.RefreshMetadataCommand(VIEW_UUID).run()
        assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


def test_unregistered_provider_has_no_capability_or_construction(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    with patch.dict(module.registry, {}, clear=True):
        with pytest.raises(MetadataRefreshError, match="^unsupported$"):
            module.RefreshMetadataCommand(VIEW_UUID).run()
        assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


@pytest.mark.parametrize("namespace", [None, "", 7])
def test_missing_trusted_namespace_denies_before_provider_construction(
    refresh_context: tuple[Mock, Mock, Mock], namespace: object
) -> None:
    from flask import current_app

    from superset.commands.semantic_layer import refresh_metadata as module
    from superset.semantic_layers.metadata_binding import connection_metadata_scope

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    with (
        patch.object(module, "connection_metadata_scope", connection_metadata_scope),
        patch.dict(
            current_app.config, {"SEMANTIC_LAYER_METADATA_NAMESPACE": namespace}
        ),
    ):
        with pytest.raises(MetadataRefreshError, match="^configuration$"):
            module.RefreshMetadataCommand(VIEW_UUID).run()
        assert module.can_refresh_metadata(view) is False
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


def test_capability_projection_does_not_construct_or_acquire_metadata(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    assert module.can_refresh_metadata(view) is True
    provider.supports_metadata_refresh.assert_called_once_with({"token": "test"})
    provider.from_configuration.assert_not_called()
    cast(Mock, module.guarded_store).assert_not_called()


@pytest.mark.parametrize(
    "command_name,method",
    [
        ("InvalidateCatalogCommand", "invalidate_catalog"),
        ("InvalidateCompatibilityCommand", "invalidate_compatibility"),
        ("InspectCatalogCommand", "inspect_catalog"),
    ],
)
def test_separate_controls_never_construct_a_provider(
    refresh_context: tuple[Mock, Mock, Mock],
    command_name: str,
    method: str,
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    getattr(module, command_name)(VIEW_UUID).run()
    store: Mock = cast(Mock, module.guarded_store).return_value
    getattr(store, method).assert_called_once_with()
    provider.from_configuration.assert_not_called()
    store.refresh.assert_not_called()
    store.read.assert_not_called()


def test_compatibility_inspection_never_fills_missing_identity(
    refresh_context: tuple[Mock, Mock, Mock],
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    view: Mock
    provider: Mock
    manager: Mock
    view, provider, manager = refresh_context
    identity: Mock
    with patch.object(module, "compatibility_identity", return_value=None) as identity:
        result: module.CacheEntryInfo = module.InspectCompatibilityCommand(
            VIEW_UUID, ["orders"], []
        ).run()
        assert result.kind == "compatibility"
        assert result.state == "missing"
        identity.assert_called_once_with(view, ["orders"], [], inspection=True)
    provider.from_configuration.assert_not_called()
