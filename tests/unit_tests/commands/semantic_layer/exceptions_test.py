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

from superset.commands.semantic_layer.exceptions import (
    SemanticLayerCreateFailedError,
    SemanticLayerDeleteFailedError,
    SemanticLayerForbiddenError,
    SemanticLayerInvalidError,
    SemanticLayerNotFoundError,
    SemanticLayerUpdateFailedError,
    SemanticViewForbiddenError,
    SemanticViewInvalidError,
    SemanticViewNotFoundError,
    SemanticViewUpdateFailedError,
)


def test_semantic_view_not_found_error() -> None:
    """Test SemanticViewNotFoundError has correct status and message."""
    error = SemanticViewNotFoundError()
    assert error.status == 404
    assert str(error.message) == "Semantic view does not exist"


def test_semantic_view_forbidden_error() -> None:
    """Test SemanticViewForbiddenError has correct message."""
    error = SemanticViewForbiddenError()
    assert str(error.message) == "Changing this semantic view is forbidden"


def test_semantic_view_invalid_error() -> None:
    """Test SemanticViewInvalidError has correct message."""
    error = SemanticViewInvalidError()
    assert str(error.message) == "Semantic view parameters are invalid."


def test_semantic_view_update_failed_error() -> None:
    """Test SemanticViewUpdateFailedError has correct message."""
    error = SemanticViewUpdateFailedError()
    assert str(error.message) == "Semantic view could not be updated."


def test_semantic_layer_not_found_error() -> None:
    """Test SemanticLayerNotFoundError has correct status and message."""
    error = SemanticLayerNotFoundError()
    assert error.status == 404
    assert str(error.message) == "Semantic layer does not exist"


def test_semantic_layer_forbidden_error() -> None:
    """Test SemanticLayerForbiddenError has correct message."""
    error = SemanticLayerForbiddenError()
    assert str(error.message) == "Changing this semantic layer is forbidden"


def test_semantic_layer_invalid_error() -> None:
    """Test SemanticLayerInvalidError has correct message."""
    error = SemanticLayerInvalidError()
    assert str(error.message) == "Semantic layer parameters are invalid."


def test_semantic_layer_create_failed_error() -> None:
    """Test SemanticLayerCreateFailedError has correct message."""
    error = SemanticLayerCreateFailedError()
    assert str(error.message) == "Semantic layer could not be created."


def test_semantic_layer_update_failed_error() -> None:
    """Test SemanticLayerUpdateFailedError has correct message."""
    error = SemanticLayerUpdateFailedError()
    assert str(error.message) == "Semantic layer could not be updated."


def test_semantic_layer_delete_failed_error() -> None:
    """Test SemanticLayerDeleteFailedError has correct message."""
    error = SemanticLayerDeleteFailedError()
    assert str(error.message) == "Semantic layer could not be deleted."
