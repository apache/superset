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
from unittest.mock import Mock

import pytest
from pytest_mock import MockerFixture

from superset.reports.models import ReportRecipientType
from superset.reports.utils import (
    cron_meets_minimum_interval,
    find_disallowed_addresses,
    get_dynamic_executor,
    get_email_addresses,
    get_email_domain,
    split_email_addresses,
)


def test_split_email_addresses_handles_separators_and_blanks() -> None:
    assert split_email_addresses("a@x.com, b@y.org;c@z.net ,, ") == [
        "a@x.com",
        "b@y.org",
        "c@z.net",
    ]
    assert split_email_addresses(None) == []
    assert split_email_addresses("") == []


def test_get_email_addresses_from_dict_payload_includes_cc_and_bcc() -> None:
    recipients = [
        {
            "type": ReportRecipientType.EMAIL,
            "recipient_config_json": {
                "target": "to@x.com",
                "ccTarget": "cc@x.com",
                "bccTarget": "bcc@x.com",
            },
        },
        {"type": ReportRecipientType.SLACK, "recipient_config_json": {"target": "#c"}},
    ]
    assert get_email_addresses(recipients) == ["to@x.com", "cc@x.com", "bcc@x.com"]


def test_get_email_addresses_from_model_with_json_string() -> None:
    recipient = Mock()
    recipient.type = ReportRecipientType.EMAIL
    recipient.recipient_config_json = '{"target": "a@x.com;b@x.com"}'
    broken = Mock()
    broken.type = ReportRecipientType.EMAIL
    broken.recipient_config_json = "not json"
    assert get_email_addresses([recipient, broken]) == ["a@x.com", "b@x.com"]
    assert get_email_addresses(None) == []


def test_get_email_domain() -> None:
    assert get_email_domain("Bob@Example.COM") == "example.com"
    assert get_email_domain("not-an-email") is None


def test_find_disallowed_addresses_domain_allowlist() -> None:
    disallowed = find_disallowed_addresses(
        ["ok@example.com", "OK2@EXAMPLE.com", "nope@other.org", "nope@other.org"],
        allowed_domains=["Example.com"],
        known_emails=None,
    )
    assert disallowed == ["nope@other.org"]


def test_find_disallowed_addresses_users_only() -> None:
    disallowed = find_disallowed_addresses(
        ["user@example.com", "ghost@example.com"],
        allowed_domains=None,
        known_emails={"user@example.com"},
    )
    assert disallowed == ["ghost@example.com"]


def test_find_disallowed_addresses_no_policy() -> None:
    assert (
        find_disallowed_addresses(
            ["anyone@anywhere.io"], allowed_domains=[], known_emails=None
        )
        == []
    )


@pytest.mark.parametrize(
    ("cron", "minimum_interval", "expected"),
    [
        ("* * * * *", 0, True),
        ("* * * * *", 119, True),
        ("* * * * *", 300, False),
        ("*/5 * * * *", 300, True),
        ("*/5 * * * *", 600, False),
        ("0 * * * *", 3600, True),
        ("0 */2 * * *", 3600 * 3, False),
        ("0 0 * * *", 3600 * 24, True),
    ],
)
def test_cron_meets_minimum_interval(
    cron: str, minimum_interval: int, expected: bool
) -> None:
    assert cron_meets_minimum_interval(cron, minimum_interval) is expected


def test_get_dynamic_executor_disabled(mocker: MockerFixture) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=False)
    schedule = Mock(
        run_as=Mock(),
        run_alert_query_as=Mock(),
        run_as_type=None,
        run_alert_query_as_type=None,
    )
    assert get_dynamic_executor(schedule) is None
    assert get_dynamic_executor(schedule, alert_query=True) is None


def test_get_dynamic_executor_prefers_alert_query_user(
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.reports.utils.is_feature_enabled", return_value=True)
    run_as = Mock(name="run_as")
    query_as = Mock(name="query_as")
    schedule = Mock(
        run_as=run_as,
        run_alert_query_as=query_as,
        run_as_type=None,
        run_alert_query_as_type=None,
    )
    assert get_dynamic_executor(schedule) is run_as
    assert get_dynamic_executor(schedule, alert_query=True) is query_as

    schedule.run_alert_query_as = None
    assert get_dynamic_executor(schedule, alert_query=True) is run_as

    schedule.run_as = None
    assert get_dynamic_executor(schedule) is None


def test_wildcard_domains_match_only_subdomains() -> None:
    assert find_disallowed_addresses(
        [
            "a@EXAMPLE.com",
            "b@sub.example.com",
            "c@deep.sub.EXAMPLE.com",
            "d@badexample.com",
            "e@example.com.evil.org",
        ],
        allowed_domains=["*.Example.COM"],
        known_emails=None,
    ) == ["a@EXAMPLE.com", "d@badexample.com", "e@example.com.evil.org"]


@pytest.mark.parametrize(
    "pattern", ["preset.*", "PRESET.*", "*.preset.io", "preset.io"]
)
def test_valid_domain_wildcard_patterns(pattern: str) -> None:
    from superset.reports.utils import EMAIL_DOMAIN_REGEX

    assert EMAIL_DOMAIN_REGEX.fullmatch(pattern)


@pytest.mark.parametrize(
    "pattern", ["*", "*.preset.*", "pre*set.io", "preset.*.io", "preset..*"]
)
def test_invalid_domain_wildcard_patterns(pattern: str) -> None:
    from superset.reports.utils import EMAIL_DOMAIN_REGEX

    assert not EMAIL_DOMAIN_REGEX.fullmatch(pattern)


def test_trailing_wildcard_allows_only_one_tld_segment() -> None:
    rejected = [
        "a@preset.co.uk",
        "a@sub.preset.io",
        "a@notpreset.io",
        "a@preset.",
        "a@preset.io.evil",
        "a@preset.123",
    ]
    assert (
        find_disallowed_addresses(
            ["a@preset.io", "a@PRESET.AI", *rejected],
            allowed_domains=["PRESET.*"],
            known_emails=None,
        )
        == rejected
    )
