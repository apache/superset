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
"""Deployment registration and request-time task access are independent."""

import inspect
from collections.abc import Callable
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, Response
from flask.testing import FlaskClient
from werkzeug.exceptions import NotFound

from superset.charts.data.api import ChartDataRestApi
from superset.commands.tasks.exceptions import GlobalTaskFrameworkDisabledError
from superset.commands.tasks.submit import SubmitTaskCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.initialization import SupersetAppInitializer
from superset.tasks.api import TaskRestApi
from superset.tasks.decorators import task
from superset.tasks.manager import TaskManager
from superset.views.tasks import TaskModelView


@pytest.mark.parametrize("configured", [False, True])
@pytest.mark.parametrize(
    "defaults,overrides,warn",
    [
        ({}, {}, False),
        ({"GLOBAL_TASK_FRAMEWORK": False, "GLOBAL_ASYNC_QUERIES": False}, {}, False),
        ({"GLOBAL_TASK_FRAMEWORK": True}, {}, True),
        ({"GLOBAL_ASYNC_QUERIES": True}, {}, True),
        ({}, {"GLOBAL_TASK_FRAMEWORK": True}, True),
        ({}, {"GLOBAL_ASYNC_QUERIES": True}, True),
        (
            {"GLOBAL_TASK_FRAMEWORK": True, "GLOBAL_ASYNC_QUERIES": True},
            {"GLOBAL_TASK_FRAMEWORK": False, "GLOBAL_ASYNC_QUERIES": False},
            False,
        ),
        (
            {"GLOBAL_TASK_FRAMEWORK": True},
            {"GLOBAL_TASK_FRAMEWORK": False, "GLOBAL_ASYNC_QUERIES": True},
            True,
        ),
        (
            {"GLOBAL_ASYNC_QUERIES": True},
            {"GLOBAL_ASYNC_QUERIES": False, "GLOBAL_TASK_FRAMEWORK": True},
            True,
        ),
        ({"GLOBAL_TASK_FRAMEWORK": True, "GLOBAL_ASYNC_QUERIES": True}, {}, True),
    ],
)
def test_task_manager_static_flag_warning(
    configured: bool,
    defaults: dict[str, bool],
    overrides: dict[str, bool],
    warn: bool,
) -> None:
    """Static diagnostics neither resolve runtime flags nor install disabled tasks."""
    app = Flask(__name__)
    app.config.from_object("superset.config")
    callbacks = {
        name: MagicMock(side_effect=AssertionError("startup evaluated a callback"))
        for name in ("GET_FEATURE_FLAGS_FUNC", "IS_FEATURE_ENABLED_FUNC")
    }
    app.config.update(
        GLOBAL_TASK_FRAMEWORK_ENABLED=configured,
        DEFAULT_FEATURE_FLAGS=defaults.copy(),
        FEATURE_FLAGS=overrides.copy(),
        **callbacks,
    )
    initializer = SupersetAppInitializer(app)
    config_before = dict(app.config)
    extensions_before = dict(app.extensions)
    handlers_before = dict(app.before_request_funcs)

    with (
        patch("superset.initialization.logger") as log,
        patch("superset.initialization.feature_flag_manager") as flags,
        patch("superset.is_feature_enabled") as resolve_flag,
        patch("superset.tasks.manager.TaskManager.init_app") as init_manager,
    ):
        initializer.configure_task_manager()

    flags.assert_not_called()
    assert not flags.mock_calls
    resolve_flag.assert_not_called()
    for callback in callbacks.values():
        callback.assert_not_called()
    if configured:
        init_manager.assert_called_once_with(app)
    else:
        init_manager.assert_not_called()
    if warn and not configured:
        log.warning.assert_called_once_with(
            "Static GLOBAL_TASK_FRAMEWORK or GLOBAL_ASYNC_QUERIES feature "
            "flags do not install task infrastructure. Set "
            "GLOBAL_TASK_FRAMEWORK_ENABLED=True to use it; with config "
            "disabled, task infrastructure remains disabled and chart "
            "queries remain synchronous."
        )
    else:
        log.warning.assert_not_called()
    assert app.config == config_before
    assert app.config["DEFAULT_FEATURE_FLAGS"] == defaults
    assert app.config["FEATURE_FLAGS"] == overrides
    assert app.extensions == extensions_before
    assert app.before_request_funcs == handlers_before


@pytest.mark.parametrize("configured", [False, True])
@pytest.mark.parametrize("enabled", [False, True])
def test_task_registration(configured: bool, enabled: bool) -> None:
    """Task installation never evaluates request-time GTF flags."""
    app = Flask(__name__)
    app.config.from_object("superset.config")
    app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured
    initializer = SupersetAppInitializer(app)

    def resolve_flag(name: str) -> bool:
        assert name != "GLOBAL_TASK_FRAMEWORK", "startup must not resolve GTF"
        return False

    with (
        app.app_context(),
        patch("superset.initialization.appbuilder") as builder,
        patch(
            "superset.initialization.feature_flag_manager.is_feature_enabled",
            side_effect=resolve_flag,
        ) as flag,
        patch.object(initializer, "register_request_handlers"),
        patch("superset.tasks.manager.TaskManager.init_app") as init_manager,
    ):
        initializer.init_views()
        initializer.configure_task_manager()
        assert (
            TaskRestApi in [call.args[0] for call in builder.add_api.call_args_list]
        ) is configured
        task_views = [
            call
            for call in builder.add_view.call_args_list
            if call.args[0] is TaskModelView
        ]
        assert bool(task_views) is configured
        assert init_manager.call_count == int(configured)
        if configured:
            flag.side_effect = None
            for value in (enabled, not enabled, enabled):
                flag.return_value = value
                assert task_views[0].kwargs["menu_cond"]() is value
            assert len(task_views) == 1


@pytest.mark.parametrize("configured", [False, True])
@pytest.mark.parametrize("enabled", [False, True])
def test_task_api_and_page_gates(configured: bool, enabled: bool) -> None:
    """Task APIs use config; the Tasks page additionally requires its UI flag."""
    app = Flask(__name__)
    app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured
    with (
        app.test_request_context(),
        patch("superset.is_feature_enabled", return_value=enabled),
        patch("superset.views.tasks.is_feature_enabled", return_value=enabled),
        patch(
            "superset.views.tasks.BaseSupersetView.render_app_template",
            return_value="page",
        ) as render,
    ):
        response = TaskRestApi().ensure_task_framework_enabled()
        assert (response is None) is configured
        if not configured:
            assert response.status_code == 404
        if configured and enabled:
            assert TaskModelView.list.__wrapped__(TaskModelView()) == "page"
        else:
            with pytest.raises(NotFound):
                TaskModelView.list.__wrapped__(TaskModelView())
            render.assert_not_called()


@pytest.mark.parametrize("entrypoint", ["call", "schedule", "command", "manager"])
@pytest.mark.parametrize("configured,enabled", [(False, False), (False, True)])
def test_disabled_admission_has_no_side_effects(
    entrypoint: str, configured: bool, enabled: bool
) -> None:
    """Wrapper and lower-level admission cannot bypass disabled infrastructure."""
    app = Flask(__name__)
    app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured

    @task(name=f"test_disabled_admission_{entrypoint}_{configured}_{enabled}")
    def body() -> None:
        raise AssertionError("disabled task executed")

    submissions: dict[str, Callable[[], object]] = {
        "call": body,
        "schedule": body.schedule,
        "command": SubmitTaskCommand({}).run,
        "manager": lambda: TaskManager.submit_task(
            body.name, None, None, body.scope, None, (), {}
        ),
    }
    with (
        app.test_request_context(),
        patch("superset.is_feature_enabled", return_value=enabled),
        patch("superset.commands.tasks.submit.task_lock") as lock,
        pytest.raises(GlobalTaskFrameworkDisabledError),
    ):
        submissions[entrypoint]()
    lock.assert_not_called()


@pytest.mark.parametrize("configured", [False, True])
@pytest.mark.parametrize("gtf", [False, True])
@pytest.mark.parametrize("gaq", [False, True])
def test_async_requires_all_prerequisites(
    configured: bool, gtf: bool, gaq: bool
) -> None:
    """Async eligibility is independent of the Tasks UI flag."""
    app = Flask(__name__)
    app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured
    query = MagicMock(
        result_format=ChartDataResultFormat.JSON, result_type=ChartDataResultType.FULL
    )
    query.get_cache_timeout.return_value = 300
    flags = {"GLOBAL_TASK_FRAMEWORK": gtf, "GLOBAL_ASYNC_QUERIES": gaq}
    with (
        app.test_request_context(),
        patch(
            "superset.charts.data.api.is_feature_enabled", side_effect=flags.__getitem__
        ),
        patch("superset.charts.data.api.cache_manager"),
        patch("superset.charts.data.api.get_user_id", return_value=1),
        patch(
            "superset.charts.data.api.security_manager.can_access", return_value=True
        ),
    ):
        assert ChartDataRestApi()._should_run_async({"async_mode": True}, query) is (
            configured and gaq
        )
        if not (configured and gtf):
            with (
                patch(
                    "superset.views.tasks.is_feature_enabled",
                    side_effect=flags.__getitem__,
                ),
                pytest.raises(NotFound),
            ):
                TaskModelView.list.__wrapped__(TaskModelView())


@pytest.mark.parametrize(
    "app", [{"GLOBAL_TASK_FRAMEWORK_ENABLED": True}], indirect=True
)
def test_task_api_runtime_flip_preserves_registration(
    app: Flask, client: FlaskClient, full_api_access: None
) -> None:
    """Config gates all endpoints; a disabled UI flag does not block polling/cancel."""
    paths = [
        ("get", "/api/v1/task/"),
        ("get", "/api/v1/task/_info"),
        ("get", "/api/v1/task/1"),
        ("get", "/api/v1/task/related/created_by"),
        ("get", "/api/v1/task/related/subscribers"),
        ("get", "/api/v1/task/distinct/task_type"),
        ("get", "/api/v1/task/00000000-0000-0000-0000-000000000001/status"),
        ("get", "/api/v1/task/status_changes"),
        ("post", "/api/v1/task/00000000-0000-0000-0000-000000000001/cancel"),
    ]
    adapter = app.url_map.bind("localhost")
    for method, path in paths:
        adapter.match(path, method=method.upper())
    rules = tuple(str(rule) for rule in app.url_map.iter_rules())
    with (
        patch("superset.is_feature_enabled", return_value=False),
        patch(
            "superset.daos.tasks.TaskDAO.get_statuses_changed_since",
            return_value=({}, None),
        ),
        patch(
            "superset.daos.tasks.TaskDAO.get_status",
            return_value="success",
        ),
        patch.object(
            TaskRestApi, "_execute_cancel", return_value=Response(status=200)
        ) as cancel,
    ):
        for configured in (False, True, False):
            app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured
            if configured:
                assert client.get("/api/v1/task/_info").status_code == 200
                assert client.get("/api/v1/task/status_changes").status_code == 200
                assert client.get(paths[-3][1]).status_code == 200
                assert client.post(paths[-1][1]).status_code == 200
                cancel.assert_called_once()
            else:
                for method, path in paths:
                    assert getattr(client, method)(path).status_code == 404
            assert tuple(str(rule) for rule in app.url_map.iter_rules()) == rules
        app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = True


@pytest.mark.parametrize(
    "callback", ["IS_FEATURE_ENABLED_FUNC", "GET_FEATURE_FLAGS_FUNC"]
)
@pytest.mark.parametrize("configured", [False, True])
def test_stock_gaq_derivation_remains_unchanged(
    callback: str, configured: bool
) -> None:
    """Both standard callback hooks retain GAQ-implies-GTF resolution."""
    from superset.utils.feature_flag_manager import FeatureFlagManager

    app = Flask(__name__)
    app.config.from_object("superset.config")
    app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured
    if callback == "IS_FEATURE_ENABLED_FUNC":
        app.config[callback] = lambda name, default: name == "GLOBAL_ASYNC_QUERIES"
    else:
        app.config[callback] = lambda flags: {
            **flags,
            "GLOBAL_ASYNC_QUERIES": True,
            "GLOBAL_TASK_FRAMEWORK": False,
        }
    manager = FeatureFlagManager()
    manager.init_app(app)
    assert manager.is_feature_enabled("GLOBAL_ASYNC_QUERIES")
    assert manager.is_feature_enabled("GLOBAL_TASK_FRAMEWORK")
    assert manager.get_feature_flags()["GLOBAL_TASK_FRAMEWORK"]

    with (
        app.test_request_context(),
        patch(
            "superset.views.tasks.is_feature_enabled",
            side_effect=manager.is_feature_enabled,
        ),
        patch(
            "superset.views.tasks.BaseSupersetView.render_app_template",
            return_value="page",
        ),
    ):
        if configured:
            assert TaskModelView.list.__wrapped__(TaskModelView()) == "page"
        else:
            with pytest.raises(NotFound):
                TaskModelView.list.__wrapped__(TaskModelView())


@pytest.mark.parametrize("configured,gaq", [(False, True), (True, False)])
def test_chart_request_falls_back_to_sync(configured: bool, gaq: bool) -> None:
    """Even an explicit async request cannot create an unresolvable 202."""
    app = Flask(__name__)
    app.config["GLOBAL_TASK_FRAMEWORK_ENABLED"] = configured
    api = ChartDataRestApi()
    with (
        app.test_request_context(json={"async_mode": True}),
        patch(
            "superset.charts.data.api.is_feature_enabled",
            side_effect=lambda name: gaq if name == "GLOBAL_ASYNC_QUERIES" else False,
        ),
        patch.object(api, "_create_query_context_from_form"),
        patch("superset.charts.data.api.ChartDataCommand") as command,
        patch.object(api, "_run_async") as run_async,
        patch.object(
            api, "_get_data_response", return_value=Response(status=200)
        ) as run_sync,
    ):
        response = inspect.unwrap(ChartDataRestApi.data)(api)
    assert response.status_code == 200
    command.return_value.validate.assert_called_once_with()
    run_async.assert_not_called()
    run_sync.assert_called_once()


@pytest.mark.parametrize(
    "app", [{"GLOBAL_TASK_FRAMEWORK_ENABLED": True}], indirect=True
)
def test_task_services_retain_rbac_with_ui_off(
    app: Flask, client: FlaskClient, full_api_access: None
) -> None:
    """An enabled service and hidden UI do not grant Task permissions."""
    from superset import security_manager

    with (
        patch(
            "superset.extensions.feature_flag_manager.is_feature_enabled",
            return_value=False,
        ),
        patch.object(security_manager, "is_item_public", return_value=False),
        patch.object(security_manager, "has_access", return_value=False),
        patch("superset.daos.tasks.TaskDAO.get_statuses_changed_since") as statuses,
        patch.object(TaskRestApi, "_execute_cancel") as cancel,
    ):
        assert client.get("/api/v1/task/status_changes").status_code == 403
        assert (
            client.post(
                "/api/v1/task/00000000-0000-0000-0000-000000000001/cancel"
            ).status_code
            == 403
        )
    statuses.assert_not_called()
    cancel.assert_not_called()
