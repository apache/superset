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
"""Command that restores a chart to a previous version."""

from __future__ import annotations

from functools import partial

from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartNotFoundError,
    ChartUpdateFailedError,
)
from superset.commands.version_restore import BaseRestoreVersionCommand
from superset.models.slice import Slice
from superset.utils.decorators import on_error, transaction


class RestoreChartVersionCommand(BaseRestoreVersionCommand):
    """Revert a chart to a previous version.

    The restore is non-destructive: it produces a new version row (authored
    by the restoring user), so prior versions remain in the history and the
    change is itself reversible. ``@transaction`` wraps :meth:`run` so the
    commit that fires Continuum's ``after_flush`` hook — the one that writes
    the new version row — is bound to this command's lifecycle.
    """

    model_cls = Slice
    not_found_exc = ChartNotFoundError
    forbidden_exc = ChartForbiddenError

    @transaction(on_error=partial(on_error, reraise=ChartUpdateFailedError))
    def run(self) -> Slice:
        return self._do_restore()
