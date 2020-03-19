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
from typing import Dict, List, Optional

from superset.charts.filters import ChartFilter
from superset.dao.base import BaseDAO
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

logger = logging.getLogger(__name__)


class ChartDAO(BaseDAO):
    model_cls = Slice
    base_filter = ChartFilter

    @staticmethod
    def get_dashboards_by_ids(dashboard_ids: List[int]) -> List[Dashboard]:
        return db.session.query(Dashboard).filter(Dashboard.id.in_(dashboard_ids)).all()

    @classmethod
    def create(cls, properties: Dict, commit=True) -> Optional[Slice]:
        return super().create(properties, commit=commit)

    @classmethod
    def update(cls, model: Slice, properties: Dict, commit=True) -> Optional[Slice]:
        return super().update(model, properties, commit=commit)

    @classmethod
    def delete(cls, model: Slice, commit=True):
        super().delete(model, commit=commit)
