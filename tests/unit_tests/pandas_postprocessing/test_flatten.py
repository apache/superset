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

from superset.utils import pandas_postprocessing as pp
from superset.utils.pandas_postprocessing.utils import FLAT_COLUMN_SEPARATOR


def test_flat_should_not_change():
    df = pd.DataFrame(data={"foo": [1, 2, 3], "bar": [4, 5, 6],})

    assert pp.flatten(df).equals(df)


def test_flat_should_not_reset_index():
    index = pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"])
    index.name = "__timestamp"
    df = pd.DataFrame(index=index, data={"foo": [1, 2, 3], "bar": [4, 5, 6]})

    assert pp.flatten(df, reset_index=False).equals(df)


def test_flat_should_flat_datetime_index():
    index = pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"])
    index.name = "__timestamp"
    df = pd.DataFrame(index=index, data={"foo": [1, 2, 3], "bar": [4, 5, 6]})

    assert pp.flatten(df).equals(
        pd.DataFrame({"__timestamp": index, "foo": [1, 2, 3], "bar": [4, 5, 6],})
    )


def test_flat_should_flat_multiple_index():
    index = pd.to_datetime(["2021-01-01", "2021-01-02", "2021-01-03"])
    index.name = "__timestamp"
    iterables = [["foo", "bar"], [1, "two"]]
    columns = pd.MultiIndex.from_product(iterables, names=["level1", "level2"])
    df = pd.DataFrame(index=index, columns=columns, data=1)

    assert pp.flatten(df).equals(
        pd.DataFrame(
            {
                "__timestamp": index,
                FLAT_COLUMN_SEPARATOR.join(["foo", "1"]): [1, 1, 1],
                FLAT_COLUMN_SEPARATOR.join(["foo", "two"]): [1, 1, 1],
                FLAT_COLUMN_SEPARATOR.join(["bar", "1"]): [1, 1, 1],
                FLAT_COLUMN_SEPARATOR.join(["bar", "two"]): [1, 1, 1],
            }
        )
    )
