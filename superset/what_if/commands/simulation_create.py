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
"""Create What-If Simulation command."""

from __future__ import annotations

import logging
from functools import partial
from typing import Any

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.daos.what_if_simulation import WhatIfSimulationDAO
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction
from superset.what_if.exceptions import (
    WhatIfSimulationCreateFailedError,
    WhatIfSimulationInvalidError,
    WhatIfSimulationNameUniquenessError,
)

logger = logging.getLogger(__name__)


class CreateWhatIfSimulationCommand(BaseCommand):
    """Command to create a new What-If simulation."""

    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=WhatIfSimulationCreateFailedError))
    def run(self) -> Model:
        self.validate()
        user_id = get_user_id()
        self._properties["user_id"] = user_id
        return WhatIfSimulationDAO.create(attributes=self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        name = self._properties.get("name", "")
        dashboard_id = self._properties.get("dashboard_id")
        user_id = get_user_id()

        # Validate name uniqueness for this dashboard/user
        if not WhatIfSimulationDAO.validate_name_uniqueness(
            name, dashboard_id, user_id
        ):
            exceptions.append(WhatIfSimulationNameUniquenessError())

        if exceptions:
            raise WhatIfSimulationInvalidError(exceptions=exceptions)
