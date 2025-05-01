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

from collections.abc import Iterable
from datetime import datetime
from random import choice, randint
from typing import Any, TYPE_CHECKING

from tests.consts.birth_names import (
    BOY,
    DS,
    GENDER,
    GIRL,
    NAME,
    NUM,
    NUM_BOYS,
    NUM_GIRLS,
    STATE,
)
from tests.consts.us_states import US_STATES
from tests.example_data.data_generator.base_generator import ExampleDataGenerator

if TYPE_CHECKING:
    from tests.example_data.data_generator.string_generator import StringGenerator


class BirthNamesGenerator(ExampleDataGenerator):
    _names_generator: StringGenerator
    _start_year: int
    _until_not_include_year: int
    _rows_per_year: int

    def __init__(
        self,
        names_generator: StringGenerator,
        start_year: int,
        years_amount: int,
        rows_per_year: int,
    ) -> None:
        assert start_year > -1
        assert years_amount > 0
        self._names_generator = names_generator
        self._start_year = start_year
        self._until_not_include_year = start_year + years_amount
        self._rows_per_year = rows_per_year

    def generate(self) -> Iterable[dict[Any, Any]]:
        for year in range(self._start_year, self._until_not_include_year):
            ds = self._make_year(year)
            for _ in range(self._rows_per_year):
                yield self.generate_row(ds)

    def _make_year(self, year: int):
        return datetime(year, 1, 1, 0, 0, 0)

    def generate_row(self, dt: datetime) -> dict[Any, Any]:
        gender = choice([BOY, GIRL])  # noqa: S311
        num = randint(1, 100000)  # noqa: S311
        return {
            DS: dt,
            GENDER: gender,
            NAME: self._names_generator.generate(),
            NUM: num,
            STATE: choice(US_STATES),  # noqa: S311
            NUM_BOYS: num if gender == BOY else 0,
            NUM_GIRLS: num if gender == GIRL else 0,
        }
