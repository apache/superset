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
"""Command that restores a dataset (and its columns/metrics) to a
previous version."""

from __future__ import annotations

from functools import partial

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
    DatasetUpdateFailedError,
)
from superset.commands.version_restore import BaseRestoreVersionCommand
from superset.connectors.sqla.models import SqlaTable
from superset.utils.decorators import on_error, transaction


class RestoreDatasetVersionCommand(BaseRestoreVersionCommand):
    """Revert a dataset (and its columns + metrics) to a previous version.
    See
    :class:`superset.commands.chart.restore_version.RestoreChartVersionCommand`
    for the general contract.
    """

    model_cls = SqlaTable
    not_found_exc = DatasetNotFoundError
    forbidden_exc = DatasetForbiddenError

    @transaction(on_error=partial(on_error, reraise=DatasetUpdateFailedError))
    def run(self) -> SqlaTable:
        return self._do_restore()
