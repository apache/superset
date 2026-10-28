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
"""Unit tests for the shared streaming CSV export helpers."""

import codecs

import pytest

from superset.commands.streaming_export.base import encode_csv_stream


def test_encode_csv_stream_writes_bom_once() -> None:
    """utf-8-sig writes a single BOM at the start, not one per chunk."""
    chunks = ["name;city\r\n", "Müller;Köln\r\n", "Weiß;Zürich\r\n"]

    data = b"".join(encode_csv_stream(chunks, "utf-8-sig"))

    assert data.startswith(codecs.BOM_UTF8)
    assert data.count(codecs.BOM_UTF8) == 1
    assert data == codecs.BOM_UTF8 + "".join(chunks).encode("utf-8")


def test_encode_csv_stream_skips_empty_chunks() -> None:
    """Empty chunks don't produce empty byte chunks in the response body."""
    encoded = list(encode_csv_stream(["", "a,b\r\n", ""], "utf-8"))

    assert encoded == [b"a,b\r\n"]


@pytest.mark.parametrize("encoding", ["utf-8", "latin-1", "cp1252", "utf-16"])
def test_encode_csv_stream_uses_configured_encoding(encoding: str) -> None:
    """The streamed bytes match encoding the whole file in one go."""
    chunks = ["name,city\r\n", "Müller,Köln\r\n"]

    data = b"".join(encode_csv_stream(chunks, encoding))

    assert data == "".join(chunks).encode(encoding)
