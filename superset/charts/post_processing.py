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
"""
Functions to reproduce the post-processing of data on text charts.

Some text-based charts (pivot tables and t-test table) perform
post-processing of the data in Javascript. When sending the data
to users in reports we want to show the same data they would see
on Explore.

In order to do that, we reproduce the post-processing in Python
for these chart types.
"""

from typing import Any, Callable, Dict, Optional, Union

import pandas as pd

from superset.utils.core import DTTM_ALIAS, extract_dataframe_dtypes, get_metric_name


def pivot_table(
    result: Dict[Any, Any], form_data: Optional[Dict[str, Any]] = None
) -> Dict[Any, Any]:
    """
    Pivot table.
    """
    for query in result["queries"]:
        data = query["data"]
        df = pd.DataFrame(data)
        form_data = form_data or {}

        if form_data.get("granularity") == "all" and DTTM_ALIAS in df:
            del df[DTTM_ALIAS]

        metrics = [get_metric_name(m) for m in form_data["metrics"]]
        aggfuncs: Dict[str, Union[str, Callable[[Any], Any]]] = {}
        for metric in metrics:
            aggfunc = form_data.get("pandas_aggfunc") or "sum"
            if pd.api.types.is_numeric_dtype(df[metric]):
                if aggfunc == "sum":
                    aggfunc = lambda x: x.sum(min_count=1)
            elif aggfunc not in {"min", "max"}:
                aggfunc = "max"
            aggfuncs[metric] = aggfunc

        groupby = form_data.get("groupby") or []
        columns = form_data.get("columns") or []
        if form_data.get("transpose_pivot"):
            groupby, columns = columns, groupby

        df = df.pivot_table(
            index=groupby,
            columns=columns,
            values=metrics,
            aggfunc=aggfuncs,
            margins=form_data.get("pivot_margins"),
        )

        # Re-order the columns adhering to the metric ordering.
        df = df[metrics]

        # Display metrics side by side with each column
        if form_data.get("combine_metric"):
            df = df.stack(0).unstack().reindex(level=-1, columns=metrics)

        # flatten column names
        df.columns = [" ".join(column) for column in df.columns]

        # re-arrange data into a list of dicts
        data = []
        for i in df.index:
            row = {col: df[col][i] for col in df.columns}
            row[df.index.name] = i
            data.append(row)
        query["data"] = data
        query["colnames"] = list(df.columns)
        query["coltypes"] = extract_dataframe_dtypes(df)
        query["rowcount"] = len(df.index)

    return result


post_processors = {
    "pivot_table": pivot_table,
}
