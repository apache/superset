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

import pytest
from sqlalchemy.orm.session import Session

from superset.daos.report import ReportScheduleDAO
from superset.reports.models import ReportSchedule, ReportScheduleType
from superset.utils import json


@pytest.fixture(autouse=True)
def _create_tables(session: Session) -> None:
    ReportSchedule.metadata.create_all(session.get_bind())  # pylint: disable=no-member


def _create_report(
    session: Session,
    name: str,
    extra_json: str = "{}",
) -> ReportSchedule:
    report = ReportSchedule(
        name=name,
        type=ReportScheduleType.REPORT,
        crontab="0 9 * * *",
        extra_json=extra_json,
    )
    session.add(report)
    session.flush()
    return report


def test_find_by_extra_metadata_returns_matching_reports(
    session: Session,
) -> None:
    extra = json.dumps({"dashboard_tab_ids": ["TAB-abc123"]})
    _create_report(session, "match", extra_json=extra)
    _create_report(session, "no-match", extra_json="{}")

    results = ReportScheduleDAO.find_by_extra_metadata("TAB-abc123")

    assert len(results) == 1
    assert results[0].name == "match"


def test_find_by_extra_metadata_returns_empty_when_no_match(
    session: Session,
) -> None:
    _create_report(session, "report1", extra_json='{"key": "value"}')

    results = ReportScheduleDAO.find_by_extra_metadata("nonexistent")

    assert results == []


def test_find_by_extra_metadata_escapes_percent_wildcard(
    session: Session,
) -> None:
    _create_report(session, "with-percent", extra_json='{"slug": "100%done"}')
    _create_report(session, "other", extra_json='{"slug": "100xdone"}')

    results = ReportScheduleDAO.find_by_extra_metadata("100%done")

    assert len(results) == 1
    assert results[0].name == "with-percent"


def test_find_by_extra_metadata_escapes_underscore_wildcard(
    session: Session,
) -> None:
    _create_report(session, "with-underscore", extra_json='{"slug": "a_b"}')
    _create_report(session, "other", extra_json='{"slug": "axb"}')

    results = ReportScheduleDAO.find_by_extra_metadata("a_b")

    assert len(results) == 1
    assert results[0].name == "with-underscore"
