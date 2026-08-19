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

import inspect

from superset.utils import pandas_postprocessing
from superset.utils.pandas_postprocessing.utils import validate_column_args


def test_decorated_operation_keeps_its_identity() -> None:
    """
    Stored query_context blobs can carry options an operation no longer accepts, and
    telling those apart means introspecting the operation. `validate_column_args`
    used to return a bare `wrapped(df, **options)`, so every decorated operation
    advertised arbitrary keywords and its real signature was unreachable (#42926).
    """
    assert pandas_postprocessing.pivot.__name__ == "pivot"

    parameters = inspect.signature(pandas_postprocessing.pivot).parameters
    assert "index" in parameters
    assert "aggregates" in parameters
    # the wrapper's own catch-all is no longer what callers see
    assert "options" not in parameters


def test_removed_option_is_visible_as_unsupported() -> None:
    """
    `flatten_columns` and `reset_index` were removed from `pivot` when flattening
    became its own operation. With the signature restored, a caller can see that a
    stored option is no longer supported instead of only finding out via TypeError.
    """
    parameters = inspect.signature(pandas_postprocessing.pivot).parameters

    assert "flatten_columns" not in parameters
    assert "reset_index" not in parameters


def test_validation_still_rejects_unknown_columns() -> None:
    import pandas as pd
    import pytest

    from superset.exceptions import InvalidPostProcessingError

    @validate_column_args("columns")
    def operation(df: pd.DataFrame, **options: object) -> pd.DataFrame:
        return df

    df = pd.DataFrame({"present": [1]})

    assert operation(df, columns=["present"]) is df
    with pytest.raises(InvalidPostProcessingError):
        operation(df, columns=["absent"])


def test_docstring_is_preserved() -> None:
    assert pandas_postprocessing.pivot.__doc__
    assert "pivot operation" in pandas_postprocessing.pivot.__doc__
