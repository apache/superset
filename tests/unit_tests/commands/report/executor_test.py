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
Execution-time behavior introduced by SIP-209: the per-schedule "Run As"
executor, the runtime "attachments for alerts" setting and the recipient
policy enforcement.
"""

from datetime import datetime
from unittest.mock import Mock
from uuid import uuid4

import pytest
from pytest_mock import MockerFixture

from superset.commands.report.alert import AlertCommand
from superset.commands.report.exceptions import (
    ReportScheduleExecutorNotFoundError,
    ReportScheduleRecipientsNotAllowedError,
)
from superset.commands.report.execute import (
    alerts_attach_reports_enabled,
    BaseReportState,
    get_executor_user,
    resolve_executor_user,
)
from superset.reports.models import (
    ReportConfigKey,
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
)
from superset.tasks.exceptions import ExecutorNotFoundError


def _user(username: str, active: bool = True) -> Mock:
    user = Mock()
    user.username = username
    user.is_active = active
    return user


def test_get_executor_user_prefers_run_as_when_enabled(mocker: MockerFixture) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    get_executor = mocker.patch("superset.commands.report.execute.get_executor")
    run_as = _user("explicit")
    model = ReportSchedule()
    model.run_as = run_as
    model.run_as_type = "fixed_user"
    model.run_alert_query_as = None

    assert get_executor_user(model) == (run_as, "explicit")
    assert resolve_executor_user(model) == (run_as, "explicit")
    get_executor.assert_not_called()


def test_get_executor_user_inactive_run_as_is_reported(mocker: MockerFixture) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    model = ReportSchedule()
    model.run_as = _user("gone", active=False)
    model.run_as_type = "fixed_user"
    model.run_alert_query_as = None

    assert get_executor_user(model) == (None, "gone")
    with pytest.raises(ReportScheduleExecutorNotFoundError, match="gone"):
        resolve_executor_user(model)


def test_get_executor_user_falls_back_to_legacy_resolution(
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    mocker.patch(
        "superset.commands.report.execute.get_executor",
        return_value=("editor", "legacy"),
    )
    legacy = _user("legacy")
    mocker.patch(
        "superset.commands.report.execute.security_manager.find_user",
        return_value=legacy,
    )
    model = ReportSchedule()
    model.run_as = _user("stale")
    model.run_as_type = None
    model.run_alert_query_as = None

    assert get_executor_user(model) == (legacy, "legacy")


def test_missing_legacy_executor_has_no_username(mocker: MockerFixture) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=False)
    mocker.patch(
        "superset.commands.report.execute.get_executor",
        side_effect=ExecutorNotFoundError(),
    )
    model = ReportSchedule()

    assert get_executor_user(model) == (None, None)
    with pytest.raises(
        ReportScheduleExecutorNotFoundError,
        match="Scheduled task executor not found",
    ):
        resolve_executor_user(model)


def test_get_executor_user_ignores_run_as_when_feature_disabled(
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=False)
    mocker.patch(
        "superset.commands.report.execute.get_executor",
        return_value=("editor", "legacy"),
    )
    legacy = _user("legacy")
    mocker.patch(
        "superset.commands.report.execute.security_manager.find_user",
        return_value=legacy,
    )
    model = ReportSchedule()
    model.run_as = _user("explicit")
    model.run_as_type = "fixed_user"

    assert get_executor_user(model) == (legacy, "legacy")


def test_alert_query_uses_alert_query_executor(mocker: MockerFixture) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    get_executor = mocker.patch("superset.commands.report.alert.get_executor")
    mocker.patch("superset.commands.report.alert.security_manager.raise_for_access")
    override_user = mocker.patch("superset.commands.report.alert.override_user")
    template_processor = Mock()
    template_processor.process_template.return_value = "SELECT 1"
    mocker.patch(
        "superset.commands.report.alert.jinja_context.get_template_processor",
        return_value=template_processor,
    )
    mocker.patch.object(AlertCommand, "_validate_rendered_sql")
    mocker.patch.dict(
        "flask.current_app.config", {"MUTATE_ALERT_QUERY": False}, clear=False
    )

    query_user = _user("query_user")
    schedule = Mock(run_as_type="fixed_user", run_alert_query_as_type="fixed_user")
    schedule.id = 1
    schedule.sql = "SELECT 1"
    schedule.run_as = _user("content_user")
    schedule.run_alert_query_as = query_user
    schedule.database.apply_limit_to_sql.return_value = "SELECT 1 LIMIT 2"

    AlertCommand(schedule, uuid4())._execute_query()

    override_user.assert_called_once_with(query_user)
    get_executor.assert_not_called()


def test_alert_query_inactive_executor_raises(mocker: MockerFixture) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    template_processor = Mock()
    template_processor.process_template.return_value = "SELECT 1"
    mocker.patch(
        "superset.commands.report.alert.jinja_context.get_template_processor",
        return_value=template_processor,
    )
    mocker.patch.object(AlertCommand, "_validate_rendered_sql")
    mocker.patch.dict(
        "flask.current_app.config", {"MUTATE_ALERT_QUERY": False}, clear=False
    )
    schedule = Mock(run_as_type="fixed_user", run_alert_query_as_type=None)
    schedule.id = 1
    schedule.sql = "SELECT 1"
    schedule.run_as = _user("gone", active=False)
    schedule.run_alert_query_as = None

    with pytest.raises(ReportScheduleExecutorNotFoundError, match="gone"):
        AlertCommand(schedule, uuid4())._execute_query()


@pytest.mark.parametrize(
    ("stored", "flag", "expected"),
    [
        (None, True, True),
        (None, False, False),
        (True, False, True),
        (False, True, False),
    ],
)
def test_alerts_attach_reports_enabled(
    mocker: MockerFixture, stored: bool | None, flag: bool, expected: bool
) -> None:
    mocker.patch(
        "superset.commands.report.execute.ReportConfigDAO.get_effective_value",
        return_value=stored if stored is not None else flag,
    )
    feature_flag_manager = mocker.patch(
        "superset.commands.report.execute.feature_flag_manager"
    )
    feature_flag_manager.is_feature_enabled.return_value = flag

    assert alerts_attach_reports_enabled() is expected


def _policy(allowed_domains: list[str], limit_to_users: bool):
    def effective(key: ReportConfigKey):
        if key == ReportConfigKey.ALLOWED_EMAIL_DOMAINS:
            return allowed_domains
        if key == ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS:
            return limit_to_users
        return None

    return effective


def test_send_refuses_disallowed_recipients(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.report.execute.ReportConfigDAO.get_effective_value",
        side_effect=_policy(["example.com"], False),
    )
    schedule = Mock(spec=ReportSchedule)
    schedule.recipients = [
        ReportRecipients(
            type=ReportRecipientType.EMAIL,
            recipient_config_json=(
                '{"target": "internal@example.com", '
                '"bccTarget": "external@outside.org"}'
            ),
        )
    ]
    schedule.working_timeout = None
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    get_content = mocker.patch.object(state, "_get_notification_content")
    send = mocker.patch.object(state, "_send")

    with pytest.raises(
        ReportScheduleRecipientsNotAllowedError, match="external@outside.org"
    ):
        state.send()

    get_content.assert_not_called()
    send.assert_not_called()


def test_send_skips_policy_when_unrestricted(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.report.execute.ReportConfigDAO.get_effective_value",
        side_effect=_policy([], False),
    )
    find_disallowed = mocker.patch(
        "superset.commands.report.execute.ReportConfigDAO.find_disallowed_addresses"
    )
    schedule = Mock(spec=ReportSchedule)
    schedule.recipients = ["recipient"]
    schedule.working_timeout = None
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    content = Mock()
    mocker.patch.object(state, "_get_notification_content", return_value=content)
    send = mocker.patch.object(state, "_send")

    state.send()

    find_disallowed.assert_not_called()
    send.assert_called_once_with(content, ["recipient"])


@pytest.mark.parametrize("alert_query", [False, True])
def test_deleted_specific_user_never_falls_back(
    mocker: MockerFixture, alert_query: bool
) -> None:
    from superset.reports.utils import get_dynamic_executor

    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    legacy = mocker.patch("superset.commands.report.execute.get_executor")
    schedule = ReportSchedule(run_as_type="fixed_user")
    with pytest.raises(ReportScheduleExecutorNotFoundError):
        get_dynamic_executor(schedule, alert_query=alert_query)
    assert get_executor_user(schedule)[0] is None
    legacy.assert_not_called()


def test_alert_template_and_database_share_query_identity(
    mocker: MockerFixture,
) -> None:
    from flask import g

    from superset.utils.core import get_user

    content_user = _user("content")
    query_user = _user("query")
    mocker.patch.object(g, "user", content_user, create=True)
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    mocker.patch("superset.commands.report.alert.security_manager.raise_for_access")
    mocker.patch.object(AlertCommand, "_validate_rendered_sql")
    mocker.patch.dict("flask.current_app.config", {"MUTATE_ALERT_QUERY": True})
    schedule = Mock(
        run_as=content_user,
        run_alert_query_as=query_user,
        run_as_type="fixed_user",
        run_alert_query_as_type="fixed_user",
    )
    schedule.sql = "SELECT '{{ current_username() }}'"

    def render(sql: str) -> str:
        assert get_user() is query_user
        return "SELECT 'query'"

    def processor(**kwargs: object) -> Mock:
        assert get_user() is query_user
        return Mock(process_template=render)

    def mutate(sql: str) -> str:
        assert get_user() is query_user
        return sql

    def query(**kwargs: object) -> Mock:
        assert get_user() is query_user
        return Mock()

    mocker.patch(
        "superset.commands.report.alert.jinja_context.get_template_processor",
        side_effect=processor,
    )
    schedule.database.apply_limit_to_sql.side_effect = lambda sql, limit: sql
    schedule.database.mutate_sql_based_on_config.side_effect = mutate
    schedule.database.get_df.side_effect = query
    AlertCommand(schedule, uuid4())._execute_query()
    schedule.database.get_df.assert_called_once_with(sql="SELECT 'query'")
    assert get_user() is content_user


def test_retry_notices_skip_disallowed_recipients_but_notify_editors(
    mocker: MockerFixture,
) -> None:
    from superset.subjects.types import SubjectType

    schedule = Mock(spec=ReportSchedule)
    schedule.working_timeout = None
    schedule.retry_notify_owners = True
    schedule.retry_notify_recipients = True
    schedule.editors = [
        Mock(type=SubjectType.USER, user=Mock(email="editor@outside.org"))
    ]
    schedule.recipients = [Mock()]
    schedule.name = "Daily"
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    mocker.patch.object(
        state,
        "_validate_recipients_policy",
        side_effect=ReportScheduleRecipientsNotAllowedError(["recipient@outside.org"]),
    )
    mocker.patch.object(state, "_get_log_data", return_value={})
    mocker.patch.object(state, "_get_url", return_value="https://example.com")
    send = mocker.patch.object(state, "_send")
    state.send_retry_notification(1, 3, "failed")
    recipients = send.call_args.args[1]
    assert len(recipients) == 1
    assert "editor@outside.org" in recipients[0].recipient_config_json
    send.reset_mock()
    with pytest.raises(ReportScheduleRecipientsNotAllowedError):
        state.send_final_failure_report("failed")
    send.assert_not_called()


def test_cleared_attachment_setting_does_not_restore_feature_flag(
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.commands.report.execute.ReportConfigDAO.get_effective_value",
        return_value=None,
    )
    assert alerts_attach_reports_enabled() is False


@pytest.mark.parametrize(
    "exception",
    [
        ReportScheduleExecutorNotFoundError("deleted"),
        ReportScheduleRecipientsNotAllowedError(["blocked@example.com"]),
    ],
)
def test_configuration_errors_never_retry(
    exception: Exception, mocker: MockerFixture
) -> None:
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    schedule = ReportSchedule(
        retry_on_failure=True, retry_attempt=2, retry_max_attempts=3
    )
    state = BaseReportState(schedule, datetime.now(), str(uuid4()))
    reset = mocker.patch.object(state, "_reset_retry_counter")
    schedule_retry = mocker.patch.object(state, "_schedule_retry")
    assert state._handle_retry_or_error(str(exception), exception) is False
    reset.assert_called_once()
    schedule_retry.assert_not_called()


def test_attachment_policy_is_read_for_each_check(mocker: MockerFixture) -> None:
    from superset.reports.models import ReportScheduleType

    policy = mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled",
        side_effect=[True, False],
    )
    state = BaseReportState(
        ReportSchedule(type=ReportScheduleType.ALERT), datetime.now(), str(uuid4())
    )
    assert state._attachments_enabled() is True
    assert state._attachments_enabled() is False
    assert policy.call_count == 2


def test_no_attachment_alert_skips_global_attachment_policy(
    mocker: MockerFixture,
) -> None:
    from superset.reports.models import ReportDataFormat, ReportScheduleType

    policy = mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled"
    )
    state = BaseReportState(
        ReportSchedule(
            type=ReportScheduleType.ALERT,
            report_format=ReportDataFormat.NONE,
        ),
        datetime.now(),
        str(uuid4()),
    )

    assert state._attachments_enabled() is False
    policy.assert_not_called()


@pytest.mark.parametrize("attachments_enabled", [False, True])
def test_no_attachment_content_does_not_resolve_unused_executor(
    attachments_enabled: bool,
    mocker: MockerFixture,
) -> None:
    from superset.reports.models import ReportDataFormat, ReportScheduleType

    schedule = ReportSchedule(
        type=ReportScheduleType.ALERT,
        report_format=ReportDataFormat.NONE,
        run_as_type="fixed_user",
        email_subject="No attachment",
        working_timeout=None,
    )
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled",
        return_value=attachments_enabled,
    )
    resolve = mocker.patch(
        "superset.commands.report.execute.resolve_executor_user",
        side_effect=AssertionError("unused executor"),
    )
    mocker.patch.object(state, "_get_log_data", return_value={})
    mocker.patch.object(state, "_get_url", return_value="https://example.com")
    content = state._get_notification_content()
    assert not content.screenshots
    assert content.csv is None
    assert content.embedded_data is None
    resolve.assert_not_called()


@pytest.mark.parametrize("enabled", [False, True])
def test_condition_query_uses_latest_attachment_policy(
    enabled: bool,
    mocker: MockerFixture,
) -> None:
    from superset.commands.report.execute import ReportNotTriggeredErrorState
    from superset.reports.models import ReportDataFormat, ReportScheduleType

    schedule = ReportSchedule(
        type=ReportScheduleType.ALERT,
        report_format=ReportDataFormat.PNG,
        email_subject="Snapshot",
        working_timeout=None,
    )
    state = ReportNotTriggeredErrorState(schedule, datetime.utcnow(), uuid4())
    policy = mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled",
        return_value=enabled,
    )
    mocker.patch.object(state, "update_report_schedule_and_log")
    mocker.patch.object(state, "_get_log_data", return_value={})
    mocker.patch.object(state, "_get_url", return_value="https://example.com")
    screenshots = mocker.patch.object(
        state, "_get_screenshots", return_value=[b"image"]
    )

    def query() -> tuple[bool, None]:
        policy.return_value = not enabled
        return True, None

    mocker.patch("superset.commands.report.execute.AlertCommand.run", side_effect=query)
    mocker.patch.object(state, "send", side_effect=state._get_notification_content)
    state.next()
    assert screenshots.call_count == int(not enabled)
    assert policy.call_count == 2


@pytest.mark.parametrize(
    ("report_format", "global_enabled"), [("NONE", True), ("PNG", False)]
)
def test_attachment_free_alert_without_asset_builds_message(
    report_format: str, global_enabled: bool, mocker: MockerFixture
) -> None:
    from superset.reports.models import ReportScheduleType

    schedule = ReportSchedule(
        type=ReportScheduleType.ALERT,
        report_format=report_format,
        name="Condition met",
        description="Alert message",
        working_timeout=None,
    )
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled",
        return_value=global_enabled,
    )
    content = state._get_notification_content()
    assert content.name == "Condition met"
    assert content.description == "Alert message"
    assert not content.include_cta
    assert not content.url
    assert not content.screenshots


def test_attachment_free_alert_without_content_user_uses_plain_dashboard_link(
    mocker: MockerFixture,
) -> None:
    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.type = "Alert"
    schedule.report_format = "PNG"
    schedule.dashboard = mocker.Mock()
    schedule.dashboard.dashboard_title = "Dashboard"
    schedule.dashboard.uuid = None
    schedule.dashboard.id = 12
    schedule.dashboard_id = 12
    schedule.chart = None
    schedule.extra = {"dashboard": {"anchor": "TAB-1"}}
    schedule.name = "Condition met"
    schedule.description = "Alert message"
    schedule.email_subject = None
    schedule.include_cta = True
    schedule.working_timeout = None
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    mocker.patch(
        "superset.commands.report.execute.alerts_attach_reports_enabled",
        return_value=False,
    )
    mocker.patch(
        "superset.commands.report.execute.get_executor_user",
        return_value=(None, "inactive"),
    )
    mocker.patch.object(state, "_get_log_data", return_value={})
    permalink = mocker.patch.object(state, "_get_tab_url")
    get_url_path = mocker.patch(
        "superset.commands.report.execute.get_url_path",
        return_value="/dashboard/12/",
    )
    mocker.patch(
        "superset.commands.report.execute.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )

    content = state._get_notification_content()

    assert content.url == "/dashboard/12/"
    assert content.include_cta
    permalink.assert_not_called()
    assert get_url_path.call_args.args[0] == "Superset.dashboard"


def test_attachment_free_alert_without_content_user_uses_plain_chart_link(
    mocker: MockerFixture,
) -> None:
    schedule = mocker.Mock(spec=ReportSchedule)
    schedule.type = "Alert"
    schedule.report_format = "NONE"
    schedule.chart = mocker.Mock()
    schedule.chart.slice_name = "Chart"
    schedule.chart_id = 4
    schedule.dashboard = None
    schedule.name = "Condition met"
    schedule.description = None
    schedule.email_subject = None
    schedule.include_cta = True
    schedule.working_timeout = None
    state = BaseReportState(schedule, datetime.utcnow(), uuid4())
    mocker.patch.object(state, "_get_log_data", return_value={})
    get_url_path = mocker.patch(
        "superset.commands.report.execute.get_url_path",
        return_value="/explore/?slice_id=4",
    )
    get_executor_user = mocker.patch(
        "superset.commands.report.execute.get_executor_user",
        return_value=(None, "inactive"),
    )

    content = state._get_notification_content()

    assert content.url == "/explore/?slice_id=4"
    assert content.include_cta
    assert get_url_path.call_args.args[0] == "ExploreView.root"
    get_executor_user.assert_not_called()
