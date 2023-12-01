from unittest import mock

import pytest
from flask_babel import lazy_gettext as _

from superset.commands.chart.exceptions import ChartDataQueryFailedError


@mock.patch("superset.tasks.async_queries.security_manager")
@mock.patch("superset.tasks.async_queries.async_query_manager")
@mock.patch("superset.tasks.async_queries.ChartDataQueryContextSchema")
def test_load_chart_data_into_cache_with_error(
    mock_query_context_schema_cls, mock_async_query_manager, mock_security_manager
):
    """Test that the task is gracefully marked failed in event of error"""
    from superset.tasks.async_queries import load_chart_data_into_cache

    job_metadata = {"user_id": 1}
    form_data = {}
    err_message = "Something went wrong"
    err = ChartDataQueryFailedError(_(err_message))

    mock_user = mock.MagicMock()
    mock_query_context_schema = mock.MagicMock()

    mock_security_manager.get_user_by_id.return_value = mock_user
    mock_async_query_manager.STATUS_ERROR = "error"
    mock_query_context_schema_cls.return_value = mock_query_context_schema

    mock_query_context_schema.load.side_effect = err

    with pytest.raises(ChartDataQueryFailedError):
        load_chart_data_into_cache(job_metadata, form_data)

    expected_errors = [{"message": err_message}]

    mock_async_query_manager.update_job.assert_called_once_with(
        job_metadata, "error", errors=expected_errors
    )
