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

from superset.utils.pandas_postprocessing import (
    escape_separator,
    pivot,
    unescape_separator,
)


def test_escape_separator():
    assert escape_separator(r" hell \world ") == r" hell \world "
    assert unescape_separator(r" hell \world ") == r" hell \world "

    escape_string = escape_separator("hello, world")
    assert escape_string == r"hello\, world"
    assert unescape_separator(escape_string) == "hello, world"

    escape_string = escape_separator("hello,world")
    assert escape_string == r"hello\,world"
    assert unescape_separator(escape_string) == "hello,world"


def test_validate_column_args_preserves_signature():
    """
    The decorator must not hide the signature of the operation it wraps.

    `inspect.signature` follows `__wrapped__`, which `functools.wraps` sets.
    Without it every decorated operation reports `(df, **options)`, and code
    that inspects the signature -- see `QueryObject._drop_unsupported_options`
    -- cannot tell a supported option from an unsupported one.
    """
    parameters = inspect.signature(pivot).parameters

    assert pivot.__name__ == "pivot"
    assert "options" not in parameters
    assert {"index", "aggregates", "columns"} <= set(parameters)
