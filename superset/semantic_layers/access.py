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

"""Runtime availability of semantic layers, independent of user permissions."""

from superset.exceptions import SupersetException


class SemanticLayersDisabledError(SupersetException):
    """Semantic data is unavailable under the active feature decision."""

    status: int = 404
    message: str = "Semantic layers are not enabled."


def is_semantic_layers_enabled() -> bool:
    """Evaluate the host's semantic-layer feature decision on every call."""
    from superset import feature_flag_manager

    return feature_flag_manager.is_feature_enabled("SEMANTIC_LAYERS")
