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
import warnings
from unittest.mock import call, Mock

from superset.utils import decorators
from tests.base_tests import SupersetTestCase


class UtilsDecoratorsTests(SupersetTestCase):
    def test_debounce(self):
        mock = Mock()

        @decorators.debounce()
        def myfunc(arg1: int, arg2: int, kwarg1: str = "abc", kwarg2: int = 2):
            mock(arg1, kwarg1)
            return arg1 + arg2 + kwarg2

        # should be called only once when arguments don't change
        myfunc(1, 1)
        myfunc(1, 1)
        result = myfunc(1, 1)
        mock.assert_called_once_with(1, "abc")
        self.assertEqual(result, 4)

        # kwarg order shouldn't matter
        myfunc(1, 0, kwarg2=2, kwarg1="haha")
        result = myfunc(1, 0, kwarg1="haha", kwarg2=2)
        mock.assert_has_calls([call(1, "abc"), call(1, "haha")])
        self.assertEqual(result, 3)

    def test_guard_func(self):
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            @decorators.guard("`x=c{#?3CakO9ObP>|Wn")
            def some_function(a, b):
                return a + b

            # should trigger no warnings
            assert len(w) == 0

    def test_guard_func_modified(self):
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            @decorators.guard("`x=c{#?3CakO9ObP>|Wn")
            def some_function(a, b, c):
                return a + b

            assert len(w) == 1

    def test_guard_class(self):
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            @decorators.guard("x-@vK+|sloQN3GFZK8l<")
            class SomeClass:
                def __init__(self, a, b):
                    self.a = a
                    self.b = b

            # should trigger no warnings
            assert len(w) == 0

    def test_guard_class_change_init(self):
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            @decorators.guard("x-@vK+|sloQN3GFZK8l<")
            class SomeClass:
                def __init__(self, a, b, c):
                    self.a = a
                    self.b = b
                    self.c = c

            assert len(w) == 1

    def test_guard_class_add_public_method(self):
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            @decorators.guard("x-@vK+|sloQN3GFZK8l<")
            class SomeClass:
                def __init__(self, a, b):
                    self.a = a
                    self.b = b

                def add(self):
                    return self.a + self.b

            assert len(w) == 1

    def test_guard_class_add_private_method(self):
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            @decorators.guard("x-@vK+|sloQN3GFZK8l<")
            class SomeClass:
                def __init__(self, a, b):
                    self.a = a
                    self.b = b

                def _add(self):
                    return self.a + self.b

            # should trigger no warnings
            assert len(w) == 0
