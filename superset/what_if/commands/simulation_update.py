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
"""Update What-If Simulation command."""

from __future__ import annotations

import logging
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.daos.what_if_simulation import WhatIfSimulationDAO
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction
from superset.what_if.exceptions import (
    WhatIfSimulationForbiddenError,
    WhatIfSimulationInvalidError,
    WhatIfSimulationNameUniquenessError,
    WhatIfSimulationNotFoundError,
    WhatIfSimulationUpdateFailedError,
)
from superset.what_if.models import WhatIfSimulation

logger = logging.getLogger(__name__)


class UpdateWhatIfSimulationCommand(BaseCommand):
    """Command to update a What-If simulation."""

    def __init__(self, simulation_id: int, data: dict[str, Any]):
        self._simulation_id = simulation_id
        self._properties = data.copy()
        self._model: Optional[WhatIfSimulation] = None

    @transaction(on_error=partial(on_error, reraise=WhatIfSimulationUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        return WhatIfSimulationDAO.update(self._model, attributes=self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        # Fetch model
        self._model = WhatIfSimulationDAO.find_by_id(self._simulation_id)
        if not self._model:
            raise WhatIfSimulationNotFoundError()

        # Check ownership
        user_id = get_user_id()
        if self._model.user_id != user_id:
            raise WhatIfSimulationForbiddenError()

        # Validate name uniqueness if name is being updated
        name = self._properties.get("name")
        if name and name != self._model.name:
            if not WhatIfSimulationDAO.validate_name_uniqueness(
                name,
                self._model.dashboard_id,
                user_id,
                self._simulation_id,
            ):
                exceptions.append(WhatIfSimulationNameUniquenessError())

        if exceptions:
            raise WhatIfSimulationInvalidError(exceptions=exceptions)
