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
import logging
from typing import Any, Dict, List

from superset.dao.base import BaseDAO
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.embedded_dashboard import EmbeddedDashboard

logger = logging.getLogger(__name__)


class EmbeddedDAO(BaseDAO):
    model_cls = EmbeddedDashboard
    # There isn't really a regular scenario where we would rather get Embedded by id
    id_column_name = "uuid"

    @staticmethod
    def upsert(dashboard: Dashboard, allowed_domains: List[str]) -> EmbeddedDashboard:
        """
        Sets up a dashboard to be embeddable.
        Upsert is used to preserve the embedded_dashboard uuid across updates.
        """
        embedded: EmbeddedDashboard = (
            dashboard.embedded[0] if dashboard.embedded else EmbeddedDashboard()
        )
        embedded.allow_domain_list = ",".join(allowed_domains)
        dashboard.embedded = [embedded]
        db.session.commit()
        return embedded

    @classmethod
    def create(cls, properties: Dict[str, Any], commit: bool = True) -> Any:
        """
        Use EmbeddedDAO.upsert() instead.
        At least, until we are ok with more than one embedded instance per dashboard.
        """
        raise NotImplementedError("Use EmbeddedDAO.upsert() instead.")
