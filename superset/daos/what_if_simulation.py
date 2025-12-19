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
"""DAO for What-If Simulation persistence."""

from __future__ import annotations

import logging
from typing import Optional

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.utils.core import get_user_id
from superset.what_if.models import WhatIfSimulation

logger = logging.getLogger(__name__)


class WhatIfSimulationDAO(BaseDAO[WhatIfSimulation]):
    """Data access object for What-If Simulations."""

    @classmethod
    def find_by_dashboard_and_user(
        cls,
        dashboard_id: int,
        user_id: Optional[int] = None,
    ) -> list[WhatIfSimulation]:
        """
        Find all simulations for a dashboard owned by a specific user.

        :param dashboard_id: The dashboard ID
        :param user_id: The user ID (defaults to current user)
        :returns: List of simulations
        """
        if user_id is None:
            user_id = get_user_id()

        return (
            db.session.query(WhatIfSimulation)
            .filter(
                WhatIfSimulation.dashboard_id == dashboard_id,
                WhatIfSimulation.user_id == user_id,
            )
            .order_by(WhatIfSimulation.changed_on.desc())
            .all()
        )

    @classmethod
    def find_all_for_user(
        cls,
        user_id: Optional[int] = None,
    ) -> list[WhatIfSimulation]:
        """
        Find all simulations owned by a user across all dashboards.

        :param user_id: The user ID (defaults to current user)
        :returns: List of simulations
        """
        if user_id is None:
            user_id = get_user_id()

        return (
            db.session.query(WhatIfSimulation)
            .filter(WhatIfSimulation.user_id == user_id)
            .order_by(WhatIfSimulation.changed_on.desc())
            .all()
        )

    @classmethod
    def validate_name_uniqueness(
        cls,
        name: str,
        dashboard_id: int,
        user_id: int,
        simulation_id: Optional[int] = None,
    ) -> bool:
        """
        Validate if simulation name is unique for this dashboard/user combo.

        :param name: The simulation name
        :param dashboard_id: The dashboard ID
        :param user_id: The user ID
        :param simulation_id: Optional simulation ID (for updates)
        :returns: True if unique, False otherwise
        """
        query = db.session.query(WhatIfSimulation).filter(
            WhatIfSimulation.name == name,
            WhatIfSimulation.dashboard_id == dashboard_id,
            WhatIfSimulation.user_id == user_id,
        )
        if simulation_id:
            query = query.filter(WhatIfSimulation.id != simulation_id)
        return not db.session.query(query.exists()).scalar()
