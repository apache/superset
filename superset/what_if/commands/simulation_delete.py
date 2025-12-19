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
"""Delete What-If Simulation command."""

from __future__ import annotations

import logging
from functools import partial

from superset.commands.base import BaseCommand
from superset.daos.what_if_simulation import WhatIfSimulationDAO
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction
from superset.what_if.exceptions import (
    WhatIfSimulationDeleteFailedError,
    WhatIfSimulationForbiddenError,
    WhatIfSimulationNotFoundError,
)
from superset.what_if.models import WhatIfSimulation

logger = logging.getLogger(__name__)


class DeleteWhatIfSimulationCommand(BaseCommand):
    """Command to delete What-If simulation(s)."""

    def __init__(self, simulation_ids: list[int]):
        self._simulation_ids = simulation_ids
        self._models: list[WhatIfSimulation] = []

    @transaction(on_error=partial(on_error, reraise=WhatIfSimulationDeleteFailedError))
    def run(self) -> None:
        self.validate()
        WhatIfSimulationDAO.delete(self._models)

    def validate(self) -> None:
        user_id = get_user_id()
        self._models = WhatIfSimulationDAO.find_by_ids(self._simulation_ids)

        if len(self._models) != len(self._simulation_ids):
            raise WhatIfSimulationNotFoundError()

        # Check ownership of all simulations
        for model in self._models:
            if model.user_id != user_id:
                raise WhatIfSimulationForbiddenError()
