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
Helpers shared by the Alerts & Reports commands, DAO and execution engine.

Recipient and interval helpers are shared by save-time and execution-time
validation.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any, TYPE_CHECKING

from croniter import croniter

from superset import is_feature_enabled
from superset.commands.report.exceptions import ReportScheduleExecutorNotFoundError
from superset.reports.models import ReportRecipientType
from superset.tasks.types import ExecutorType
from superset.utils import json
from superset.utils.core import recipients_string_to_list

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

    from superset.reports.models import ReportSchedule

# Recipient fields inside ``recipient_config_json`` holding e-mail addresses.
EMAIL_RECIPIENT_FIELDS = ("target", "ccTarget", "bccTarget")

# Simple hostname validation for the allowed e-mail domains configuration.
EMAIL_DOMAIN_REGEX = re.compile(
    r"^(?!\*\..*\.\*$)(?:\*\.)?(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+"
    r"(?:[a-zA-Z]{2,63}|\*)$"
)


def get_dynamic_executor(
    report_schedule: ReportSchedule,
    *,
    alert_query: bool = False,
) -> User | None:
    """
    Return the user explicitly configured to execute ``report_schedule``.

    When ``alert_query`` is set, a typed query executor is preferred; an unset
    query type inherits the content selection. An unset content type returns
    ``None`` so callers use ``ALERT_REPORTS_EXECUTORS``. The type marker is
    authoritative even if a stale user relationship is present.

    The returned user may be inactive; callers decide how to surface that.
    """
    if not is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR"):
        return None
    field = "run_as"
    if alert_query and report_schedule.run_alert_query_as_type is not None:
        field = "run_alert_query_as"
    executor_type = getattr(report_schedule, f"{field}_type")
    if executor_type is None:
        return None
    if executor_type != ExecutorType.FIXED_USER:
        raise ReportScheduleExecutorNotFoundError(str(executor_type))
    user = getattr(report_schedule, field)
    if user is None:
        raise ReportScheduleExecutorNotFoundError("deleted user")
    return user


def get_email_addresses(recipients: Iterable[Any] | None) -> list[str]:
    """
    Extract every e-mail address (to, cc and bcc) from a list of recipients.

    Accepts both ``ReportRecipients`` model instances (JSON string config) and
    the dict payloads handled by the create/update commands (dict config).
    """
    addresses: list[str] = []
    for recipient in recipients or []:
        if isinstance(recipient, dict):
            recipient_type = recipient.get("type")
            config: Any = recipient.get("recipient_config_json") or {}
        else:
            recipient_type = getattr(recipient, "type", None)
            config = getattr(recipient, "recipient_config_json", None) or {}
        if recipient_type != ReportRecipientType.EMAIL:
            continue
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except json.JSONDecodeError:
                continue
        if not isinstance(config, dict):
            continue
        for field in EMAIL_RECIPIENT_FIELDS:
            addresses.extend(recipients_string_to_list(config.get(field)))
    return addresses


def get_email_domain(address: str) -> str | None:
    """Return the lower-cased domain of an e-mail address, if any."""
    if "@" not in address:
        return None
    return address.rsplit("@", 1)[1].lower()


def email_domain_matches(domain: str, pattern: str) -> bool:
    """Match exact domains, subdomain wildcards, or a single wildcard TLD."""
    domain, pattern = domain.lower(), pattern.lower()
    if pattern.startswith("*."):
        return domain.endswith(pattern[1:])
    if pattern.endswith(".*"):
        prefix, _, suffix = domain.rpartition(".")
        return (
            prefix == pattern[:-2] and re.fullmatch(r"[a-z]{2,63}", suffix) is not None
        )
    return domain == pattern


def find_disallowed_addresses(
    addresses: Iterable[str],
    *,
    allowed_domains: Iterable[str] | None,
    known_emails: set[str] | None,
) -> list[str]:
    """
    Return the addresses violating the recipient policy.

    :param allowed_domains: allow-list of domains; empty/None means any domain.
    :param known_emails: lower-cased e-mails of existing users when recipients
        are limited to users; ``None`` disables that check.
    """
    allowed = {domain.lower() for domain in allowed_domains or []}
    disallowed: list[str] = []
    for address in addresses:
        domain = get_email_domain(address)
        domain_blocked = bool(allowed) and (
            domain is None
            or not any(email_domain_matches(domain, pattern) for pattern in allowed)
        )
        user_blocked = known_emails is not None and address.lower() not in known_emails
        if (domain_blocked or user_blocked) and address not in disallowed:
            disallowed.append(address)
    return disallowed


def cron_meets_minimum_interval(cron_schedule: str, minimum_interval: int) -> bool:
    """
    Whether consecutive executions of ``cron_schedule`` are always at least
    ``minimum_interval`` seconds apart.

    Configuration is expressed in minutes, so intervals below two minutes never
    constrain a cron expression. Up to 60 iterations are inspected for hourly
    limits and 24 for larger ones.

    :raises CroniterBadDateError: when the expression never matches a real date.
    """
    if minimum_interval < 120:
        return True

    iterations = 60 if minimum_interval <= 3660 else 24
    schedule = croniter(cron_schedule)
    current_exec = next(schedule)
    for _ in range(iterations):
        next_exec = next(schedule)
        diff, current_exec = next_exec - current_exec, next_exec
        if int(diff) < minimum_interval:
            return False
    return True
