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
server-side contracts the pieces share: the manifest and its capabilities, the
file store, the provider a host implements and the authoring tools agents
call. The bridge between the frame and its host page is browser code, so its
protocol is defined in ``@superset-oss/artifacts-sdk``. This package has no
implementation of the machinery itself, and depends only on pydantic.
"""

from superset_artifacts_sdk.authoring import (
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
from superset_artifacts_sdk.capabilities import Capability as Capability
from superset_artifacts_sdk.manifest import (
    ArtifactManifest as ArtifactManifest,
    Binding as Binding,
    DatasetSource as DatasetSource,
    EventDecl as EventDecl,
    MANIFEST_FILE as MANIFEST_FILE,
    MANIFEST_VERSION as MANIFEST_VERSION,
    ParameterSpec as ParameterSpec,
    SavedChartSource as SavedChartSource,
    SDK_VERSION as SDK_VERSION,
    SemanticViewSource as SemanticViewSource,
)
from superset_artifacts_sdk.provider import (
    ArtifactBuilder as ArtifactBuilder,
    ArtifactChecker as ArtifactChecker,
    ArtifactRef as ArtifactRef,
    ArtifactRuntimeProvider as ArtifactRuntimeProvider,
    ArtifactStoreSource as ArtifactStoreSource,
    BuildResult as BuildResult,
    CheckResult as CheckResult,
    Diagnostic as Diagnostic,
    FrameContext as FrameContext,
    FrameLink as FrameLink,
    FrameLinkMinter as FrameLinkMinter,
    FrameMode as FrameMode,
    FrameSources as FrameSources,
    VersionNotFoundError as VersionNotFoundError,
)
from superset_artifacts_sdk.registry import (
    artifacts_available as artifacts_available,
    clear_provider as clear_provider,
    get_provider as get_provider,
    ProviderAlreadyRegisteredError as ProviderAlreadyRegisteredError,
    register_provider as register_provider,
)
from superset_artifacts_sdk.store import (
    ArtifactStoreBackend as ArtifactStoreBackend,
    DRAFT_REF as DRAFT_REF,
    InvalidPathError as InvalidPathError,
    is_ref_name as is_ref_name,
    is_sha256_hex as is_sha256_hex,
    MAX_REF_NAME_LENGTH as MAX_REF_NAME_LENGTH,
    MissingObjectsError as MissingObjectsError,
    normalize_path as normalize_path,
    PUBLISHED_REF as PUBLISHED_REF,
    RefHistory as RefHistory,
    sha256_hex as sha256_hex,
    tree_hash as tree_hash,
    validate_tree as validate_tree,
)
