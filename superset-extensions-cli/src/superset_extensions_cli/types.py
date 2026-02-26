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

from typing import TypedDict


class ExtensionNames(TypedDict):
    """Type definition for extension name variants following platform conventions."""

    # Publisher namespace (e.g., "my-org")
    publisher: str

    # Technical extension name (e.g., "dashboard-widgets")
    name: str

    # Human-readable display name (e.g., "Dashboard Widgets")
    display_name: str

    # Composite extension ID - publisher.name (e.g., "my-org.dashboard-widgets")
    id: str

    # NPM package name - @publisher/name (e.g., "@my-org/dashboard-widgets")
    npm_name: str

    # Module Federation library - publisherCamel_nameCamel (e.g., "myOrg_dashboardWidgets")
    mf_name: str

    # Backend package name with hyphens for distribution (e.g., "my_org-dashboard_widgets")
    backend_package: str

    # Full backend import path (e.g., "superset_extensions.my_org.dashboard_widgets")
    backend_path: str

    # Backend entry point (e.g., "superset_extensions.my_org.dashboard_widgets.entrypoint")
    backend_entry: str
