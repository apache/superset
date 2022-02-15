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

from pytest import mark

from superset.utils.memoized import memoized


@mark.unittest
class TestMemoized:
    def test_memoized_on_functions(self):
        watcher = {"val": 0}

        @memoized
        def test_function(a, b, c):
            watcher["val"] += 1
            return a * b * c

        result1 = test_function(1, 2, 3)
        result2 = test_function(1, 2, 3)
        assert result1 == result2
        assert watcher["val"] == 1

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
        assert result1 == result2
        assert instance.watcher == 1
        instance.num = 10
        assert result2 == instance.test_method(1, 2, 3)

    def test_memoized_on_methods_with_watches(self):
        class test_class:
            def __init__(self, x, y):
                self.x = x
                self.y = y
                self.watcher = 0

            @memoized(watch=("x", "y"))
            def test_method(self, a, b, c):
                self.watcher += 1
                return a * b * c * self.x * self.y

        instance = test_class(3, 12)
        result1 = instance.test_method(1, 2, 3)
        result2 = instance.test_method(1, 2, 3)
        assert result1 == result2
        assert instance.watcher == 1
        result3 = instance.test_method(2, 3, 4)
        assert instance.watcher == 2
        result4 = instance.test_method(2, 3, 4)
        assert instance.watcher == 2
        assert result3 == result4
        assert result3 != result1
        instance.x = 1
        result5 = instance.test_method(2, 3, 4)
        assert instance.watcher == 3
        assert result5 != result4
        result6 = instance.test_method(2, 3, 4)
        assert instance.watcher == 3
        assert result6 == result5
        instance.x = 10
        instance.y = 10
        result7 = instance.test_method(2, 3, 4)
        assert instance.watcher == 4
        assert result7 != result6
        instance.x = 3
        instance.y = 12
        result8 = instance.test_method(1, 2, 3)
        assert instance.watcher == 4
        assert result1 == result8
