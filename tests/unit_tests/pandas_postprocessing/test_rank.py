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
import numpy as np
import pandas as pd
import pytest

from superset.utils import pandas_postprocessing as pp
from tests.unit_tests.fixtures.dataframes import categories_df


@pytest.mark.parametrize(
    "group_by,expected",
    [
        ("", [0.5, 1.0, 0.5, 1.0]),
        ("dept", [0.5, 1.0, 0.5, 1.0]),
        (None, [0.25, 0.75, 0.5, 1.0]),
    ],
)
def test_rank_group_column(group_by: str | None, expected: list[float]) -> None:
    """Distinguish an explicit group column from ungrouped ranking."""
    df = pd.DataFrame(
        {
            "": ["A", "A", "B", "B"],
            "dept": ["A", "A", "B", "B"],
            "value": [1, 3, 2, 4],
        }
    )

    result = pp.rank(df, "value", group_by=group_by)

    pd.testing.assert_series_equal(result["rank"], pd.Series(expected, name="rank"))


def test_rank_should_rank():
    # Here we use np.isclose to avoid "false positives" in != tests
    # Plain
    _categories_df = categories_df.copy(deep=True)
    assert np.isclose(
        pp.rank(_categories_df, "asc_idx")["rank"],
        np.linspace(1.0 / 101.0, 1.0, 101),
        rtol=1e-8,
    ).all()

    # Grouped
    gb = pp.rank(_categories_df, "asc_idx", "dept").groupby("dept")
    res = gb.apply(
        lambda x: np.isclose(
            x.sort_values("rank")["rank"],
            np.linspace(1.0 / len(x), 1.0, len(x)),
            rtol=1e-8,
        ).all()
    )
    assert res.all()


def test_rank_single_cat():
    # Check that reducing the category to one value still holds valid results
    _categories_df = categories_df.copy(deep=True)

    # This was raising up to 6.1.0, see https://github.com/apache/superset/issues/40709
    tmp_df = _categories_df[_categories_df["dept"] == "dept0"].reset_index(drop=True)
    pp.rank(tmp_df, "asc_idx", "dept")

    assert tmp_df["rank"].min() == 1.0 / len(tmp_df)
    assert tmp_df["rank"].max() == 1.0
