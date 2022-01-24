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
A simple client for running SQL queries against Superset:

    >>> from superset.client import SupersetClient
    >>> client = SupersetClient("http://localhost:8088/", "admin", "admin")
    >>> print(client.databases)
    [<Database "examples" (postgres)>]

    >>> examples = client.databases[0]
    >>> sql = "SELECT platform, rank FROM video_game_sales LIMIT 2"
    >>> print(examples.run_query(sql))
      platform  rank
    0      Wii     1
    1      NES     2

Data is returned in a Pandas Dataframe.

"""

from typing import List, Union

import pandas as pd
import requests
from bs4 import BeautifulSoup  # pylint: disable=E0401
from yarl import URL

from superset.utils.core import get_version, shortid


class Database:
    """
    A database configured in Superset.
    """

    def __init__(  # pylint: disable=too-many-arguments
        self,
        baseurl: Union[str, URL],
        database_id: int,
        name: str,
        backend: str,
        session: requests.Session,
        csrf_token: str,
    ):
        self.baseurl = URL(baseurl)
        self.database_id = database_id
        self.name = name
        self.backend = backend
        self.session = session
        self.csrf_token = csrf_token

    def run_query(self, sql: str, limit: int = 1000) -> pd.DataFrame:
        """
        Run a SQL query, returning a Pandas dataframe.
        """
        url = self.baseurl / "superset/sql_json/"
        data = {
            "client_id": shortid()[:10],
            "database_id": self.database_id,
            "json": True,
            "runAsync": False,
            "schema": None,
            "sql": sql,
            "sql_editor_id": "1",
            "tab": "Untitled Query 2",
            "tmp_table_name": "",
            "select_as_cta": False,
            "ctas_method": "TABLE",
            "queryLimit": limit,
            "expand_data": True,
        }
        headers = {
            "X-CSRFToken": self.csrf_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": f"Apache Superset Client ({get_version()})",
        }

        response = self.session.post(url, json=data, headers=headers)
        payload = response.json()
        return pd.DataFrame(payload["data"])

    def __repr__(self) -> str:
        return f'<Database "{self.name}" ({self.backend})>'


class SupersetClient:  # pylint: disable=too-few-public-methods

    """
    A client for running queries against Superset.
    """

    def __init__(self, baseurl: Union[str, URL], username: str, password: str):
        # convert to URL if necessary
        self.baseurl = URL(baseurl)
        self.username = username
        self.password = password

        self.session = requests.Session()
        self._do_login()

    def _do_login(self) -> None:
        """
        Log in to get a CSRF token and cookies for the ``/superset/sql_json`` endpoint.
        """
        response = self.session.get(self.baseurl / "login/")
        soup = BeautifulSoup(response.text, "html.parser")
        self.csrf_token = soup.find("input", {"id": "csrf_token"})["value"]

        # set cookies
        self.session.post(
            self.baseurl / "login/",
            data=dict(username="admin", password="admin", csrf_token=self.csrf_token),
        )

    @property
    def databases(self) -> List[Database]:
        """
        Return the configured databases.
        """
        response = self.session.get(self.baseurl / "api/v1/database")
        payload = response.json()
        databases = payload["result"]
        return [
            Database(
                self.baseurl,
                database["id"],
                database["database_name"],
                database["backend"],
                self.session,
                self.csrf_token,
            )
            for database in databases
        ]
