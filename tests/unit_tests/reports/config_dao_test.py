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
from uuid import UUID

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.session import Session

from tests.unit_tests.conftest import with_feature_flags


@pytest.fixture
def session_with_tables(session: Session) -> Session:
    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import FIXED_RESOURCE_KEYS, KeyValueResource

    KeyValueEntry.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    session.add(
        KeyValueEntry(
            resource=KeyValueResource.ALERT_REPORT_CONFIG.value,
            uuid=FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
            value=b'{"version": 1, "settings": {}}',
        )
    )
    session.flush()
    return session


def test_config_lock_uses_fixed_row_for_update(mocker: MockerFixture) -> None:
    """The save lock targets the singleton configuration entry."""
    from superset.daos.report import ReportConfigDAO
    from superset.key_value.types import FIXED_RESOURCE_KEYS, KeyValueResource

    get_entry = mocker.patch("superset.daos.report.KeyValueDAO.get_entry")

    ReportConfigDAO.lock_for_update()

    resource = KeyValueResource.ALERT_REPORT_CONFIG
    get_entry.assert_called_once_with(
        resource,
        FIXED_RESOURCE_KEYS[resource],
        for_update=True,
    )


def test_stored_values_empty_and_fallbacks(
    session_with_tables: Session, mocker: MockerFixture
) -> None:
    from superset.daos.report import ReportConfigDAO
    from superset.reports.models import ReportConfigKey

    mocker.patch.dict(
        current_app.config,
        {
            "ALERT_MINIMUM_INTERVAL": 600,
            "REPORT_MINIMUM_INTERVAL": lambda: 900,
        },
    )

    assert ReportConfigDAO.get_stored_values() == {}
    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.ALERT_MINIMUM_INTERVAL)
        == 600
    )
    # Callables in config.py keep being supported as fallbacks.
    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.REPORT_MINIMUM_INTERVAL)
        == 900
    )
    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS)
        is False
    )
    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.ALLOWED_EMAIL_DOMAINS) == []
    )


def test_frequency_validation_uses_saved_report_minimum(
    session_with_tables: Session, mocker: MockerFixture
) -> None:
    """A saved interval takes precedence over the application minimum."""
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import ReportScheduleFrequencyNotAllowed
    from superset.daos.report import ReportConfigDAO
    from superset.reports.models import ReportConfigKey, ReportScheduleType

    mocker.patch.dict(current_app.config, {"REPORT_MINIMUM_INTERVAL": 0})
    ReportConfigDAO.upsert({ReportConfigKey.REPORT_MINIMUM_INTERVAL: 600})
    session_with_tables.flush()

    with pytest.raises(ReportScheduleFrequencyNotAllowed):
        BaseReportScheduleCommand().validate_report_frequency(
            "* * * * *", ReportScheduleType.REPORT
        )


@with_feature_flags(ALERTS_ATTACH_REPORTS=False)
def test_alerts_attach_reports_falls_back_to_feature_flag(
    session_with_tables: Session,
) -> None:
    from superset.daos.report import ReportConfigDAO
    from superset.reports.models import ReportConfigKey

    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.ALERTS_ATTACH_REPORTS)
        is False
    )
    ReportConfigDAO.upsert({ReportConfigKey.ALERTS_ATTACH_REPORTS: True})
    session_with_tables.flush()
    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.ALERTS_ATTACH_REPORTS)
        is True
    )


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_date_format_uses_saved_value_over_feature_flag(
    session_with_tables: Session,
) -> None:
    from superset.daos.report import ReportConfigDAO
    from superset.reports.models import ReportConfigKey

    key = ReportConfigKey.DATE_FORMAT_IN_EMAIL_SUBJECT
    assert ReportConfigDAO.get_effective_value(key) is True
    ReportConfigDAO.upsert({key: False})
    session_with_tables.flush()
    assert ReportConfigDAO.get_effective_value(key) is False


def test_upsert_stores_updates_and_reverts(session_with_tables: Session) -> None:
    from superset.daos.report import ReportConfigDAO
    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import (
        FIXED_RESOURCE_KEYS,
        JsonKeyValueCodec,
        KeyValueResource,
    )
    from superset.reports.models import ReportConfigKey

    ReportConfigDAO.upsert(
        {
            ReportConfigKey.ALLOWED_EMAIL_DOMAINS: ["example.com"],
            ReportConfigKey.ALERT_MINIMUM_INTERVAL: 300,
        }
    )
    session_with_tables.flush()
    assert ReportConfigDAO.get_stored_values() == {
        "allowed_email_domains": ["example.com"],
        "alert_minimum_interval": 300,
    }

    row = (
        session_with_tables.query(KeyValueEntry)
        .filter_by(resource=KeyValueResource.ALERT_REPORT_CONFIG.value)
        .one()
    )
    assert isinstance(row.uuid, UUID)
    assert row.uuid == FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG]
    assert row.expires_on is None
    assert JsonKeyValueCodec().decode(row.value) == {
        "version": 1,
        "settings": {
            "allowed_email_domains": ["example.com"],
            "alert_minimum_interval": 300,
        },
    }
    stored_uuid = row.uuid

    # Explicitly clearing a value retains the row and does not restore fallback.
    ReportConfigDAO.upsert(
        {
            ReportConfigKey.ALLOWED_EMAIL_DOMAINS: ["example.com", "superset.com"],
            ReportConfigKey.ALERT_MINIMUM_INTERVAL: None,
        }
    )
    session_with_tables.flush()
    assert ReportConfigDAO.get_stored_values() == {
        "allowed_email_domains": ["example.com", "superset.com"],
        "alert_minimum_interval": None,
    }
    session_with_tables.expire_all()
    assert (
        session_with_tables.query(KeyValueEntry)
        .filter_by(resource=KeyValueResource.ALERT_REPORT_CONFIG.value)
        .one()
        .uuid
        == stored_uuid
    )
    assert (
        ReportConfigDAO.get_effective_value(ReportConfigKey.ALERT_MINIMUM_INTERVAL)
        is None
    )

    config = ReportConfigDAO.get_effective_config()
    assert set(config) == {key.value for key in ReportConfigKey}
    assert config["allowed_email_domains"] == ["example.com", "superset.com"]


def test_missing_table_propagates_read_failure(session: Session) -> None:
    from superset.daos.report import ReportConfigDAO

    # No create_all: the key_value table does not exist.
    with pytest.raises(SQLAlchemyError):
        ReportConfigDAO.get_stored_values()


def test_find_disallowed_addresses_uses_policy_and_users(
    session_with_tables: Session,
) -> None:
    from superset import security_manager
    from superset.daos.report import ReportConfigDAO
    from superset.reports.models import ReportConfigKey

    user_model = security_manager.user_model
    session_with_tables.add(
        user_model(
            username="alice",
            first_name="Alice",
            last_name="A",
            email="Alice@Example.com",
            active=True,
        )
    )
    session_with_tables.add(
        user_model(
            username="bob",
            first_name="Bob",
            last_name="B",
            email="bob@example.com",
            active=False,
        )
    )
    session_with_tables.flush()

    addresses = ["alice@example.com", "bob@example.com", "carol@superset.com"]

    # No policy configured: everything is allowed.
    assert ReportConfigDAO.find_disallowed_addresses(addresses) == []

    ReportConfigDAO.upsert({ReportConfigKey.LIMIT_RECIPIENTS_TO_USERS: True})
    session_with_tables.flush()
    # Inactive users and unknown addresses are rejected.
    assert ReportConfigDAO.find_disallowed_addresses(addresses) == [
        "bob@example.com",
        "carol@superset.com",
    ]

    # Explicit overrides win over the stored policy.
    assert ReportConfigDAO.find_disallowed_addresses(
        addresses, allowed_domains=["example.com"], limit_to_users=False
    ) == ["carol@superset.com"]


@pytest.mark.parametrize("value", [False, 0, [], None])
def test_stored_value_never_calls_legacy_fallback(
    session_with_tables: Session, mocker: MockerFixture, value: object
) -> None:
    from superset.daos.report import ReportConfigDAO
    from superset.reports.models import ReportConfigKey

    fallback = mocker.patch.object(
        ReportConfigDAO, "get_fallback_value", return_value=999
    )
    key = ReportConfigKey.ALERT_MINIMUM_INTERVAL
    ReportConfigDAO.upsert({key: value})
    session_with_tables.flush()
    assert ReportConfigDAO.get_effective_value(key) == value
    fallback.assert_not_called()
    assert ReportConfigDAO.get_effective_config()[key] == value


def test_invalid_stored_json_propagates(session_with_tables: Session) -> None:
    from superset.daos.report import ReportConfigDAO
    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import FIXED_RESOURCE_KEYS, KeyValueResource

    entry = (
        session_with_tables.query(KeyValueEntry)
        .filter_by(
            resource=KeyValueResource.ALERT_REPORT_CONFIG.value,
            uuid=FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
        )
        .one()
    )
    entry.value = b"broken"
    session_with_tables.flush()
    with pytest.raises(ValueError, match="Expecting value"):
        ReportConfigDAO.get_effective_config()


def test_missing_config_row_uses_application_fallback(
    session_with_tables: Session,
) -> None:
    from superset.daos.key_value import KeyValueDAO
    from superset.daos.report import ReportConfigDAO
    from superset.key_value.types import FIXED_RESOURCE_KEYS, KeyValueResource

    KeyValueDAO.delete_entry(
        KeyValueResource.ALERT_REPORT_CONFIG,
        FIXED_RESOURCE_KEYS[KeyValueResource.ALERT_REPORT_CONFIG],
    )
    session_with_tables.flush()
    assert ReportConfigDAO.get_stored_values() == {}


def test_known_users_are_looked_up_in_bounded_batches(
    session_with_tables: Session,
) -> None:
    from sqlalchemy import event

    from superset.daos.report import ReportConfigDAO

    queries: list[int] = []

    def count_lookup(
        conn: object,
        cursor: object,
        statement: str,
        parameters: tuple[object, ...],
        context: object,
        executemany: bool,
    ) -> None:
        """Record the number of parameters used in each user lookup."""
        if "lower(ab_user.email)" in statement:
            queries.append(len(parameters))

    engine = session_with_tables.get_bind()
    event.listen(engine, "before_cursor_execute", count_lookup)
    try:
        assert (
            ReportConfigDAO.get_known_user_emails(
                [f"person{i}@example.com" for i in range(1001)] * 2
            )
            == set()
        )
    finally:
        event.remove(engine, "before_cursor_execute", count_lookup)
    assert queries == [500, 500, 1]
