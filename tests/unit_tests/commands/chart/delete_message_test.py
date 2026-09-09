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
from superset.commands.chart.delete import build_blocked_by_reports_message
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule


def _chart(chart_id: int, name: str) -> Slice:
    return Slice(id=chart_id, slice_name=name)


def _report(chart_id: int, name: str) -> ReportSchedule:
    return ReportSchedule(chart_id=chart_id, name=name)


def test_single_target_drops_chart_prefix_and_sorts_names() -> None:
    charts = [_chart(1, "Sales")]
    reports = [_report(1, "Weekly report"), _report(1, "Audit alert")]
    assert build_blocked_by_reports_message(charts, reports, single_target=True) == (
        "This chart is used by alerts or reports: Audit alert, Weekly report. "
        "Detach or delete them first."
    )


def test_multi_target_groups_by_chart_name_deterministically() -> None:
    # Charts and reports deliberately supplied out of order.
    charts = [_chart(2, "Zebra"), _chart(1, "Alpha")]
    reports = [
        _report(2, "Z report"),
        _report(1, "B alert"),
        _report(1, "A report"),
    ]
    assert build_blocked_by_reports_message(charts, reports, single_target=False) == (
        'Chart "Alpha" is used by alerts or reports: A report, B alert. '
        'Chart "Zebra" is used by alerts or reports: Z report. '
        "Detach or delete them first."
    )


def test_multi_target_with_one_blocked_chart_keeps_prefix() -> None:
    # A bulk command with several ids keeps the chart prefix even when only
    # one selected chart is blocked — the bulk toast is generic, so the
    # prefix is the only chart identification the user gets.
    charts = [_chart(1, "Costs"), _chart(2, "Unblocked")]
    reports = [_report(1, "Audit report")]
    assert build_blocked_by_reports_message(charts, reports, single_target=False) == (
        'Chart "Costs" is used by alerts or reports: Audit report. '
        "Detach or delete them first."
    )
