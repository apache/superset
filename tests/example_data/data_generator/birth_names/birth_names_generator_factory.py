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
from __future__ import annotations

from abc import ABC, abstractmethod

from tests.example_data.data_generator.birth_names.birth_names_generator import (
    BirthNamesGenerator,
)
from tests.example_data.data_generator.string_generator_factory import (
    StringGeneratorFactory,
)


class BirthNamesGeneratorFactory(ABC):
    __factory: BirthNamesGeneratorFactory

    @abstractmethod
    def _make(self) -> BirthNamesGenerator: ...

    @classmethod
    def make(cls) -> BirthNamesGenerator:
        return cls._get_instance()._make()

    @classmethod
    def set_instance(cls, factory: BirthNamesGeneratorFactory) -> None:
        cls.__factory = factory

    @classmethod
    def _get_instance(cls) -> BirthNamesGeneratorFactory:
        if not hasattr(cls, "_BirthNamesGeneratorFactory__factory"):
            cls.__factory = BirthNamesGeneratorFactoryImpl()
        return cls.__factory


MIN_NAME_LEN = 3
MAX_NAME_SIZE = 10
START_YEAR = 1960
YEARS_AMOUNT = 60
ROW_PER_YEAR = 20


class BirthNamesGeneratorFactoryImpl(BirthNamesGeneratorFactory):
    def _make(self) -> BirthNamesGenerator:
        string_generator = StringGeneratorFactory.make_lowercase_based(
            MIN_NAME_LEN, MAX_NAME_SIZE
        )
        return BirthNamesGenerator(
            string_generator, START_YEAR, YEARS_AMOUNT, ROW_PER_YEAR
        )
