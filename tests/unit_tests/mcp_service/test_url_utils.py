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

from superset.mcp_service.utils.url_utils import extract_permalink_key_from_url


def test_extract_permalink_key_from_url_with_trailing_slash():
    url = "http://localhost:8088/explore/p/abc123/"
    assert extract_permalink_key_from_url(url) == "abc123"


def test_extract_permalink_key_from_url_without_trailing_slash():
    url = "http://localhost:8088/explore/p/abc123"
    assert extract_permalink_key_from_url(url) == "abc123"


def test_extract_permalink_key_from_url_no_match():
    url = "http://localhost:8088/explore/?form_data_key=abc123"
    assert extract_permalink_key_from_url(url) is None


def test_extract_permalink_key_from_url_none():
    assert extract_permalink_key_from_url(None) is None


def test_extract_permalink_key_from_url_empty():
    assert extract_permalink_key_from_url("") is None


def test_extract_permalink_key_from_url_with_path_prefix():
    url = "https://example.com/superset/explore/p/xyz789/"
    assert extract_permalink_key_from_url(url) == "xyz789"
