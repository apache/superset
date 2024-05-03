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


import pandas as pd
import pytest
from flask_babel import lazy_gettext as _
from sqlalchemy.orm.session import Session

from superset.charts.post_processing import apply_post_process, pivot_df, table
from superset.common.chart_data import ChartDataResultFormat
from superset.utils.core import GenericDataType


def test_pivot_df_no_cols_no_rows_single_metric():
    """
    Pivot table when no cols/rows and 1 metric are selected.
    """
    # when no cols/rows are selected there are no groupbys in the query,
    # and the data has only the metric(s)
    df = pd.DataFrame.from_dict({"SUM(num)": {0: 80679663}})
    assert (
        df.to_markdown()
        == """
|    |    SUM(num) |
|---:|------------:|
|  0 | 8.06797e+07 |
    """.strip()
    )

    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)',) |
|:-----------------|----------------:|
| ('{_("Total")} (Sum)',) |     8.06797e+07 |
    """.strip()
    )

    # transpose_pivot and combine_metrics do nothing in this case
    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)',) |
|:-----------------|----------------:|
| ('{_("Total")} (Sum)',) |     8.06797e+07 |
    """.strip()
    )

    # apply_metrics_on_rows will pivot the table, moving the metrics
    # to rows
    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|               |   ('{_("Total")} (Sum)',) |
|:--------------|-------------------:|
| ('SUM(num)',) |        8.06797e+07 |
    """.strip()
    )

    # showing totals
    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)',) |   ('Total (Sum)',) |
|:-----------------|----------------:|-------------------:|
| ('{_("Total")} (Sum)',) |     8.06797e+07 |        8.06797e+07 |
    """.strip()
    )


def test_pivot_df_no_cols_no_rows_two_metrics():
    """
    Pivot table when no cols/rows and 2 metrics are selected.
    """
    # when no cols/rows are selected there are no groupbys in the query,
    # and the data has only the metrics
    df = pd.DataFrame.from_dict({"SUM(num)": {0: 80679663}, "MAX(num)": {0: 37296}})
    assert (
        df.to_markdown()
        == """
|    |    SUM(num) |   MAX(num) |
|---:|------------:|-----------:|
|  0 | 8.06797e+07 |      37296 |
    """.strip()
    )

    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)',) |   ('MAX(num)',) |
|:-----------------|----------------:|----------------:|
| ('{_("Total")} (Sum)',) |     8.06797e+07 |           37296 |
    """.strip()
    )

    # transpose_pivot and combine_metrics do nothing in this case
    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                  |   ('SUM(num)',) |   ('MAX(num)',) |
|:-----------------|----------------:|----------------:|
| ('Total (Sum)',) |     8.06797e+07 |           37296 |
    """.strip()
    )

    # apply_metrics_on_rows will pivot the table, moving the metrics
    # to rows
    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|               |   ('{_("Total")} (Sum)',) |
|:--------------|-------------------:|
| ('SUM(num)',) |        8.06797e+07 |
| ('MAX(num)',) |    37296           |
    """.strip()
    )

    # when showing totals we only add a column, since adding a row
    # would be redundant
    pivoted = pivot_df(
        df,
        rows=[],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)',) |   ('MAX(num)',) |   ('{_("Total")} (Sum)',) |
|:-----------------|----------------:|----------------:|-------------------:|
| ('{_("Total")} (Sum)',) |     8.06797e+07 |           37296 |         8.0717e+07 |
    """.strip()
    )


def test_pivot_df_single_row_two_metrics():
    """
    Pivot table when a single column and 2 metrics are selected.
    """
    df = pd.DataFrame.from_dict(
        {
            "gender": {0: "girl", 1: "boy"},
            "SUM(num)": {0: 118065, 1: 47123},
            "MAX(num)": {0: 2588, 1: 1280},
        }
    )
    assert (
        df.to_markdown()
        == """
|    | gender   |   SUM(num) |   MAX(num) |
|---:|:---------|-----------:|-----------:|
|  0 | girl     |     118065 |       2588 |
|  1 | boy      |      47123 |       1280 |
    """.strip()
    )

    pivoted = pivot_df(
        df,
        rows=["gender"],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|           |   ('SUM(num)',) |   ('MAX(num)',) |
|:----------|----------------:|----------------:|
| ('boy',)  |           47123 |            1280 |
| ('girl',) |          118065 |            2588 |
    """.strip()
    )

    # transpose_pivot
    pivoted = pivot_df(
        df,
        rows=["gender"],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)', 'boy') |   ('SUM(num)', 'girl') |   ('MAX(num)', 'boy') |   ('MAX(num)', 'girl') |
|:-----------------|----------------------:|-----------------------:|----------------------:|-----------------------:|
| ('{_("Total")} (Sum)',) |                 47123 |                 118065 |                  1280 |                   2588 |
    """.strip()
    )

    # combine_metrics does nothing in this case
    pivoted = pivot_df(
        df,
        rows=["gender"],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|           |   ('SUM(num)',) |   ('MAX(num)',) |
|:----------|----------------:|----------------:|
| ('boy',)  |           47123 |            1280 |
| ('girl',) |          118065 |            2588 |
    """.strip()
    )

    # show totals
    pivoted = pivot_df(
        df,
        rows=["gender"],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                  |   ('SUM(num)',) |   ('MAX(num)',) |   ('{_("Total")} (Sum)',) |
|:-----------------|----------------:|----------------:|-------------------:|
| ('boy',)         |           47123 |            1280 |              48403 |
| ('girl',)        |          118065 |            2588 |             120653 |
| ('{_("Total")} (Sum)',) |          165188 |            3868 |             169056 |
    """.strip()
    )

    # apply_metrics_on_rows
    pivoted = pivot_df(
        df,
        rows=["gender"],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                          |   ('{_("Total")} (Sum)',) |
|:-------------------------|-------------------:|
| ('SUM(num)', 'boy')      |              47123 |
| ('SUM(num)', 'girl')     |             118065 |
| ('SUM(num)', 'Subtotal') |             165188 |
| ('MAX(num)', 'boy')      |               1280 |
| ('MAX(num)', 'girl')     |               2588 |
| ('MAX(num)', 'Subtotal') |               3868 |
| ('{_("Total")} (Sum)', '')      |             169056 |
    """.strip()
    )

    # apply_metrics_on_rows with combine_metrics
    pivoted = pivot_df(
        df,
        rows=["gender"],
        columns=[],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == f"""
|                      |   ('{_("Total")} (Sum)',) |
|:---------------------|-------------------:|
| ('boy', 'SUM(num)')  |              47123 |
| ('boy', 'MAX(num)')  |               1280 |
| ('boy', 'Subtotal')  |              48403 |
| ('girl', 'SUM(num)') |             118065 |
| ('girl', 'MAX(num)') |               2588 |
| ('girl', 'Subtotal') |             120653 |
| ('{_("Total")} (Sum)', '')  |             169056 |
    """.strip()
    )


def test_pivot_df_complex():
    """
    Pivot table when a column, rows and 2 metrics are selected.
    """
    df = pd.DataFrame.from_dict(
        {
            "state": {
                0: "CA",
                1: "CA",
                2: "CA",
                3: "FL",
                4: "CA",
                5: "CA",
                6: "FL",
                7: "FL",
                8: "FL",
                9: "CA",
                10: "FL",
                11: "FL",
            },
            "gender": {
                0: "girl",
                1: "boy",
                2: "girl",
                3: "girl",
                4: "girl",
                5: "girl",
                6: "boy",
                7: "girl",
                8: "girl",
                9: "boy",
                10: "boy",
                11: "girl",
            },
            "name": {
                0: "Amy",
                1: "Edward",
                2: "Sophia",
                3: "Amy",
                4: "Cindy",
                5: "Dawn",
                6: "Edward",
                7: "Sophia",
                8: "Dawn",
                9: "Tony",
                10: "Tony",
                11: "Cindy",
            },
            "SUM(num)": {
                0: 45426,
                1: 31290,
                2: 18859,
                3: 14740,
                4: 14149,
                5: 11403,
                6: 9395,
                7: 7181,
                8: 5089,
                9: 3765,
                10: 2673,
                11: 1218,
            },
            "MAX(num)": {
                0: 2227,
                1: 1280,
                2: 2588,
                3: 854,
                4: 842,
                5: 1157,
                6: 389,
                7: 1187,
                8: 461,
                9: 598,
                10: 247,
                11: 217,
            },
        }
    )
    assert (
        df.to_markdown()
        == """
|    | state   | gender   | name   |   SUM(num) |   MAX(num) |
|---:|:--------|:---------|:-------|-----------:|-----------:|
|  0 | CA      | girl     | Amy    |      45426 |       2227 |
|  1 | CA      | boy      | Edward |      31290 |       1280 |
|  2 | CA      | girl     | Sophia |      18859 |       2588 |
|  3 | FL      | girl     | Amy    |      14740 |        854 |
|  4 | CA      | girl     | Cindy  |      14149 |        842 |
|  5 | CA      | girl     | Dawn   |      11403 |       1157 |
|  6 | FL      | boy      | Edward |       9395 |        389 |
|  7 | FL      | girl     | Sophia |       7181 |       1187 |
|  8 | FL      | girl     | Dawn   |       5089 |        461 |
|  9 | CA      | boy      | Tony   |       3765 |        598 |
| 10 | FL      | boy      | Tony   |       2673 |        247 |
| 11 | FL      | girl     | Cindy  |       1218 |        217 |
    """.strip()
    )

    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                    |   ('SUM(num)', 'CA') |   ('SUM(num)', 'FL') |   ('MAX(num)', 'CA') |   ('MAX(num)', 'FL') |
|:-------------------|---------------------:|---------------------:|---------------------:|---------------------:|
| ('boy', 'Edward')  |                31290 |                 9395 |                 1280 |                  389 |
| ('boy', 'Tony')    |                 3765 |                 2673 |                  598 |                  247 |
| ('girl', 'Amy')    |                45426 |                14740 |                 2227 |                  854 |
| ('girl', 'Cindy')  |                14149 |                 1218 |                  842 |                  217 |
| ('girl', 'Dawn')   |                11403 |                 5089 |                 1157 |                  461 |
| ('girl', 'Sophia') |                18859 |                 7181 |                 2588 |                 1187 |
    """.strip()
    )

    # transpose_pivot
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|         |   ('SUM(num)', 'boy', 'Edward') |   ('SUM(num)', 'boy', 'Tony') |   ('SUM(num)', 'girl', 'Amy') |   ('SUM(num)', 'girl', 'Cindy') |   ('SUM(num)', 'girl', 'Dawn') |   ('SUM(num)', 'girl', 'Sophia') |   ('MAX(num)', 'boy', 'Edward') |   ('MAX(num)', 'boy', 'Tony') |   ('MAX(num)', 'girl', 'Amy') |   ('MAX(num)', 'girl', 'Cindy') |   ('MAX(num)', 'girl', 'Dawn') |   ('MAX(num)', 'girl', 'Sophia') |
|:--------|--------------------------------:|------------------------------:|------------------------------:|--------------------------------:|-------------------------------:|---------------------------------:|--------------------------------:|------------------------------:|------------------------------:|--------------------------------:|-------------------------------:|---------------------------------:|
| ('CA',) |                           31290 |                          3765 |                         45426 |                           14149 |                          11403 |                            18859 |                            1280 |                           598 |                          2227 |                             842 |                           1157 |                             2588 |
| ('FL',) |                            9395 |                          2673 |                         14740 |                            1218 |                           5089 |                             7181 |                             389 |                           247 |                           854 |                             217 |                            461 |                             1187 |
    """.strip()
    )

    # combine_metrics
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                    |   ('CA', 'SUM(num)') |   ('CA', 'MAX(num)') |   ('FL', 'SUM(num)') |   ('FL', 'MAX(num)') |
|:-------------------|---------------------:|---------------------:|---------------------:|---------------------:|
| ('boy', 'Edward')  |                31290 |                 1280 |                 9395 |                  389 |
| ('boy', 'Tony')    |                 3765 |                  598 |                 2673 |                  247 |
| ('girl', 'Amy')    |                45426 |                 2227 |                14740 |                  854 |
| ('girl', 'Cindy')  |                14149 |                  842 |                 1218 |                  217 |
| ('girl', 'Dawn')   |                11403 |                 1157 |                 5089 |                  461 |
| ('girl', 'Sophia') |                18859 |                 2588 |                 7181 |                 1187 |
    """.strip()
    )

    # show totals
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                      |   ('SUM(num)', 'CA') |   ('SUM(num)', 'FL') |   ('SUM(num)', 'Subtotal') |   ('MAX(num)', 'CA') |   ('MAX(num)', 'FL') |   ('MAX(num)', 'Subtotal') |   ('Total (Sum)', '') |
|:---------------------|---------------------:|---------------------:|---------------------------:|---------------------:|---------------------:|---------------------------:|----------------------:|
| ('boy', 'Edward')    |                31290 |                 9395 |                      40685 |                 1280 |                  389 |                       1669 |                 42354 |
| ('boy', 'Tony')      |                 3765 |                 2673 |                       6438 |                  598 |                  247 |                        845 |                  7283 |
| ('boy', 'Subtotal')  |                35055 |                12068 |                      47123 |                 1878 |                  636 |                       2514 |                 49637 |
| ('girl', 'Amy')      |                45426 |                14740 |                      60166 |                 2227 |                  854 |                       3081 |                 63247 |
| ('girl', 'Cindy')    |                14149 |                 1218 |                      15367 |                  842 |                  217 |                       1059 |                 16426 |
| ('girl', 'Dawn')     |                11403 |                 5089 |                      16492 |                 1157 |                  461 |                       1618 |                 18110 |
| ('girl', 'Sophia')   |                18859 |                 7181 |                      26040 |                 2588 |                 1187 |                       3775 |                 29815 |
| ('girl', 'Subtotal') |                89837 |                28228 |                     118065 |                 6814 |                 2719 |                       9533 |                127598 |
| ('Total (Sum)', '')  |               124892 |                40296 |                     165188 |                 8692 |                 3355 |                      12047 |                177235 |
    """.strip()
    )

    # apply_metrics_on_rows
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                |   ('CA',) |   ('FL',) |
|:-------------------------------|----------:|----------:|
| ('SUM(num)', 'boy', 'Edward')  |     31290 |      9395 |
| ('SUM(num)', 'boy', 'Tony')    |      3765 |      2673 |
| ('SUM(num)', 'girl', 'Amy')    |     45426 |     14740 |
| ('SUM(num)', 'girl', 'Cindy')  |     14149 |      1218 |
| ('SUM(num)', 'girl', 'Dawn')   |     11403 |      5089 |
| ('SUM(num)', 'girl', 'Sophia') |     18859 |      7181 |
| ('MAX(num)', 'boy', 'Edward')  |      1280 |       389 |
| ('MAX(num)', 'boy', 'Tony')    |       598 |       247 |
| ('MAX(num)', 'girl', 'Amy')    |      2227 |       854 |
| ('MAX(num)', 'girl', 'Cindy')  |       842 |       217 |
| ('MAX(num)', 'girl', 'Dawn')   |      1157 |       461 |
| ('MAX(num)', 'girl', 'Sophia') |      2588 |      1187 |
    """.strip()
    )

    # apply_metrics_on_rows with combine_metrics
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                |   ('CA',) |   ('FL',) |
|:-------------------------------|----------:|----------:|
| ('boy', 'Edward', 'SUM(num)')  |     31290 |      9395 |
| ('boy', 'Edward', 'MAX(num)')  |      1280 |       389 |
| ('boy', 'Tony', 'SUM(num)')    |      3765 |      2673 |
| ('boy', 'Tony', 'MAX(num)')    |       598 |       247 |
| ('girl', 'Amy', 'SUM(num)')    |     45426 |     14740 |
| ('girl', 'Amy', 'MAX(num)')    |      2227 |       854 |
| ('girl', 'Cindy', 'SUM(num)')  |     14149 |      1218 |
| ('girl', 'Cindy', 'MAX(num)')  |       842 |       217 |
| ('girl', 'Dawn', 'SUM(num)')   |     11403 |      5089 |
| ('girl', 'Dawn', 'MAX(num)')   |      1157 |       461 |
| ('girl', 'Sophia', 'SUM(num)') |     18859 |      7181 |
| ('girl', 'Sophia', 'MAX(num)') |      2588 |      1187 |
    """.strip()
    )

    # everything
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                     |   ('boy', 'Edward') |   ('boy', 'Tony') |   ('boy', 'Subtotal') |   ('girl', 'Amy') |   ('girl', 'Cindy') |   ('girl', 'Dawn') |   ('girl', 'Sophia') |   ('girl', 'Subtotal') |   ('Total (Sum)', '') |
|:--------------------|--------------------:|------------------:|----------------------:|------------------:|--------------------:|-------------------:|---------------------:|-----------------------:|----------------------:|
| ('CA', 'SUM(num)')  |               31290 |              3765 |                 35055 |             45426 |               14149 |              11403 |                18859 |                  89837 |                124892 |
| ('CA', 'MAX(num)')  |                1280 |               598 |                  1878 |              2227 |                 842 |               1157 |                 2588 |                   6814 |                  8692 |
| ('CA', 'Subtotal')  |               32570 |              4363 |                 36933 |             47653 |               14991 |              12560 |                21447 |                  96651 |                133584 |
| ('FL', 'SUM(num)')  |                9395 |              2673 |                 12068 |             14740 |                1218 |               5089 |                 7181 |                  28228 |                 40296 |
| ('FL', 'MAX(num)')  |                 389 |               247 |                   636 |               854 |                 217 |                461 |                 1187 |                   2719 |                  3355 |
| ('FL', 'Subtotal')  |                9784 |              2920 |                 12704 |             15594 |                1435 |               5550 |                 8368 |                  30947 |                 43651 |
| ('Total (Sum)', '') |               42354 |              7283 |                 49637 |             63247 |               16426 |              18110 |                29815 |                 127598 |                177235 |
    """.strip()
    )

    # fraction
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum as Fraction of Columns",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                            |   ('SUM(num)', 'CA') |   ('SUM(num)', 'FL') |   ('MAX(num)', 'CA') |   ('MAX(num)', 'FL') |
|:-------------------------------------------|---------------------:|---------------------:|---------------------:|---------------------:|
| ('boy', 'Edward')                          |            0.250536  |            0.23315   |            0.147262  |            0.115946  |
| ('boy', 'Tony')                            |            0.030146  |            0.0663341 |            0.0687989 |            0.0736215 |
| ('boy', 'Subtotal')                        |            0.280683  |            0.299484  |            0.216061  |            0.189568  |
| ('girl', 'Amy')                            |            0.363722  |            0.365793  |            0.256213  |            0.254545  |
| ('girl', 'Cindy')                          |            0.11329   |            0.0302263 |            0.0968707 |            0.0646796 |
| ('girl', 'Dawn')                           |            0.0913029 |            0.12629   |            0.133111  |            0.137407  |
| ('girl', 'Sophia')                         |            0.151002  |            0.178206  |            0.297745  |            0.3538    |
| ('girl', 'Subtotal')                       |            0.719317  |            0.700516  |            0.783939  |            0.810432  |
| ('Total (Sum as Fraction of Columns)', '') |            1         |            1         |            1         |            1         |
    """.strip()
    )


def test_pivot_df_multi_column():
    """
    Pivot table when 2 columns, no rows and 2 metrics are selected.
    """
    df = pd.DataFrame.from_dict(
        {
            "state": {
                0: "CA",
                1: "CA",
                2: "CA",
                3: "FL",
                4: "CA",
                5: "CA",
                6: "FL",
                7: "FL",
                8: "FL",
                9: "CA",
                10: "FL",
                11: "FL",
            },
            "gender": {
                0: "girl",
                1: "boy",
                2: "girl",
                3: "girl",
                4: "girl",
                5: "girl",
                6: "boy",
                7: "girl",
                8: "girl",
                9: "boy",
                10: "boy",
                11: "girl",
            },
            "SUM(num)": {
                0: 45426,
                1: 31290,
                2: 18859,
                3: 14740,
                4: 14149,
                5: 11403,
                6: 9395,
                7: 7181,
                8: 5089,
                9: 3765,
                10: 2673,
                11: 1218,
            },
            "MAX(num)": {
                0: 2227,
                1: 1280,
                2: 2588,
                3: 854,
                4: 842,
                5: 1157,
                6: 389,
                7: 1187,
                8: 461,
                9: 598,
                10: 247,
                11: 217,
            },
        }
    )

    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                  |   ('SUM(num)', 'boy') |   ('SUM(num)', 'girl') |   ('MAX(num)', 'boy') |   ('MAX(num)', 'girl') |
|:-----------------|----------------------:|-----------------------:|----------------------:|-----------------------:|
| ('CA',)          |                 35055 |                  89837 |                  1878 |                   6814 |
| ('Total (Sum)',) |                 12068 |                  28228 |                   636 |                   2719 |
    """.strip()
    )

    # transpose_pivot
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                |   ('SUM(num)',) |   ('MAX(num)',) |
|:---------------|----------------:|----------------:|
| ('CA', 'boy')  |           35055 |            1878 |
| ('CA', 'girl') |           89837 |            6814 |
| ('FL', 'boy')  |           12068 |             636 |
| ('FL', 'girl') |           28228 |            2719 |
    """.strip()
    )

    # combine_metrics
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                  |   ('boy', 'SUM(num)') |   ('boy', 'MAX(num)') |   ('girl', 'SUM(num)') |   ('girl', 'MAX(num)') |
|:-----------------|----------------------:|----------------------:|-----------------------:|-----------------------:|
| ('CA',)          |                 35055 |                  1878 |                  89837 |                   6814 |
| ('Total (Sum)',) |                 12068 |                   636 |                  28228 |                   2719 |
    """.strip()
    )

    # show totals
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                  |   ('SUM(num)', 'boy') |   ('SUM(num)', 'girl') |   ('SUM(num)', 'Subtotal') |   ('MAX(num)', 'boy') |   ('MAX(num)', 'girl') |   ('MAX(num)', 'Subtotal') |   ('Total (Sum)', '') |
|:-----------------|----------------------:|-----------------------:|---------------------------:|----------------------:|-----------------------:|---------------------------:|----------------------:|
| ('CA',)          |                 35055 |                  89837 |                     124892 |                  1878 |                   6814 |                       8692 |                133584 |
| ('Total (Sum)',) |                 12068 |                  28228 |                      40296 |                   636 |                   2719 |                       3355 |                 43651 |

    """.strip()
    )

    # apply_metrics_on_rows
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|               |   ('CA', 'boy') |   ('CA', 'girl') |   ('FL', 'boy') |   ('FL', 'girl') |
|:--------------|----------------:|-----------------:|----------------:|-----------------:|
| ('SUM(num)',) |           35055 |            89837 |           12068 |            28228 |
| ('MAX(num)',) |            1878 |             6814 |             636 |             2719 |
    """.strip()
    )

    # apply_metrics_on_rows with combine_metrics
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|               |   ('CA', 'boy') |   ('CA', 'girl') |   ('FL', 'boy') |   ('FL', 'girl') |
|:--------------|----------------:|-----------------:|----------------:|-----------------:|
| ('SUM(num)',) |           35055 |            89837 |           12068 |            28228 |
| ('MAX(num)',) |            1878 |             6814 |             636 |             2719 |
    """.strip()
    )

    # everything
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                      |   ('CA',) |   ('Total (Sum)',) |
|:---------------------|----------:|-------------------:|
| ('boy', 'SUM(num)')  |     35055 |              12068 |
| ('boy', 'MAX(num)')  |      1878 |                636 |
| ('boy', 'Subtotal')  |     36933 |              12704 |
| ('girl', 'SUM(num)') |     89837 |              28228 |
| ('girl', 'MAX(num)') |      6814 |               2719 |
| ('girl', 'Subtotal') |     96651 |              30947 |
| ('Total (Sum)', '')  |    133584 |              43651 |
    """.strip()
    )

    # fraction
    pivoted = pivot_df(
        df,
        rows=None,
        columns=["state", "gender"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum as Fraction of Columns",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                         |   ('SUM(num)', 'boy') |   ('SUM(num)', 'girl') |   ('MAX(num)', 'boy') |   ('MAX(num)', 'girl') |
|:----------------------------------------|----------------------:|-----------------------:|----------------------:|-----------------------:|
| ('CA',)                                 |              0.743904 |               0.760911 |              0.747017 |                0.71478 |
| ('Total (Sum as Fraction of Columns)',) |              0.256096 |               0.239089 |              0.252983 |                0.28522 |
    """.strip()
    )


def test_pivot_df_complex_null_values():
    """
    Pivot table when a column, rows and 2 metrics are selected.
    """
    df = pd.DataFrame.from_dict(
        {
            "state": {
                0: None,
                1: None,
                2: None,
                3: None,
                4: None,
                5: None,
                6: None,
                7: None,
                8: None,
                9: None,
                10: None,
                11: None,
            },
            "gender": {
                0: "girl",
                1: "boy",
                2: "girl",
                3: "girl",
                4: "girl",
                5: "girl",
                6: "boy",
                7: "girl",
                8: "girl",
                9: "boy",
                10: "boy",
                11: "girl",
            },
            "name": {
                0: "Amy",
                1: "Edward",
                2: "Sophia",
                3: "Amy",
                4: "Cindy",
                5: "Dawn",
                6: "Edward",
                7: "Sophia",
                8: "Dawn",
                9: "Tony",
                10: "Tony",
                11: "Cindy",
            },
            "SUM(num)": {
                0: 45426,
                1: 31290,
                2: 18859,
                3: 14740,
                4: 14149,
                5: 11403,
                6: 9395,
                7: 7181,
                8: 5089,
                9: 3765,
                10: 2673,
                11: 1218,
            },
            "MAX(num)": {
                0: 2227,
                1: 1280,
                2: 2588,
                3: 854,
                4: 842,
                5: 1157,
                6: 389,
                7: 1187,
                8: 461,
                9: 598,
                10: 247,
                11: 217,
            },
        }
    )
    assert (
        df.to_markdown()
        == """
|    | state   | gender   | name   |   SUM(num) |   MAX(num) |
|---:|:--------|:---------|:-------|-----------:|-----------:|
|  0 |         | girl     | Amy    |      45426 |       2227 |
|  1 |         | boy      | Edward |      31290 |       1280 |
|  2 |         | girl     | Sophia |      18859 |       2588 |
|  3 |         | girl     | Amy    |      14740 |        854 |
|  4 |         | girl     | Cindy  |      14149 |        842 |
|  5 |         | girl     | Dawn   |      11403 |       1157 |
|  6 |         | boy      | Edward |       9395 |        389 |
|  7 |         | girl     | Sophia |       7181 |       1187 |
|  8 |         | girl     | Dawn   |       5089 |        461 |
|  9 |         | boy      | Tony   |       3765 |        598 |
| 10 |         | boy      | Tony   |       2673 |        247 |
| 11 |         | girl     | Cindy  |       1218 |        217 |
    """.strip()
    )

    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                    |   ('SUM(num)', 'NULL') |   ('MAX(num)', 'NULL') |
|:-------------------|-----------------------:|-----------------------:|
| ('boy', 'Edward')  |                  40685 |                   1669 |
| ('boy', 'Tony')    |                   6438 |                    845 |
| ('girl', 'Amy')    |                  60166 |                   3081 |
| ('girl', 'Cindy')  |                  15367 |                   1059 |
| ('girl', 'Dawn')   |                  16492 |                   1618 |
| ('girl', 'Sophia') |                  26040 |                   3775 |

    """.strip()
    )

    # transpose_pivot
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|           |   ('SUM(num)', 'boy', 'Edward') |   ('SUM(num)', 'boy', 'Tony') |   ('SUM(num)', 'girl', 'Amy') |   ('SUM(num)', 'girl', 'Cindy') |   ('SUM(num)', 'girl', 'Dawn') |   ('SUM(num)', 'girl', 'Sophia') |   ('MAX(num)', 'boy', 'Edward') |   ('MAX(num)', 'boy', 'Tony') |   ('MAX(num)', 'girl', 'Amy') |   ('MAX(num)', 'girl', 'Cindy') |   ('MAX(num)', 'girl', 'Dawn') |   ('MAX(num)', 'girl', 'Sophia') |
|:----------|--------------------------------:|------------------------------:|------------------------------:|--------------------------------:|-------------------------------:|---------------------------------:|--------------------------------:|------------------------------:|------------------------------:|--------------------------------:|-------------------------------:|---------------------------------:|
| ('NULL',) |                           40685 |                          6438 |                         60166 |                           15367 |                          16492 |                            26040 |                            1669 |                           845 |                          3081 |                            1059 |                           1618 |                             3775 |
    """.strip()
    )

    # combine_metrics
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                    |   ('NULL', 'SUM(num)') |   ('NULL', 'MAX(num)') |
|:-------------------|-----------------------:|-----------------------:|
| ('boy', 'Edward')  |                  40685 |                   1669 |
| ('boy', 'Tony')    |                   6438 |                    845 |
| ('girl', 'Amy')    |                  60166 |                   3081 |
| ('girl', 'Cindy')  |                  15367 |                   1059 |
| ('girl', 'Dawn')   |                  16492 |                   1618 |
| ('girl', 'Sophia') |                  26040 |                   3775 |
 """.strip()
    )

    # show totals
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                      |   ('SUM(num)', 'NULL') |   ('SUM(num)', 'Subtotal') |   ('MAX(num)', 'NULL') |   ('MAX(num)', 'Subtotal') |   ('Total (Sum)', '') |
|:---------------------|-----------------------:|---------------------------:|-----------------------:|---------------------------:|----------------------:|
| ('boy', 'Edward')    |                  40685 |                      40685 |                   1669 |                       1669 |                 42354 |
| ('boy', 'Tony')      |                   6438 |                       6438 |                    845 |                        845 |                  7283 |
| ('boy', 'Subtotal')  |                  47123 |                      47123 |                   2514 |                       2514 |                 49637 |
| ('girl', 'Amy')      |                  60166 |                      60166 |                   3081 |                       3081 |                 63247 |
| ('girl', 'Cindy')    |                  15367 |                      15367 |                   1059 |                       1059 |                 16426 |
| ('girl', 'Dawn')     |                  16492 |                      16492 |                   1618 |                       1618 |                 18110 |
| ('girl', 'Sophia')   |                  26040 |                      26040 |                   3775 |                       3775 |                 29815 |
| ('girl', 'Subtotal') |                 118065 |                     118065 |                   9533 |                       9533 |                127598 |
| ('Total (Sum)', '')  |                 165188 |                     165188 |                  12047 |                      12047 |                177235 |
  """.strip()
    )

    # apply_metrics_on_rows
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                |   ('NULL',) |
|:-------------------------------|------------:|
| ('SUM(num)', 'boy', 'Edward')  |       40685 |
| ('SUM(num)', 'boy', 'Tony')    |        6438 |
| ('SUM(num)', 'girl', 'Amy')    |       60166 |
| ('SUM(num)', 'girl', 'Cindy')  |       15367 |
| ('SUM(num)', 'girl', 'Dawn')   |       16492 |
| ('SUM(num)', 'girl', 'Sophia') |       26040 |
| ('MAX(num)', 'boy', 'Edward')  |        1669 |
| ('MAX(num)', 'boy', 'Tony')    |         845 |
| ('MAX(num)', 'girl', 'Amy')    |        3081 |
| ('MAX(num)', 'girl', 'Cindy')  |        1059 |
| ('MAX(num)', 'girl', 'Dawn')   |        1618 |
| ('MAX(num)', 'girl', 'Sophia') |        3775 |
    """.strip()
    )

    # apply_metrics_on_rows with combine_metrics
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=False,
        combine_metrics=True,
        show_rows_total=False,
        show_columns_total=False,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                |   ('NULL',) |
|:-------------------------------|------------:|
| ('boy', 'Edward', 'SUM(num)')  |       40685 |
| ('boy', 'Edward', 'MAX(num)')  |        1669 |
| ('boy', 'Tony', 'SUM(num)')    |        6438 |
| ('boy', 'Tony', 'MAX(num)')    |         845 |
| ('girl', 'Amy', 'SUM(num)')    |       60166 |
| ('girl', 'Amy', 'MAX(num)')    |        3081 |
| ('girl', 'Cindy', 'SUM(num)')  |       15367 |
| ('girl', 'Cindy', 'MAX(num)')  |        1059 |
| ('girl', 'Dawn', 'SUM(num)')   |       16492 |
| ('girl', 'Dawn', 'MAX(num)')   |        1618 |
| ('girl', 'Sophia', 'SUM(num)') |       26040 |
| ('girl', 'Sophia', 'MAX(num)') |        3775 |
    """.strip()
    )

    # everything
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum",
        transpose_pivot=True,
        combine_metrics=True,
        show_rows_total=True,
        show_columns_total=True,
        apply_metrics_on_rows=True,
    )
    assert (
        pivoted.to_markdown()
        == """
|                      |   ('boy', 'Edward') |   ('boy', 'Tony') |   ('boy', 'Subtotal') |   ('girl', 'Amy') |   ('girl', 'Cindy') |   ('girl', 'Dawn') |   ('girl', 'Sophia') |   ('girl', 'Subtotal') |   ('Total (Sum)', '') |
|:---------------------|--------------------:|------------------:|----------------------:|------------------:|--------------------:|-------------------:|---------------------:|-----------------------:|----------------------:|
| ('NULL', 'SUM(num)') |               40685 |              6438 |                 47123 |             60166 |               15367 |              16492 |                26040 |                 118065 |                165188 |
| ('NULL', 'MAX(num)') |                1669 |               845 |                  2514 |              3081 |                1059 |               1618 |                 3775 |                   9533 |                 12047 |
| ('NULL', 'Subtotal') |               42354 |              7283 |                 49637 |             63247 |               16426 |              18110 |                29815 |                 127598 |                177235 |
| ('Total (Sum)', '')  |               42354 |              7283 |                 49637 |             63247 |               16426 |              18110 |                29815 |                 127598 |                177235 |
    """.strip()
    )

    # fraction
    pivoted = pivot_df(
        df,
        rows=["gender", "name"],
        columns=["state"],
        metrics=["SUM(num)", "MAX(num)"],
        aggfunc="Sum as Fraction of Columns",
        transpose_pivot=False,
        combine_metrics=False,
        show_rows_total=False,
        show_columns_total=True,
        apply_metrics_on_rows=False,
    )
    assert (
        pivoted.to_markdown()
        == """
|                                            |   ('SUM(num)', 'NULL') |   ('MAX(num)', 'NULL') |
|:-------------------------------------------|-----------------------:|-----------------------:|
| ('boy', 'Edward')                          |              0.246295  |              0.138541  |
| ('boy', 'Tony')                            |              0.0389738 |              0.0701419 |
| ('boy', 'Subtotal')                        |              0.285269  |              0.208683  |
| ('girl', 'Amy')                            |              0.364227  |              0.255748  |
| ('girl', 'Cindy')                          |              0.0930273 |              0.0879057 |
| ('girl', 'Dawn')                           |              0.0998378 |              0.134307  |
| ('girl', 'Sophia')                         |              0.157639  |              0.313356  |
| ('girl', 'Subtotal')                       |              0.714731  |              0.791317  |
| ('Total (Sum as Fraction of Columns)', '') |              1         |              1         |
    """.strip()
    )


def test_table():
    """
    Test that the table reports honor `d3NumberFormat`.
    """
    df = pd.DataFrame.from_dict({"count": {0: 80679663}})
    form_data = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "NULL",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_ameaka2efjv_rfv1et5nwng",
                "isExtra": False,
                "isNew": False,
                "operator": "!=",
                "sqlExpression": None,
                "subject": "lang_at_home",
            }
        ],
        "all_columns": [],
        "color_pn": True,
        "column_config": {"count": {"d3NumberFormat": ",d"}},
        "conditional_formatting": [],
        "datasource": "8__table",
        "extra_form_data": {},
        "granularity_sqla": "time_start",
        "groupby": ["lang_at_home"],
        "metrics": ["count"],
        "order_by_cols": [],
        "order_desc": True,
        "percent_metrics": [],
        "query_mode": "aggregate",
        "row_limit": "15",
        "server_page_length": 10,
        "show_cell_bars": True,
        "table_timestamp_format": "smart_date",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "url_params": {},
        "viz_type": "table",
    }
    formatted = table(df, form_data)
    assert (
        formatted.to_markdown()
        == """
|    | count      |
|---:|:-----------|
|  0 | 80,679,663 |
    """.strip()
    )


def test_apply_post_process_no_form_invalid_viz_type():
    """
    Test with invalid viz type. It should just return the result
    """
    result = {"foo": "bar"}
    form_data = {"viz_type": "baz"}
    assert apply_post_process(result, form_data) == result


def test_apply_post_process_without_result_format():
    """
    A query without result_format should raise an exception
    """
    result = {"queries": [{"result_format": "foo"}]}
    form_data = {"viz_type": "pivot_table_v2"}

    with pytest.raises(Exception) as ex:
        apply_post_process(result, form_data)

    assert ex.match("Result format foo not supported") is True  # noqa: E712


def test_apply_post_process_json_format():
    """
    It should be able to process json results
    """

    result = {
        "queries": [
            {
                "result_format": ChartDataResultFormat.JSON,
                "data": {
                    "result": [
                        {
                            "data": [{"COUNT(is_software_dev)": 4725}],
                            "colnames": ["COUNT(is_software_dev)"],
                            "coltypes": [0],
                        }
                    ]
                },
            }
        ]
    }
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [
            {
                "result_format": ChartDataResultFormat.JSON,
                "data": {
                    "result": {
                        "Total (Sum)": {
                            "data": [{"COUNT(is_software_dev)": 4725}],
                            "colnames": ["COUNT(is_software_dev)"],
                            "coltypes": [0],
                        }
                    }
                },
                "colnames": [("result",)],
                "indexnames": [("Total (Sum)",)],
                "coltypes": [GenericDataType.STRING],
                "rowcount": 1,
            }
        ]
    }


def test_apply_post_process_csv_format():
    """
    It should be able to process csv results
    """

    result = {
        "queries": [
            {
                "result_format": ChartDataResultFormat.CSV,
                "data": """
COUNT(is_software_dev)
4725
""",
            }
        ]
    }
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [
            {
                "result_format": ChartDataResultFormat.CSV,
                "data": ",COUNT(is_software_dev)\nTotal (Sum),4725\n",
                "colnames": [("COUNT(is_software_dev)",)],
                "indexnames": [("Total (Sum)",)],
                "coltypes": [GenericDataType.NUMERIC],
                "rowcount": 1,
            }
        ]
    }


def test_apply_post_process_csv_format_empty_string():
    """
    It should be able to process csv results with no data
    """

    result = {"queries": [{"result_format": ChartDataResultFormat.CSV, "data": ""}]}
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [{"result_format": ChartDataResultFormat.CSV, "data": ""}]
    }


@pytest.mark.parametrize("data", [None, "", "\n"])
def test_apply_post_process_csv_format_no_data(data):
    """
    It should be able to process csv results with no data
    """

    result = {"queries": [{"result_format": ChartDataResultFormat.CSV, "data": data}]}
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [{"result_format": ChartDataResultFormat.CSV, "data": data}]
    }


def test_apply_post_process_csv_format_no_data_multiple_queries():
    """
    It should be able to process csv results multiple queries if one query has no data
    """

    result = {
        "queries": [
            {"result_format": ChartDataResultFormat.CSV, "data": ""},
            {
                "result_format": ChartDataResultFormat.CSV,
                "data": """
COUNT(is_software_dev)
4725
""",
            },
        ]
    }
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [
            {"result_format": ChartDataResultFormat.CSV, "data": ""},
            {
                "result_format": ChartDataResultFormat.CSV,
                "data": ",COUNT(is_software_dev)\nTotal (Sum),4725\n",
                "colnames": [("COUNT(is_software_dev)",)],
                "indexnames": [("Total (Sum)",)],
                "coltypes": [GenericDataType.NUMERIC],
                "rowcount": 1,
            },
        ]
    }


def test_apply_post_process_json_format_empty_string():
    """
    It should be able to process json results with no data
    """

    result = {"queries": [{"result_format": ChartDataResultFormat.JSON, "data": ""}]}
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [{"result_format": ChartDataResultFormat.JSON, "data": ""}]
    }


def test_apply_post_process_json_format_data_is_none():
    """
    It should be able to process json results with no data
    """

    result = {"queries": [{"result_format": ChartDataResultFormat.JSON, "data": None}]}
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": [
            {
                "aggregate": "COUNT",
                "column": {
                    "column_name": "is_software_dev",
                    "description": None,
                    "expression": None,
                    "filterable": True,
                    "groupby": True,
                    "id": 1463,
                    "is_dttm": False,
                    "python_date_format": None,
                    "type": "DOUBLE PRECISION",
                    "verbose_name": None,
                },
                "expressionType": "SIMPLE",
                "hasCustomLabel": False,
                "isNew": False,
                "label": "COUNT(is_software_dev)",
                "optionName": "metric_9i1kctig9yr_sizo6ihd2o",
                "sqlExpression": None,
            }
        ],
        "metricsLayout": "COLUMNS",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "Currently A Developer",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_fvi0jg9aii_2lekqrhy7qk",
                "isExtra": False,
                "isNew": False,
                "operator": "==",
                "sqlExpression": None,
                "subject": "developer_type",
            }
        ],
        "row_limit": 10000,
        "order_desc": True,
        "aggregateFunction": "Sum",
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data) == {
        "queries": [{"result_format": ChartDataResultFormat.JSON, "data": None}]
    }


def test_apply_post_process_verbose_map(session: Session):
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, SqlMetric
    from superset.models.core import Database

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=[],
        metrics=[
            SqlMetric(
                metric_name="count",
                verbose_name="COUNT(*)",
                metric_type="count",
                expression="COUNT(*)",
            )
        ],
        database=database,
    )

    result = {
        "queries": [
            {
                "result_format": ChartDataResultFormat.JSON,
                "data": [{"count": 4725}],
            }
        ]
    }
    form_data = {
        "datasource": "19__table",
        "viz_type": "pivot_table_v2",
        "slice_id": 69,
        "url_params": {},
        "granularity_sqla": "time_start",
        "time_grain_sqla": "P1D",
        "time_range": "No filter",
        "groupbyColumns": [],
        "groupbyRows": [],
        "metrics": ["COUNT(*)"],
        "metricsLayout": "COLUMNS",
        "row_limit": 10000,
        "order_desc": True,
        "valueFormat": "SMART_NUMBER",
        "date_format": "smart_date",
        "rowOrder": "key_a_to_z",
        "colOrder": "key_a_to_z",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "results",
    }

    assert apply_post_process(result, form_data, datasource=sqla_table) == {
        "queries": [
            {
                "result_format": ChartDataResultFormat.JSON,
                "data": {"COUNT(*)": {"Total (Sum)": 4725}},
                "colnames": [("COUNT(*)",)],
                "indexnames": [("Total (Sum)",)],
                "coltypes": [GenericDataType.NUMERIC],
                "rowcount": 1,
            }
        ]
    }
