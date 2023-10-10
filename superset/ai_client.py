import os
from typing import Optional

import requests


class AIClient:
    _SQL_URL_ENDPOINT = "/api/v1/sql"
    _DEFAULT_HEADERS = {"Content-Type": "application/json"}
    _DEFAULT_AI_SERVICE_URL = "https://ai.kuwago.onebyzero.ai"

    def __init__(self) -> None:
        self._base_url = os.environ.get(
            "SUPERSET_AI_SERVICE_URL", AIClient._DEFAULT_AI_SERVICE_URL
        )

    def sql(
        self, query: str, database_schema: str, database_type: Optional[str] = "sqlite3"
    ) -> str:
        """Execute a SQL query and return the results."""
        url = f"{self._base_url}{AIClient._SQL_URL_ENDPOINT}"
        data = {
            "query": query,
            "database_schema": database_schema,
            "database_type": database_type,
        }
        response = requests.post(
            url, json=data, headers=AIClient._DEFAULT_HEADERS)
        if response.status_code != 200:
            if response.headers["Content-Type"] == "application/json":
                raise Exception(response.json())
            else:
                raise Exception(response.text)
        generated_sql = response.json()
        return generated_sql.get("sql")
