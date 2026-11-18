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
"""The extension's identity, and the ids and paths the host derives from it."""

from __future__ import annotations

# PLACEHOLDER: decide the publisher before the first release. The host derives
# every id from it (the widget type, the MCP tool and prompt names, the REST
# paths), so changing it later orphans every placed artifact widget. Its
# module form must not be a top-level package that exists already, such as
# ``superset``: the backend module ``<publisher>.artifacts`` would shadow it.
PUBLISHER = "superset-oss"
NAME = "artifacts"
EXTENSION_ID = f"{PUBLISHER}.{NAME}"

# How the host prefixes what an extension registers: widget types, MCP tools
# and prompts, and REST API ids.
ID_PREFIX = f"extensions.{PUBLISHER}.{NAME}."
WIDGET_TYPE_NAME = "artifact"
WIDGET_TYPE = f"{ID_PREFIX}{WIDGET_TYPE_NAME}"

# The extension's one tool beyond the SDK's authoring contract: uploads for a
# commit by hash, which the contract doesn't define yet.
ARTIFACT_UPLOAD_BLOBS = "artifact_upload_blobs"

# Where the host mounts the extension's REST APIs.
API_BASE_PATH = f"/extensions/{PUBLISHER}/{NAME}"
