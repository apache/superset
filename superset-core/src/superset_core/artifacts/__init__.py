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
Superset Artifacts SDK: the public contracts for artifacts.

An artifact is a small app that an agent writes and places on a Canvas. Its
code is untrusted, so it runs only in a sandboxed frame, and it reaches
Superset data only through its host, as the viewer. This package defines the
contracts the pieces share: the manifest and its capabilities, the file store,
the provider a host implements, the authoring tools agents call and the bridge
protocol. It has no implementation of the machinery itself, and depends only
on pydantic.
"""

from superset_core.artifacts.capabilities import Capability as Capability
from superset_core.artifacts.manifest import (
    ArtifactManifest as ArtifactManifest,
    Binding as Binding,
    DatasetSource as DatasetSource,
    EventDecl as EventDecl,
    MANIFEST_FILE as MANIFEST_FILE,
    manifest_json_schema as manifest_json_schema,
    MANIFEST_VERSION as MANIFEST_VERSION,
    ParameterSpec as ParameterSpec,
    SavedChartSource as SavedChartSource,
    SemanticViewSource as SemanticViewSource,
    SnapshotProvenance as SnapshotProvenance,
)
