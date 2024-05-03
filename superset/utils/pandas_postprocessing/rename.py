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
from typing import Optional, Union

import pandas as pd
from flask_babel import gettext as _
from pandas._typing import Level

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import validate_column_args


@validate_column_args("columns")
def rename(
    df: pd.DataFrame,
    columns: dict[str, Union[str, None]],
    inplace: bool = False,
    level: Optional[Level] = None,
) -> pd.DataFrame:
    """
    Alter column name of DataFrame

    :param df: DataFrame to rename.
    :param columns: The offset string representing target conversion.
    :param inplace: Whether to return a new DataFrame.
    :param level: In case of a MultiIndex, only rename labels in the specified level.
    :return: DataFrame after rename
    :raises InvalidPostProcessingError: If the request is unexpected
    """
    if not columns:
        return df

    try:
        _rename_level = df.columns.get_level_values(level=level)
    except (IndexError, KeyError) as err:
        raise InvalidPostProcessingError from err

    if all(new_name in _rename_level for new_name in columns.values()):
        raise InvalidPostProcessingError(_("Label already exists"))

    if inplace:
        df.rename(columns=columns, inplace=inplace, level=level)
        return df
    return df.rename(columns=columns, inplace=inplace, level=level)
