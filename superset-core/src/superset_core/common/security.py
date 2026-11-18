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
Security checks for superset-core extensions.

An extension that serves its own resources through the public DAOs reads them
with the host's access filters already; this module answers what those
filters can't, such as who may change a resource.

Host implementations will replace these functions during initialization
with concrete implementations providing actual functionality.

Usage:
    from superset_core.common.security import is_editor
    from superset_core.widgets.daos import WidgetDAO

    widget = WidgetDAO.find_one_or_none(uuid=widget_uuid)
    if widget is not None and is_editor(widget):
        ...
"""

from superset_core.common.models import CoreModel


def is_editor(resource: CoreModel) -> bool:
    """
    Whether the current user may edit ``resource``.

    An admin may edit every resource; another user may edit those that name
    them as an editor, directly or through one of their roles or groups.
    Embedded guests never may.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.
    """
    raise NotImplementedError("Function will be replaced during initialization")
