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
ships with marshmallow-sqlalchemy >= 1.5.0. These tests confirm that
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


@pytest.mark.skipif(
    tuple(int(p) for p in version("marshmallow").split(".")[:1]) < (4,),
    reason="FAB _init_fields KeyError only occurs on marshmallow >= 4",
)
def test_fab_field_stubbing_is_single_pass() -> None:
    """Regression: FAB compat must stub missing fields in one pass per instance.

    Flask-AppBuilder mints a fresh schema class on every call and marshmallow
    rebuilds ``declared_fields`` for every instance, so any approach that re-runs
    ``_init_fields`` on KeyError (a retry loop) re-pays its cost on every single
    instantiation. Under coverage tracing that blew the unit-test job past its
    timeout. The patch must instead stub the undeclared FAB names before the
    original runs, so ``_init_fields`` executes exactly once per instance.
    """
    import marshmallow as mm

    from superset.marshmallow_compatibility import (
        patch_marshmallow_for_flask_appbuilder,
    )

    # Count invocations of the underlying (pre-patch) _init_fields, then patch.
    base_init_fields = mm.Schema._init_fields
    calls = {"n": 0}

    def counting(self: mm.Schema) -> object:
        calls["n"] += 1
        return base_init_fields(self)

    mm.Schema._init_fields = counting
    try:
        patch_marshmallow_for_flask_appbuilder()

        # FAB-style schema: Meta.fields references undeclared relationship names,
        # which marshmallow 4.x rejects with KeyError.
        class FabStyleSchema(mm.Schema):
            a = mm.fields.String()

            class Meta:
                fields = ("a", "related_model", "owner", "parent_id")

        calls["n"] = 0
        for _ in range(50):
            FabStyleSchema()
        # Exactly one underlying _init_fields per instance — no retry blowup.
        assert calls["n"] == 50, (
            f"expected 50 _init_fields calls for 50 instances, got {calls['n']} "
            "— single-pass stubbing regressed into a retry loop"
        )

        # The undeclared FAB names resolve to Raw stubs in the built field set.
        instance = FabStyleSchema()
        assert isinstance(instance.fields["related_model"], mm.fields.Raw)
    finally:
        mm.Schema._init_fields = base_init_fields


def test_marshmallow_sqlalchemy_version() -> None:
    """Regression: marshmallow-sqlalchemy >= 1.5.0 is required.

    marshmallow 4.x needs marshmallow-sqlalchemy >= 1.4.x, but 1.4.1/1.4.2 carry
    a memory regression (issue #665) that exhausts memory in the test suite; only
    1.5.0 fixes it. This test ensures the installed version is recent enough.
    """
    import marshmallow_sqlalchemy  # noqa: F401  # import to confirm it's installed

    installed = version("marshmallow-sqlalchemy")
    parts = [int(x) for x in installed.split(".")[:3]]
    minimum = [1, 5, 0]
    assert parts >= minimum, (
        f"marshmallow-sqlalchemy {installed} is too old; need >= 1.5.0"
    )
