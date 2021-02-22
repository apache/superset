import json


def bad_database_test_conn_request():
    return json.dumps(
        {"uri": "mssql+pymssql://url", "name": "examples", "impersonate_user": False,}
    )
