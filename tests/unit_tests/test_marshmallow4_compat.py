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
"""Regression tests for marshmallow 4.x compatibility.

Marshmallow 4.x requires **kwargs on @validates-decorated methods and
ships with marshmallow-sqlalchemy >= 1.4.2. These tests confirm that
the codebase handles those requirements correctly.
"""
# pylint: disable=import-outside-toplevel

from importlib.metadata import version
from unittest.mock import MagicMock

import marshmallow
import pytest
from marshmallow import ValidationError


def test_validates_kwargs_database_schema() -> None:
    """Regression: marshmallow 4.x requires **kwargs on @validates methods.

    Without **kwargs on validate_file_extension, marshmallow 4.x passes extra
    keyword arguments to the validator and raises TypeError instead of
    ValidationError when validating an uploaded file with a bad extension.
    """
    from flask import Flask

    from superset.databases.schemas import BaseUploadFilePostSchemaMixin

    app = Flask(__name__)
    app.config["ALLOWED_EXTENSIONS"] = {"csv", "json", "parquet", "zip"}

    # Build a minimal schema that inherits the mixin so @validates fires
    class TestUploadSchema(BaseUploadFilePostSchemaMixin):
        file = marshmallow.fields.Raw()

    schema = TestUploadSchema()

    # Construct a mock FileStorage with a disallowed extension
    mock_file = MagicMock()
    mock_file.filename = "malware.exe"

    with app.app_context():
        with pytest.raises(ValidationError):
            # Must raise ValidationError, not TypeError
            schema.load({"file": mock_file})


def test_patch_marshmallow_for_flask_appbuilder_idempotent() -> None:
    """Regression: patch_marshmallow_for_flask_appbuilder must be idempotent.

    Calling the patch function more than once must not create nested wrappers.
    The _fab_patched sentinel on the patched method guards against re-patching.
    """
    import marshmallow as mm

    from superset.marshmallow_compatibility import (
        patch_marshmallow_for_flask_appbuilder,
    )

    # Capture the state of _init_fields before the first call
    original_init_fields = mm.Schema._init_fields

    patch_marshmallow_for_flask_appbuilder()
    after_first = mm.Schema._init_fields
    assert getattr(after_first, "_fab_patched", False), (
        "Expected _init_fields to be marked _fab_patched after first call"
    )

    patch_marshmallow_for_flask_appbuilder()
    after_second = mm.Schema._init_fields
    assert after_second is after_first, (
        "Expected _init_fields to be unchanged after second call (idempotent)"
    )

    # Restore original to avoid side-effects on other tests
    mm.Schema._init_fields = original_init_fields


def test_marshmallow_sqlalchemy_version() -> None:
    """Regression: marshmallow-sqlalchemy >= 1.4.2 is required for marshmallow 4.x.

    Versions before 1.4.2 are incompatible with marshmallow 4.x. This test
    ensures the installed version satisfies the minimum requirement.
    """
    import marshmallow_sqlalchemy  # noqa: F401  # import to confirm it's installed

    installed = version("marshmallow-sqlalchemy")
    parts = [int(x) for x in installed.split(".")[:3]]
    minimum = [1, 4, 2]
    assert parts >= minimum, (
        f"marshmallow-sqlalchemy {installed} is too old; need >= 1.4.2"
    )
