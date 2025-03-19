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
from __future__ import annotations

import pandas as pd


def rank(
    df: pd.DataFrame,
    metric: str,
    group_by: str | None = None,
) -> pd.DataFrame:
    """
    Calculates the rank of a metric within a group.

    :param df: N-dimensional DataFrame.
    :param metric: The metric to rank.
    :param group_by: The column to group by.
    :return: a flat DataFrame
    """
    if group_by:
        gb = df.groupby(group_by, group_keys=False)
        df["rank"] = gb.apply(lambda x: x[metric].rank(pct=True))
    else:
        df["rank"] = df[metric].rank(pct=True)
    return df
