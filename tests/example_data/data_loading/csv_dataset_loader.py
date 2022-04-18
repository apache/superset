#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

import os.path
from pathlib import Path
from typing import List, TYPE_CHECKING
from urllib.parse import urlparse

import pandas as pd

from superset import config, db
from superset.utils.database import get_example_database

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable


class CsvDatasetLoader:
    # A simple csvloader, should run in Superset AppContext
    csv_path: str
    df: pd.DataFrame
    table_name: str
    dataset: SqlaTable

    def __init__(
        self,
        csv_path: str,
        cache: bool = True,
        parse_dates: List[str] = [],
    ):
        # read from http
        if csv_path.startswith("http") and csv_path.endswith(".csv"):
            filename = urlparse(csv_path).path.split("/")[-1]
            filepath = os.path.join(config.DATA_DIR, filename)
            if os.path.exists(filepath) and cache:
                self.csv_path = filepath
                self.df = pd.read_csv(filepath, parse_dates=parse_dates)
                self.table_name = filename.replace(".csv", "")
            else:
                self.df = pd.read_csv(csv_path, parse_dates=parse_dates)
                if cache:
                    self.df.to_csv(filepath, index=False)
                self.csv_path = filepath
                self.table_name = filename.replace(".csv", "")

        # read from fs
        if os.path.exists(csv_path) and csv_path.endswith(".csv"):
            self.csv_path = csv_path
            self.df = pd.read_csv(csv_path, parse_dates=parse_dates)
            self.table_name = Path(csv_path).name.replace(".csv", "")

    def load_table(self) -> None:
        # load table to the default schema
        example_database = get_example_database()
        self.df.to_sql(
            name=self.table_name,
            con=example_database.get_sqla_engine(),
            index=False,
            if_exists="replace",
        )

    def remove_table(self) -> None:
        example_database = get_example_database()
        example_database.get_sqla_engine().execute(
            f"DROP TABLE IF EXISTS {self.table_name}"
        )

    def load_dataset(self) -> SqlaTable:
        from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
        from superset.connectors.sqla.utils import get_physical_table_metadata

        example_database = get_example_database()

        self.dataset = SqlaTable(
            table_name=self.table_name,
            database=example_database,
        )
        columns = get_physical_table_metadata(example_database, self.table_name)
        for col in columns:
            TableColumn(
                column_name=col["name"],
                type=col["type"],
                table=self.dataset,
                is_dttm=col["is_dttm"],
            )
        SqlMetric(metric_name="count", expression="count(*)", table=self.dataset)
        return self.dataset

    def remove_dataset(self) -> None:
        for m in self.dataset.metrics:
            db.session.delete(m)
        for col in self.dataset.columns:
            db.session.delete(col)
        db.session.delete(self.dataset)
        db.session.commit()
