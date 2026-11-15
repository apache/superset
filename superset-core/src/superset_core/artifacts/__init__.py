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

from superset_core.artifacts.authoring import (
    ArtifactBuildRequest as ArtifactBuildRequest,
    ArtifactCheckRequest as ArtifactCheckRequest,
    ArtifactCommitFilesRequest as ArtifactCommitFilesRequest,
    ArtifactCommitFilesResponse as ArtifactCommitFilesResponse,
    ArtifactCreateFileRequest as ArtifactCreateFileRequest,
    ArtifactCreateRequest as ArtifactCreateRequest,
    ArtifactCreateResponse as ArtifactCreateResponse,
    ArtifactDeleteFileRequest as ArtifactDeleteFileRequest,
    ArtifactHistoryRequest as ArtifactHistoryRequest,
    ArtifactInsertRequest as ArtifactInsertRequest,
    ArtifactManifestGetRequest as ArtifactManifestGetRequest,
    ArtifactManifestUpdateRequest as ArtifactManifestUpdateRequest,
    ArtifactMoveFileRequest as ArtifactMoveFileRequest,
    ArtifactRequestPublishRequest as ArtifactRequestPublishRequest,
    ArtifactRestoreRequest as ArtifactRestoreRequest,
    ArtifactScopedRequest as ArtifactScopedRequest,
    ArtifactSearchRequest as ArtifactSearchRequest,
    ArtifactStrReplaceRequest as ArtifactStrReplaceRequest,
    ArtifactViewRequest as ArtifactViewRequest,
    ArtifactWriteRequest as ArtifactWriteRequest,
    ArtifactWriteResponse as ArtifactWriteResponse,
    AuthoringErrorCode as AuthoringErrorCode,
    AuthoringErrorResponse as AuthoringErrorResponse,
    AuthoringRequest as AuthoringRequest,
    TOOL_REQUESTS as TOOL_REQUESTS,
)
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
from superset_core.artifacts.protocol import (
    PROTOCOL_NAME as PROTOCOL_NAME,
    PROTOCOL_VERSION as PROTOCOL_VERSION,
)
from superset_core.artifacts.provider import (
    ArtifactRef as ArtifactRef,
    ArtifactRuntimeProvider as ArtifactRuntimeProvider,
    artifacts_available as artifacts_available,
    BuildResult as BuildResult,
    CheckResult as CheckResult,
    clear_provider as clear_provider,
    Diagnostic as Diagnostic,
    FrameContext as FrameContext,
    FrameLink as FrameLink,
    get_provider as get_provider,
    ProviderAlreadyRegisteredError as ProviderAlreadyRegisteredError,
    register_provider as register_provider,
)
from superset_core.artifacts.store import (
    ArtifactStoreBackend as ArtifactStoreBackend,
    DRAFT_REF as DRAFT_REF,
    InvalidPathError as InvalidPathError,
    MissingObjectsError as MissingObjectsError,
    normalize_path as normalize_path,
    PUBLISHED_REF as PUBLISHED_REF,
    sha256_hex as sha256_hex,
    tree_hash as tree_hash,
    validate_tree as validate_tree,
)
