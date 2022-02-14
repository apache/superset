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
from typing import Any, Dict, List

from pandas import DataFrame

from superset.utils.pandas_postprocessing.utils import (
    _get_aggregate_funcs,
    validate_column_args,
)


@validate_column_args("groupby")
def aggregate(
    df: DataFrame, groupby: List[str], aggregates: Dict[str, Dict[str, Any]]
) -> DataFrame:
    """
    Apply aggregations to a DataFrame.

    :param df: Object to aggregate.
    :param groupby: columns to aggregate
    :param aggregates: A mapping from metric column to the function used to
           aggregate values.
    :raises QueryObjectValidationError: If the request in incorrect
    """
    aggregates = aggregates or {}
    aggregate_funcs = _get_aggregate_funcs(df, aggregates)
    if groupby:
        df_groupby = df.groupby(by=groupby)
    else:
        df_groupby = df.groupby(lambda _: True)
    return df_groupby.agg(**aggregate_funcs).reset_index(drop=not groupby)
