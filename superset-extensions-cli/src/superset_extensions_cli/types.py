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

    # Extension name (e.g., "Hello World")
    name: str

    # Extension ID - kebab-case primary identifier and npm package name (e.g., "hello-world")
    id: str

    # Module Federation library - camelCase JS identifier (e.g., "helloWorld")
    mf_name: str

    # Backend package name - snake_case (e.g., "hello_world")
    backend_name: str

    # Full backend package (e.g., "superset_extensions.hello_world")
    backend_package: str

    # Backend entry point (e.g., "superset_extensions.hello_world.entrypoint")
    backend_entry: str
