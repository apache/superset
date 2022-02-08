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

from typing import Dict, TYPE_CHECKING

from .....common.logger_utils import log

if TYPE_CHECKING:
    from .... import DataName
    from ...scenario import Scenario
    from ..objects_wrapper import DomainObjectsWrapper
    from . import DomainObjectsBuilder, ExampleDataBasedBuilder


@log
def domain_objects_proxy_builder(
    example_data_builders: Dict[DataName, ExampleDataBasedBuilder]
) -> DomainObjectsBuilder:
    def _domain_objects_proxy_builder(scenario: Scenario) -> DomainObjectsWrapper:
        domain_objects_builder = example_data_builders.get(scenario.data_name)
        return domain_objects_builder(scenario)  # type: ignore

    return _domain_objects_proxy_builder
