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
from typing import Any, Callable, Dict

import pytest

from superset.utils.public_interfaces import compute_hash, get_warning_message

# These are public interfaces exposed by Superset. Make sure
# to only change the interfaces and update the hashes in new
# major versions of Superset.
hashes: Dict[Callable[..., Any], str] = {}


@pytest.mark.parametrize("interface,expected_hash", list(hashes.items()))
def test_public_interfaces(interface, expected_hash):
    """Test that public interfaces have not been accidentally changed."""
    current_hash = compute_hash(interface)
    assert current_hash == expected_hash, get_warning_message(interface, current_hash)


def test_func_hash():
    """Test that changing a function signature changes its hash."""

    def some_function(a, b):
        return a + b

    original_hash = compute_hash(some_function)

    # pylint: disable=function-redefined
    def some_function(a, b, c):
        return a + b + c

    assert original_hash != compute_hash(some_function)


def test_class_hash():
    """Test that changing a class changes its hash."""

    # pylint: disable=too-few-public-methods, invalid-name
    class SomeClass:
        def __init__(self, a, b):
            self.a = a
            self.b = b

        def add(self):
            return self.a + self.b

    original_hash = compute_hash(SomeClass)

    # changing the __init__ should change the hash
    # pylint: disable=function-redefined, too-few-public-methods, invalid-name
    class SomeClass:
        def __init__(self, a, b, c):
            self.a = a
            self.b = b
            self.c = c

        def add(self):
            return self.a + self.b

    assert original_hash != compute_hash(SomeClass)

    # renaming a public method should change the hash
    # pylint: disable=function-redefined, too-few-public-methods, invalid-name
    class SomeClass:
        def __init__(self, a, b):
            self.a = a
            self.b = b

        def sum(self):
            return self.a + self.b

    assert original_hash != compute_hash(SomeClass)

    # adding a private method should not change the hash
    # pylint: disable=function-redefined, too-few-public-methods, invalid-name
    class SomeClass:
        def __init__(self, a, b):
            self.a = a
            self.b = b

        def add(self):
            return self._sum()

        def _sum(self):
            return self.a + self.b

    assert original_hash == compute_hash(SomeClass)
