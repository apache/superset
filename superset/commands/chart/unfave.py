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
from functools import partial

<<<<<<< HEAD
from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
=======
from requests_cache import Optional

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
>>>>>>> origin/avenmaster
    ChartNotFoundError,
    ChartUnfaveError,
)
from superset.daos.chart import ChartDAO
<<<<<<< HEAD
=======
from superset.exceptions import SupersetSecurityException
>>>>>>> origin/avenmaster
from superset.models.slice import Slice
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DelFavoriteChartCommand(BaseCommand):
    def __init__(self, chart_id: int) -> None:
        self._chart_id = chart_id
<<<<<<< HEAD
        self._chart: Slice | None = None
=======
        self._chart: Optional[Slice] = None
>>>>>>> origin/avenmaster

    @transaction(on_error=partial(on_error, reraise=ChartUnfaveError))
    def run(self) -> None:
        self.validate()
<<<<<<< HEAD
        if self._chart:
            return ChartDAO.remove_favorite(self._chart)
=======
        return ChartDAO.remove_favorite(self._chart)
>>>>>>> origin/avenmaster

    def validate(self) -> None:
        chart = ChartDAO.find_by_id(self._chart_id)
        if not chart:
            raise ChartNotFoundError()

<<<<<<< HEAD
=======
        try:
            security_manager.raise_for_ownership(chart)
        except SupersetSecurityException as ex:
            raise ChartForbiddenError() from ex

>>>>>>> origin/avenmaster
        self._chart = chart
