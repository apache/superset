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
from flask_babel import gettext as _
from pandas import DataFrame

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("groupby")
def first_n_per_group(df: DataFrame, groupby: list[str], n: int) -> DataFrame:
    """
    Keep the first `n` rows of each group, in the order the rows came in.
    Rows with a NULL group key form their own group.

    :param df: DataFrame, already sorted by the query.
    :param groupby: Columns that define a group.
    :param n: Maximum number of rows to keep per group.
    :return: The kept rows, with all columns and in the original order.
    :raises InvalidPostProcessingError: If the options are incorrect
    """
    if not groupby:
        raise InvalidPostProcessingError(_("groupby must contain at least one column"))
    if isinstance(n, bool) or not isinstance(n, int) or n < 1:
        raise InvalidPostProcessingError(_("n must be a positive integer"))
    return df.groupby(groupby, sort=False, dropna=False).head(n)
