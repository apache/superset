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

from typing import Optional, TYPE_CHECKING

from pandas import DataFrame
from pandas.core.dtypes.api import is_datetime64_any_dtype

from tests.common.logger_utils import log
from tests.example_data.data_loading.pandas.pandas_data_loader import TableToDfConvertor

if TYPE_CHECKING:
    from tests.example_data.data_loading.data_definitions.types import Table


@log
class TableToDfConvertorImpl(TableToDfConvertor):
    convert_datetime_to_str: bool
    _time_format: Optional[str]

    def __init__(
        self, convert_ds_to_datetime: bool, time_format: Optional[str] = None
    ) -> None:
        self.convert_datetime_to_str = convert_ds_to_datetime
        self._time_format = time_format

    def convert(self, table: Table) -> DataFrame:
        df_rv = DataFrame(table.data)
        if self._should_convert_datetime_to_str():
            self._convert_datetime_to_str(df_rv)
        return df_rv

    def _convert_datetime_to_str(self, df_rv: DataFrame):
        for col_name, col_type in df_rv.dtypes.items():
            if is_datetime64_any_dtype(col_type):
                df_col = df_rv[col_name]
                df_rv[col_name] = df_col.dt.strftime(self._time_format)

    def _should_convert_datetime_to_str(self) -> bool:
        return self.convert_datetime_to_str and self._time_format is not None
