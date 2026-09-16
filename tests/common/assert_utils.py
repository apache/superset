#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from unittest import mock


def assert_any_call_with_text(
    m: mock.Mock,
    q: str,
):
    """
    Assert the mock has been called with the specified query.

    Compares by value when an SQLAlchemy text object is passed to the mock.
    """
    assert any(
        hasattr(call_args_it[0][0], "text") and call_args_it[0][0].text == q
        for call_args_it in m.call_args_list
    )


def assert_called_once_with_text(
    m: mock.Mock,
    q: str,
):
    """
    Assert that the mock was called exactly once and that call was with the specified
    arguments.

    Compares by value when an SQLAlchemy text object is passed to the mock.
    """
    m.assert_called_once()
    assert m.call_args[0][0].text == q


def assert_called_with_text(
    m: mock.Mock,
    q: str,
):
    """
    This method is a convenient way of asserting that the last call has been made in a
    particular way.

    Compares by value when an SQLAlchemy text object is passed to the mock.
    """
    assert m.call_args[0][0].text == q
