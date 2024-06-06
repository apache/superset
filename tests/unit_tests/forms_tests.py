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
import contextlib
import tempfile
from typing import Optional

import pytest
from flask_wtf.file import FileField
from wtforms import Form, ValidationError

from superset.forms import FileSizeLimit


def _get_test_form(size_limit: Optional[int]) -> Form:
    class TestForm(Form):
        test = FileField("test", validators=[FileSizeLimit(size_limit)])

    return TestForm()


@contextlib.contextmanager
def _tempfile(contents: bytes):
    with tempfile.NamedTemporaryFile() as f:
        f.write(contents)
        f.flush()

        yield f


def test_file_size_limit_pass() -> None:
    """Permit files which do not exceed the size limit"""
    limit = 100
    form = _get_test_form(limit)

    with _tempfile(b"." * limit) as f:
        form.test.data = f
        assert form.validate() is True


def test_file_size_limit_fail() -> None:
    """Reject files which are too large"""
    limit = 100
    form = _get_test_form(limit)

    with _tempfile(b"." * (limit + 1)) as f:
        form.test.data = f
        assert form.validate() is False


def test_file_size_limit_ignored_if_none() -> None:
    """Permit files when there is no limit"""
    form = _get_test_form(None)

    with _tempfile(b"." * 200) as f:
        form.test.data = f
        assert form.validate() is True
