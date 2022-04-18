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
from typing import Any, Dict, Iterable

import pytest
from sqlalchemy import String

from tests.example_data.data_generator.base_generator import ExampleDataGenerator
from tests.example_data.data_generator.string_generator import StringGenerator
from tests.example_data.data_loading.base_data_loader import DataLoader
from tests.example_data.data_loading.data_definitions.types import (
    Table,
    TableMetaData,
    TableMetaDataFactory,
)

SINGLE_COLUMN_EXAMPLE_TABLE_NAME = "single_column_example"
COLUMN_NAME = "name"

COLUMN = {
    COLUMN_NAME: String(255),
}


@pytest.fixture(scope="session")
def load_single_column_example_table_data(
    single_column_example: Table, data_loader: DataLoader
):
    data_loader.load_table(single_column_example)
    yield
    data_loader.remove_table(single_column_example.table_name)


@pytest.fixture(scope="session")
def single_column_example(
    single_column_example_data: Iterable[Dict[Any, Any]]
) -> Table:
    return SingleColumnExampleTableFactory().make_table(single_column_example_data)


@pytest.fixture(scope="session")
def single_column_example_data(
    single_column_example_data_generator: ExampleDataGenerator,
) -> Iterable[Dict[Any, Any]]:
    return single_column_example_data_generator.generate()


@pytest.fixture(scope="session")
def single_column_example_data_generator(
    single_column_example_column_size: int,
    single_column_example_rows_amount: int,
) -> ExampleDataGenerator:
    string_generator = StringGenerator(
        string.ascii_lowercase,
        single_column_example_column_size,
        single_column_example_column_size,
    )
    return SingleColumnExampleDataGenerator(
        string_generator, single_column_example_rows_amount
    )


@pytest.fixture(scope="session")
def single_column_example_column_size() -> int:
    return 8


@pytest.fixture(scope="session")
def single_column_example_rows_amount() -> int:
    return 10


class SingleColumnExampleTableFactory(TableMetaDataFactory):
    def make(self) -> TableMetaData:
        return TableMetaData(SINGLE_COLUMN_EXAMPLE_TABLE_NAME, COLUMN.copy())


class SingleColumnExampleDataGenerator(ExampleDataGenerator):
    _string_generator: StringGenerator
    _rows_amount: int

    def __init__(self, names_generator: StringGenerator, rows_amount: int = 0) -> None:
        self._string_generator = names_generator
        self._rows_amount = rows_amount

    def set_rows_amount(self, rows_amount: int):
        assert rows_amount > -1
        self._rows_amount = rows_amount

    def generate(self) -> Iterable[Dict[Any, Any]]:
        for _ in range(self._rows_amount):
            yield {COLUMN_NAME: self._string_generator.generate()}
