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

from typing import Dict, TYPE_CHECKING

from pytest import fixture

from ..consts import SIMULATOR_FIXTURE_SCOPE
from ..example_data import DataName
from ..example_data.persistance_simulatiion.domain_objects.builder.proxy_builder import (
    domain_objects_proxy_builder,
)

if TYPE_CHECKING:
    from ..example_data.persistance_simulatiion.domain_objects import (
        DomainObjectsBuilder,
    )
    from ..example_data.persistance_simulatiion.domain_objects.builder import (
        ExampleDataBasedBuilder,
    )

__all__ = ["proxy_domain_objects_builder", "example_data_builders"]


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def proxy_domain_objects_builder(
    example_data_builders: Dict[DataName, ExampleDataBasedBuilder]
) -> DomainObjectsBuilder:
    return domain_objects_proxy_builder(example_data_builders)


@fixture(scope=SIMULATOR_FIXTURE_SCOPE)
def example_data_builders(
    birth_names_builder: ExampleDataBasedBuilder,
) -> Dict[DataName, ExampleDataBasedBuilder]:
    return {DataName.BIRTH_NAMES: birth_names_builder}
