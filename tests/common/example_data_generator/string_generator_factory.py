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
import string

from tests.common.example_data_generator.string_generator import StringGenerator


class StringGeneratorFactory:
    @classmethod
    def make(
        cls, seed_letters: str, min_length: int, max_length: int
    ) -> StringGenerator:
        cls.__validate_arguments(seed_letters, min_length, max_length)
        return StringGenerator(seed_letters, min_length, max_length)

    @classmethod
    def make_lowercase_based(cls, min_length: int, max_length: int) -> StringGenerator:
        return cls.make(string.ascii_lowercase, min_length, max_length)

    @classmethod
    def make_ascii_letters_based(
        cls, min_length: int, max_length: int
    ) -> StringGenerator:
        return cls.make(string.ascii_letters, min_length, max_length)

    @staticmethod
    def __validate_arguments(
        seed_letters: str, min_length: int, max_length: int
    ) -> None:
        assert seed_letters, "seed_letters is empty"
        assert min_length > -1, "min_length is negative"
        assert max_length > min_length, "max_length is not bigger then min_length"
