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
from io import BytesIO

import pytest
from werkzeug.datastructures import FileStorage

from superset.commands.importers.exceptions import IncorrectFormatError
from superset.css_templates.utils import (
    CSS_FILE_MAX_SIZE_BYTES,
    get_template_name,
    is_css_file,
    read_css_file,
)


@pytest.mark.parametrize(
    "file_name, expected",
    [
        ("dark_mode.css", "dark_mode"),
        ("Dark Mode.CSS", "Dark Mode"),
        ("my.theme.css", "my.theme"),
        ("nested/dir/theme.css", "theme"),
        ("C:\\Users\\me\\theme.css", "theme"),
        (".css", ""),
    ],
)
def test_get_template_name(file_name: str, expected: str) -> None:
    assert get_template_name(file_name) == expected


@pytest.mark.parametrize(
    "file_name, expected",
    [
        ("theme.css", True),
        ("THEME.CSS", True),
        ("theme.css.txt", False),
        ("theme.scss", False),
        ("theme", False),
        ("", False),
    ],
)
def test_is_css_file(file_name: str, expected: bool) -> None:
    assert is_css_file(file_name) is expected


def test_read_css_file() -> None:
    upload = FileStorage(BytesIO(b"h1 { color: red; }"), filename="theme.css")
    assert read_css_file(upload) == "h1 { color: red; }"


def test_read_css_file_strips_byte_order_mark() -> None:
    upload = FileStorage(
        BytesIO("\ufeffh1 { color: red; }".encode()), filename="theme.css"
    )
    assert read_css_file(upload) == "h1 { color: red; }"


def test_read_css_file_rejects_non_css_extension() -> None:
    upload = FileStorage(BytesIO(b"h1 { color: red; }"), filename="theme.txt")
    with pytest.raises(IncorrectFormatError, match="is not a CSS file"):
        read_css_file(upload)


def test_read_css_file_rejects_invalid_utf8() -> None:
    upload = FileStorage(BytesIO(b"\xff\xfe\xfd"), filename="theme.css")
    with pytest.raises(IncorrectFormatError, match="is not valid UTF-8"):
        read_css_file(upload)


def test_read_css_file_rejects_oversized_file() -> None:
    upload = FileStorage(
        BytesIO(b"a" * (CSS_FILE_MAX_SIZE_BYTES + 1)), filename="theme.css"
    )
    with pytest.raises(IncorrectFormatError, match="exceeds the maximum size"):
        read_css_file(upload)


def test_read_css_file_accepts_file_at_size_limit() -> None:
    upload = FileStorage(BytesIO(b"a" * CSS_FILE_MAX_SIZE_BYTES), filename="theme.css")
    assert len(read_css_file(upload)) == CSS_FILE_MAX_SIZE_BYTES
