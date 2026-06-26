import pytest
from unittest.mock import Mock, patch
from superset.db_engine_specs.impala import ImpalaEngineSpec


@pytest.mark.parametrize("host, query_id", [
    # Exploit case: valid host with HTTP (not HTTPS) URL construction
    ("impala-host.internal", "abcd1234:efgh5678"),
    # Boundary case: host with port specification (should be ignored)
    ("impala-host.internal:25000", "abcd1234:efgh5678"),
    # Valid input: standard case
    ("coordinator.example.com", "abcd1234:efgh5678"),
])
def test_cancel_query_uses_https_not_http(host, query_id):
    """Invariant: Cancel query requests must use HTTPS, not plain HTTP."""
    # Mock the database connection
    mock_connection = Mock()
    mock_cursor = Mock()
    mock_connection.cursor.return_value = mock_cursor
    
    # Mock requests.post to capture the constructed URL
    with patch('superset.db_engine_specs.impala.requests.post') as mock_post:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        
        # Mock is_safe_host to return True (bypass host validation for this test)
        with patch('superset.db_engine_specs.impala.is_safe_host', return_value=True):
            try:
                ImpalaEngineSpec.cancel_query(mock_connection, query_id, host)
            except Exception:
                pass  # Ignore execution errors, we only care about URL construction
            
            # Verify requests.post was called
            assert mock_post.called
            
            # Extract the URL from the call
            call_args = mock_post.call_args
            constructed_url = call_args[0][0] if call_args[0] else call_args[1].get('url')
            
            # Security property: URL must start with https:// not http://
            assert constructed_url.startswith('https://'), \
                f"Cancel query URL must use HTTPS. Got: {constructed_url}"