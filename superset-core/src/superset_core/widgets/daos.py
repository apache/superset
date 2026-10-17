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

"""
Widget Data Access Object API for superset-core.

Provides widget-related DAO classes that will be replaced by host
implementations during initialization.

Usage:
    from superset_core.widgets.daos import WidgetDAO
"""

from superset_core.common.daos import BaseDAO
from superset_core.widgets.models import WidgetModel


class WidgetDAO(BaseDAO[WidgetModel]):
    """
    Abstract Widget DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality. Lookups go
    through the host's access filter, so callers only see widgets the current
    user may read.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"
