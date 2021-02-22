import json


def bad_database_test_conn_request():
    return json.dumps(
        {"uri": "mssql+pymssql://url", "name": "examples", "impersonate_user": False,}
    )


def create_query_editor_request():
    return {
        "queryEditor": json.dumps(
            {
                "title": "Untitled Query 1",
                "dbId": 1,
                "schema": None,
                "autorun": False,
                "sql": "SELECT ...",
                "queryLimit": 1000,
            }
        )
    }
