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
from typing import List, Optional, Union

from pandas import DataFrame

from superset.utils.pandas_postprocessing.utils import validate_column_args


# pylint: disable=invalid-name
@validate_column_args("by")
def sort(
    df: DataFrame,
    is_sort_index: bool = False,
    by: Optional[Union[List[str], str]] = None,
    ascending: Union[List[bool], bool] = True,
) -> DataFrame:
    """
    Sort a DataFrame.

    :param df: DataFrame to sort.
    :param is_sort_index: Whether by index or value to sort
    :param by: Name or list of names to sort by.
    :param ascending: Sort ascending or descending.
    :return: Sorted DataFrame
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not is_sort_index and not by:
        return df

    if is_sort_index:
        return df.sort_index(ascending=ascending)
    return df.sort_values(by=by, ascending=ascending)
