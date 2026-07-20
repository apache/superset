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
from sqlalchemy import create_engine, types

from superset.utils.pandas_sqlalchemy_compat import (
    restore_pandas_sqlalchemy_support,
)


def test_to_sql_accepts_sqlalchemy_engine_and_dtypes() -> None:
    """
    ``DataFrame.to_sql`` must accept a SQLAlchemy engine plus SQLAlchemy
    ``dtype`` objects regardless of the installed pandas/SQLAlchemy combo.

    This is the exact call shape used by dataset uploads
    (``BaseEngineSpec.df_to_sql``), example data loading, and the test data
    loaders; it breaks when pandas silently rejects the installed SQLAlchemy
    as too old (pandas >= 2.2 with SQLAlchemy 1.x) and no compat shim is
    applied.
    """
    restore_pandas_sqlalchemy_support()

    engine = create_engine("sqlite://")
    df = pd.DataFrame(
        {
            "name": ["a", "b"],
            "num": [1, 2],
            "ds": pd.to_datetime(["2021-01-01", "2021-01-02"]),
        }
    )
    df.to_sql(
        "birth_names",
        engine,
        index=False,
        dtype={"ds": types.DateTime(), "name": types.String(255)},
        method="multi",
        chunksize=100,
    )
    df.to_sql("birth_names", engine, index=False, if_exists="replace")

    result = pd.read_sql_query("SELECT name, num FROM birth_names", engine)
    assert result["name"].tolist() == ["a", "b"]
    assert result["num"].tolist() == [1, 2]


def test_restore_pandas_sqlalchemy_support_is_idempotent() -> None:
    from pandas.compat import _optional

    restore_pandas_sqlalchemy_support()
    first = _optional.VERSIONS.get("sqlalchemy")
    restore_pandas_sqlalchemy_support()
    assert _optional.VERSIONS.get("sqlalchemy") == first
