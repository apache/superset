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
from unittest.mock import call, Mock

from superset.utils import decorators
from tests.integration_tests.base_tests import SupersetTestCase


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
