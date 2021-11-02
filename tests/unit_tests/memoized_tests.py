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
import time

from pytest import mark

from superset.utils.memoized import _memoized, memoized


@mark.unittest
class TestMemoized:
    def test_memoized_on_functions(self):
        @memoized
        def test_function(a, b, c):
            return {"key": a + b + c}

        result1 = test_function(1, 2, 3)
        result2 = test_function(1, 2, 3)
        assert result1 is result2

    def test_memoized_on_methods(self):
        class test_class:
            def __init__(self, num):
                self.num = num
                self.watcher = 0

            @memoized
            def test_method(self, a, b, c):
                self.watcher += 1
                return a * b * c * self.num

        instance = test_class(5)
        result1 = instance.test_method(1, 2, 3)
        result2 = instance.test_method(1, 2, 3)
        assert result1 is result2
        assert instance.watcher == 1
        instance.num = 10
        assert result2 == instance.test_method(1, 2, 3)

    def test_memorized_size(self):
        new_memoized = _memoized(maxsize=1)

        @new_memoized
        def test_add(a, b):
            # return a reference type instead of primal type
            return {"key": a + b}

        result1 = test_add(1, 2)
        # clear cache
        test_add(2, 3)
        result2 = test_add(1, 2)
        assert result1 is not result2

    def test_memorized_expire(self):
        new_memoized = _memoized(seconds=1)

        @new_memoized
        def test_add(a, b):
            # return a reference type instead of primal type
            return {"key": a + b}

        result1 = test_add(1, 2)
        # clear cache
        time.sleep(2)
        result2 = test_add(1, 2)
        assert result1 is not result2
