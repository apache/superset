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
import io
from typing import Any

import pandas as pd

from superset.utils.core import GenericDataType


def df_to_excel(
    df: pd.DataFrame, coltypes: list[GenericDataType], **kwargs: Any
) -> Any:
    output = io.BytesIO()

    # timezones are not supported
    for column in df.select_dtypes(include=["datetimetz"]).columns:
        df[column] = df[column].astype(str)

    ndf = copy_df_with_datatype_conversion(df, coltypes)

    # pylint: disable=abstract-class-instantiated
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        ndf.to_excel(writer, **kwargs)

    return output.getvalue()


def copy_df_with_datatype_conversion(
    df: pd.DataFrame, coltypes: list[GenericDataType]
) -> pd.DataFrame:
    ndf = df.copy()
    try:
        columns = list(df)
        for i, col in enumerate(columns):
            if coltypes[i] == GenericDataType.NUMERIC:
                ndf[col] = pd.to_numeric(df[col], errors="ignore")
        return ndf
    except:
        return df
