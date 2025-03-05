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

from superset.commands.report.utils import remove_post_processed


def test_remove_post_processed():
    url = "https://superset.com/?param1=value1&type=post_processed&param2=value2"
    expected = "https://superset.com/?param1=value1&param2=value2"
    assert remove_post_processed(url) == expected


def test_retain_other_parameters():
    url = "https://superset.com/?param1=value1&param2=value2"
    expected = "https://superset.com/?param1=value1&param2=value2"
    assert remove_post_processed(url) == expected


def test_no_post_processed_present():
    url = "https://superset.com/?param1=value1&param2=value2"
    expected = "https://superset.com/?param1=value1&param2=value2"
    assert remove_post_processed(url) == expected


def test_empty_query_string():
    url = "https://superset.com/?"
    expected = "https://superset.com/?"
    assert remove_post_processed(url) == expected


def test_no_query_string():
    url = "https://superset.com"
    expected = "https://superset.com"
    assert remove_post_processed(url) == expected
