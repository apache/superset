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
"""Tests for data_loading.py UUID extraction functionality."""

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import yaml


def test_get_dataset_config_from_yaml_extracts_uuid():
    """Test that UUID is extracted from dataset.yaml."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)
        dataset_yaml = example_dir / "dataset.yaml"
        dataset_yaml.write_text(
            yaml.dump(
                {
                    "table_name": "test_table",
                    "uuid": "12345678-1234-1234-1234-123456789012",
                    "schema": "public",
                }
            )
        )

        config = get_dataset_config_from_yaml(example_dir)

        assert config["uuid"] == "12345678-1234-1234-1234-123456789012"
        assert config["table_name"] == "test_table"
        assert config["schema"] == "public"


def test_get_dataset_config_from_yaml_without_uuid():
    """Test that missing UUID returns None."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)
        dataset_yaml = example_dir / "dataset.yaml"
        dataset_yaml.write_text(
            yaml.dump(
                {
                    "table_name": "test_table",
                    "schema": "public",
                }
            )
        )

        config = get_dataset_config_from_yaml(example_dir)

        assert config["uuid"] is None
        assert config["table_name"] == "test_table"


def test_get_dataset_config_from_yaml_no_file():
    """Test behavior when dataset.yaml doesn't exist."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)

        config = get_dataset_config_from_yaml(example_dir)

        assert config["uuid"] is None
        assert config["table_name"] is None
        assert config["schema"] is None


def test_get_dataset_config_from_yaml_treats_main_schema_as_none():
    """Test that SQLite's 'main' schema is treated as None."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)
        dataset_yaml = example_dir / "dataset.yaml"
        dataset_yaml.write_text(
            yaml.dump(
                {
                    "table_name": "test_table",
                    "schema": "main",  # SQLite default schema
                }
            )
        )

        config = get_dataset_config_from_yaml(example_dir)

        assert config["schema"] is None


def test_get_multi_dataset_config_extracts_uuid():
    """Test that UUID is extracted from datasets/{name}.yaml."""
    from superset.examples.data_loading import _get_multi_dataset_config

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)
        datasets_dir = example_dir / "datasets"
        datasets_dir.mkdir()
        dataset_yaml = datasets_dir / "test_dataset.yaml"
        dataset_yaml.write_text(
            yaml.dump(
                {
                    "table_name": "custom_table_name",
                    "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    "schema": "public",
                }
            )
        )

        data_file = example_dir / "data" / "test_dataset.parquet"
        config = _get_multi_dataset_config(example_dir, "test_dataset", data_file)

        assert config["uuid"] == "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        assert config["table_name"] == "custom_table_name"


def test_get_multi_dataset_config_without_yaml():
    """Test behavior when datasets/{name}.yaml doesn't exist."""
    from superset.examples.data_loading import _get_multi_dataset_config

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)
        data_file = example_dir / "data" / "test_dataset.parquet"

        config = _get_multi_dataset_config(example_dir, "test_dataset", data_file)

        assert config.get("uuid") is None
        assert config["table_name"] == "test_dataset"


def test_get_multi_dataset_config_treats_main_schema_as_none():
    """Test that SQLite's 'main' schema is treated as None in multi-dataset config."""
    from superset.examples.data_loading import _get_multi_dataset_config

    with TemporaryDirectory() as tmpdir:
        example_dir = Path(tmpdir)
        datasets_dir = example_dir / "datasets"
        datasets_dir.mkdir()
        dataset_yaml = datasets_dir / "test_dataset.yaml"
        dataset_yaml.write_text(
            yaml.dump(
                {
                    "table_name": "test_table",
                    "schema": "main",
                }
            )
        )

        data_file = example_dir / "data" / "test_dataset.parquet"
        config = _get_multi_dataset_config(example_dir, "test_dataset", data_file)

        assert config["schema"] is None


def test_discover_datasets_passes_uuid_to_loader():
    """Test that discover_datasets passes UUID from YAML to create_generic_loader."""
    from superset.examples.data_loading import discover_datasets

    with TemporaryDirectory() as tmpdir:
        examples_dir = Path(tmpdir)

        # Create a simple example with data.parquet and dataset.yaml
        example_dir = examples_dir / "test_example"
        example_dir.mkdir()
        (example_dir / "data.parquet").touch()
        (example_dir / "dataset.yaml").write_text(
            yaml.dump(
                {
                    "table_name": "test_table",
                    "uuid": "12345678-1234-1234-1234-123456789012",
                }
            )
        )

        with patch(
            "superset.examples.data_loading.get_examples_directory",
            return_value=examples_dir,
        ):
            with patch(
                "superset.examples.data_loading.create_generic_loader"
            ) as mock_create:
                mock_create.return_value = lambda: None

                discover_datasets()

                mock_create.assert_called_once()
                call_kwargs = mock_create.call_args[1]
                assert call_kwargs["uuid"] == "12345678-1234-1234-1234-123456789012"
