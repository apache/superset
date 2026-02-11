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
"""Tests for examples/utils.py - YAML config loading and content assembly."""

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

import yaml


def _create_example_tree(base_dir: Path) -> Path:
    """Create a minimal example directory tree under base_dir/superset/examples/.

    Returns the 'superset' directory (what files("superset") would return).
    """
    superset_dir = base_dir / "superset"
    examples_dir = superset_dir / "examples"

    # _shared configs
    shared_dir = examples_dir / "_shared"
    shared_dir.mkdir(parents=True)
    (shared_dir / "database.yaml").write_text(
        "database_name: examples\n"
        "sqlalchemy_uri: __SQLALCHEMY_EXAMPLES_URI__\n"
        "uuid: a2dc77af-e654-49bb-b321-40f6b559a1ee\n"
        "version: '1.0.0'\n"
    )
    (shared_dir / "metadata.yaml").write_text(
        "version: '1.0.0'\ntimestamp: '2020-12-11T22:52:56.534241+00:00'\n"
    )

    # A simple example with dataset.yaml
    example_dir = examples_dir / "test_example"
    example_dir.mkdir()
    (example_dir / "dataset.yaml").write_text(
        yaml.dump(
            {
                "table_name": "test_table",
                "schema": "main",
                "uuid": "14f48794-ebfa-4f60-a26a-582c49132f1b",
                "database_uuid": "a2dc77af-e654-49bb-b321-40f6b559a1ee",
                "version": "1.0.0",
            }
        )
    )

    return superset_dir


def test_load_contents_builds_correct_import_structure():
    """load_contents() must produce the key structure ImportExamplesCommand expects.

    This tests the orchestration entry point: YAML files are discovered from
    the examples directory, the shared database config has its URI placeholder
    replaced, and the result has the correct key prefixes (databases/, datasets/,
    metadata.yaml).
    """
    from superset.examples.utils import load_contents

    with TemporaryDirectory() as tmpdir:
        superset_dir = _create_example_tree(Path(tmpdir))

        test_examples_uri = "sqlite:///path/to/examples.db"
        mock_app = MagicMock()
        mock_app.config = {"SQLALCHEMY_EXAMPLES_URI": test_examples_uri}

        with patch("superset.examples.utils.files", return_value=superset_dir):
            with patch("flask.current_app", mock_app):
                contents = load_contents()

        # Verify database config is present with placeholder replaced
        assert "databases/examples.yaml" in contents
        db_content = contents["databases/examples.yaml"]
        assert "__SQLALCHEMY_EXAMPLES_URI__" not in db_content
        assert test_examples_uri in db_content

        # Verify metadata is present
        assert "metadata.yaml" in contents

        # Verify dataset is discovered with correct key prefix
        assert "datasets/examples/test_example.yaml" in contents

        # Verify schema normalization happened (main -> null)
        dataset_content = contents["datasets/examples/test_example.yaml"]
        assert "schema: main" not in dataset_content


def test_load_contents_replaces_sqlalchemy_examples_uri_placeholder():
    """The __SQLALCHEMY_EXAMPLES_URI__ placeholder must be replaced with the real URI.

    If this placeholder is not replaced, the database import will fail with an
    invalid connection string, preventing all examples from loading.
    """
    from superset.examples.utils import _load_shared_configs

    with TemporaryDirectory() as tmpdir:
        superset_dir = _create_example_tree(Path(tmpdir))
        examples_root = Path("examples")

        test_uri = "postgresql://user:pass@host/db"
        mock_app = MagicMock()
        mock_app.config = {"SQLALCHEMY_EXAMPLES_URI": test_uri}

        with patch("superset.examples.utils.files", return_value=superset_dir):
            with patch("flask.current_app", mock_app):
                contents = _load_shared_configs(examples_root)

        assert "databases/examples.yaml" in contents
        assert test_uri in contents["databases/examples.yaml"]
        assert "__SQLALCHEMY_EXAMPLES_URI__" not in contents["databases/examples.yaml"]
