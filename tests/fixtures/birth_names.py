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

from typing import Callable, TYPE_CHECKING

from pytest import fixture

from tests.example_data.data_generator.birth_names.birth_names_generator_factory import (
    BirthNamesGeneratorFactory,
)
from tests.example_data.data_loading.data_definitions.birth_names import (
    BirthNamesMetaDataFactory,
)

if TYPE_CHECKING:
    from tests.example_data.data_generator.birth_names.birth_names_generator import (
        BirthNamesGenerator,
    )
    from tests.example_data.data_loading.data_definitions.types import Table


@fixture(scope="session")
def birth_names_data_generator() -> BirthNamesGenerator:
    return BirthNamesGeneratorFactory.make()


@fixture(scope="session")
def birth_names_table_factory(
    birth_names_data_generator: BirthNamesGenerator,
    support_datetime_type: bool,
) -> Callable[[], Table]:
    def _birth_names_table_factory() -> Table:
        return BirthNamesMetaDataFactory(support_datetime_type).make_table(
            data=birth_names_data_generator.generate()
        )

    return _birth_names_table_factory
