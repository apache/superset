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
from unittest.mock import Mock, patch

from tests.common.example_data_generator.string_generator import StringGenerator


@patch("tests.common.example_data_generator.string_generator.choices")
@patch("tests.common.example_data_generator.string_generator.randint")
def test_string_generator(randint_mock: Mock, choices_mock: Mock):
    letters = "abcdets"
    min_len = 3
    max_len = 5
    randomized_string_len = 4
    string_generator = StringGenerator(letters, min_len, max_len)
    randint_mock.return_value = randomized_string_len
    choices_mock.return_value = ["t", "e", "s", "t"]

    assert string_generator.generate() == "test"
    randint_mock.assert_called_once_with(min_len, max_len)
    choices_mock.assert_called_with(letters, k=randomized_string_len)
