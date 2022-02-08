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

from abc import ABC, abstractmethod
from typing import Dict, Optional, TYPE_CHECKING

from pandas import DataFrame
from sqlalchemy.inspection import inspect

from tests.common.logger_utils import log
from tests.example_data.data_loading.base_data_loader import DataLoader

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine

    from tests.example_data.data_loading.data_definitions.types import Table
    from tests.example_data.data_loading.pandas.pands_data_loading_conf import (
        PandasLoaderConfigurations,
    )


@log
class PandasDataLoader(DataLoader):
    _db_engine: Engine
    _configurations: PandasLoaderConfigurations
    _table_to_df_convertor: TableToDfConvertor

    def __init__(
        self,
        db_engine: Engine,
        config: PandasLoaderConfigurations,
        table_to_df_convertor: TableToDfConvertor,
    ) -> None:
        self._db_engine = db_engine
        self._configurations = config
        self._table_to_df_convertor = table_to_df_convertor

    def load_table(self, table: Table) -> None:
        df = self._table_to_df_convertor.convert(table)
        df.to_sql(
            table.table_name,
            self._db_engine,
            if_exists=self._configurations.if_exists,
            chunksize=self._configurations.chunksize,
            index=self._configurations.index,
            dtype=self._take_data_types(table),
            method=self._configurations.method,
            schema=self._detect_schema_name(),
        )

    def _detect_schema_name(self) -> Optional[str]:
        return inspect(self._db_engine).default_schema_name

    def _take_data_types(self, table: Table) -> Optional[Dict[str, str]]:
        metadata_table = table.table_metadata
        if metadata_table:
            types = metadata_table.types
            if types:
                return types
        return None

    def remove_table(self, table_name: str) -> None:
        self._db_engine.execute(f"DROP TABLE IF EXISTS {table_name}")


class TableToDfConvertor(ABC):
    @abstractmethod
    def convert(self, table: Table) -> DataFrame:
        ...
