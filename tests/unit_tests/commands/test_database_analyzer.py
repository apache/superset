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
from unittest.mock import MagicMock, patch

import pytest

from superset.models.database_analyzer import (
    AnalysisStatus,
    DatabaseSchemaReport,
)
from superset.tasks.database_analyzer import (
    kickstart_analysis,
    check_analysis_status,
)


@patch("superset.tasks.database_analyzer.db")
@patch("superset.tasks.database_analyzer.analyze_database_schema")
def test_kickstart_analysis_new(mock_task, mock_db):
    """Test kickstarting a new analysis"""
    # Mock no existing report
    mock_db.session.query().filter_by().first.return_value = None
    
    # Mock the task
    mock_task.apply_async = MagicMock()
    
    result = kickstart_analysis(database_id=1, schema_name="public")
    
    assert "run_id" in result
    assert "database_report_id" in result
    assert result["status"] == "reserved"
    
    # Verify task was triggered
    mock_task.apply_async.assert_called_once()


@patch("superset.tasks.database_analyzer.db")
def test_kickstart_analysis_existing_running(mock_db):
    """Test kickstarting when analysis already running"""
    # Mock existing report in running state
    existing = MagicMock()
    existing.status = AnalysisStatus.RUNNING
    existing.celery_task_id = "existing-task-id"
    existing.id = 123
    mock_db.session.query().filter_by().first.return_value = existing
    
    result = kickstart_analysis(database_id=1, schema_name="public")
    
    assert result["run_id"] == "existing-task-id"
    assert result["database_report_id"] == 123
    assert result["status"] == "running"


@patch("superset.tasks.database_analyzer.db")
@patch("superset.tasks.database_analyzer.analyze_database_schema")
def test_kickstart_analysis_replace_completed(mock_task, mock_db):
    """Test kickstarting replaces completed analysis"""
    # Mock existing completed report
    existing = MagicMock()
    existing.status = AnalysisStatus.COMPLETED
    mock_db.session.query().filter_by().first.return_value = existing
    
    # Mock the task
    mock_task.apply_async = MagicMock()
    
    result = kickstart_analysis(database_id=1, schema_name="public")
    
    # Verify old report was deleted
    mock_db.session.delete.assert_called_once_with(existing)
    
    # Verify new analysis was started
    assert "run_id" in result
    assert result["status"] == "reserved"
    mock_task.apply_async.assert_called_once()


@patch("superset.tasks.database_analyzer.db")
def test_check_analysis_status_not_found(mock_db):
    """Test checking status for non-existent analysis"""
    mock_db.session.query().filter_by().first.return_value = None
    
    result = check_analysis_status("unknown-id")
    
    assert result["status"] == "not_found"
    assert "message" in result


@patch("superset.tasks.database_analyzer.db")
def test_check_analysis_status_running(mock_db):
    """Test checking status for running analysis"""
    report = MagicMock()
    report.id = 123
    report.status = AnalysisStatus.RUNNING
    report.database_id = 1
    report.schema_name = "public"
    report.start_dttm = MagicMock()
    report.start_dttm.isoformat.return_value = "2024-01-01T00:00:00"
    
    mock_db.session.query().filter_by().first.return_value = report
    
    result = check_analysis_status("test-run-id")
    
    assert result["status"] == "running"
    assert result["database_report_id"] == 123
    assert result["started_at"] == "2024-01-01T00:00:00"


@patch("superset.tasks.database_analyzer.db")
def test_check_analysis_status_completed(mock_db):
    """Test checking status for completed analysis"""
    report = MagicMock()
    report.id = 123
    report.status = AnalysisStatus.COMPLETED
    report.database_id = 1
    report.schema_name = "public"
    report.start_dttm = MagicMock()
    report.start_dttm.isoformat.return_value = "2024-01-01T00:00:00"
    report.end_dttm = MagicMock()
    report.end_dttm.isoformat.return_value = "2024-01-01T01:00:00"
    report.tables = [MagicMock(), MagicMock()]  # 2 tables
    report.joins = [MagicMock()]  # 1 join
    
    mock_db.session.query().filter_by().first.return_value = report
    
    result = check_analysis_status("test-run-id")
    
    assert result["status"] == "completed"
    assert result["database_report_id"] == 123
    assert result["completed_at"] == "2024-01-01T01:00:00"
    assert result["tables_count"] == 2
    assert result["joins_count"] == 1


@patch("superset.tasks.database_analyzer.db")
def test_check_analysis_status_failed(mock_db):
    """Test checking status for failed analysis"""
    report = MagicMock()
    report.id = 123
    report.status = AnalysisStatus.FAILED
    report.database_id = 1
    report.schema_name = "public"
    report.error_message = "Connection failed"
    report.end_dttm = MagicMock()
    report.end_dttm.isoformat.return_value = "2024-01-01T00:30:00"
    
    mock_db.session.query().filter_by().first.return_value = report
    
    result = check_analysis_status("test-run-id")
    
    assert result["status"] == "failed"
    assert result["error_message"] == "Connection failed"
    assert result["failed_at"] == "2024-01-01T00:30:00"