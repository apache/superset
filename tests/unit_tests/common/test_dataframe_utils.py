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
import datetime

import pandas as pd

from superset.common.utils import dataframe_utils


def test_is_datetime_series():
    assert not dataframe_utils.is_datetime_series(None)
    assert not dataframe_utils.is_datetime_series(pd.DataFrame({"foo": [1]}))
    assert not dataframe_utils.is_datetime_series(pd.Series([1, 2, 3]))
    assert not dataframe_utils.is_datetime_series(pd.Series(["1", "2", "3"]))
    assert not dataframe_utils.is_datetime_series(pd.Series())
    assert not dataframe_utils.is_datetime_series(pd.Series([None, None]))
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.date(2018, 1, 1), datetime.date(2018, 1, 2), None])
    )
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.date(2018, 1, 1), datetime.date(2018, 1, 2)])
    )
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.datetime(2018, 1, 1), datetime.datetime(2018, 1, 2), None])
    )
    assert dataframe_utils.is_datetime_series(
        pd.Series([datetime.datetime(2018, 1, 1), datetime.datetime(2018, 1, 2)])
    )
    assert dataframe_utils.is_datetime_series(
        pd.date_range(datetime.date(2018, 1, 1), datetime.date(2018, 2, 1)).to_series()
    )
    assert dataframe_utils.is_datetime_series(
        pd.date_range(
            datetime.datetime(2018, 1, 1), datetime.datetime(2018, 2, 1)
        ).to_series()
    )
