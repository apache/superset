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
from typing import Dict

from pandas import DataFrame

from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("columns")
def sort(df: DataFrame, columns: Dict[str, bool]) -> DataFrame:
    """
    Sort a DataFrame.

    :param df: DataFrame to sort.
    :param columns: columns by by which to sort. The key specifies the column name,
           value specifies if sorting in ascending order.
    :return: Sorted DataFrame
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    return df.sort_values(by=list(columns.keys()), ascending=list(columns.values()))
