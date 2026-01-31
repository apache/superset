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
"""Tests for the data_loading module, specifically UUID extraction from YAML."""

from pathlib import Path


def test_get_dataset_config_from_yaml_extracts_uuid(tmp_path: Path) -> None:
    """Test that get_dataset_config_from_yaml extracts UUID from YAML."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    # Create a temporary dataset.yaml with UUID
    yaml_content = """
table_name: birth_names
schema: public
data_file: data.parquet
uuid: 14f48794-ebfa-4f60-a26a-582c49132f1b
"""
    dataset_yaml = tmp_path / "dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    result = get_dataset_config_from_yaml(tmp_path)

    assert result["uuid"] == "14f48794-ebfa-4f60-a26a-582c49132f1b"
    assert result["table_name"] == "birth_names"
    assert result["schema"] == "public"


def test_get_dataset_config_from_yaml_handles_missing_uuid(tmp_path: Path) -> None:
    """Test that missing UUID returns None."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    # Create a temporary dataset.yaml without UUID
    yaml_content = """
table_name: birth_names
schema: public
"""
    dataset_yaml = tmp_path / "dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    result = get_dataset_config_from_yaml(tmp_path)

    assert result["uuid"] is None
    assert result["table_name"] == "birth_names"


def test_get_dataset_config_from_yaml_handles_missing_file(tmp_path: Path) -> None:
    """Test that missing dataset.yaml returns None for all fields."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    result = get_dataset_config_from_yaml(tmp_path)

    assert result["uuid"] is None
    assert result["table_name"] is None
    assert result["schema"] is None


def test_get_dataset_config_from_yaml_schema_main(tmp_path: Path) -> None:
    """Test that schema: 'main' (SQLite default) becomes None."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    yaml_content = """
table_name: test_table
schema: main
uuid: test-uuid-1234
"""
    dataset_yaml = tmp_path / "dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    result = get_dataset_config_from_yaml(tmp_path)

    # SQLite's 'main' schema should be treated as None
    assert result["schema"] is None
    assert result["table_name"] == "test_table"
    assert result["uuid"] == "test-uuid-1234"


def test_get_dataset_config_from_yaml_empty_file(tmp_path: Path) -> None:
    """Test that empty YAML file returns None for all fields."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    # Create empty dataset.yaml
    dataset_yaml = tmp_path / "dataset.yaml"
    dataset_yaml.write_text("")

    result = get_dataset_config_from_yaml(tmp_path)

    assert result["uuid"] is None
    assert result["table_name"] is None
    assert result["schema"] is None
    assert result["data_file"] is None


def test_get_dataset_config_from_yaml_invalid_yaml(tmp_path: Path) -> None:
    """Test that invalid YAML returns defaults (exception is caught internally)."""
    from superset.examples.data_loading import get_dataset_config_from_yaml

    # Create invalid YAML (unclosed bracket)
    dataset_yaml = tmp_path / "dataset.yaml"
    dataset_yaml.write_text("table_name: [unclosed")

    # Function catches exceptions and returns defaults
    result = get_dataset_config_from_yaml(tmp_path)

    assert result["uuid"] is None
    assert result["table_name"] is None
    assert result["schema"] is None
    assert result["data_file"] is None


def test_get_multi_dataset_config_extracts_uuid(tmp_path: Path) -> None:
    """Test that _get_multi_dataset_config extracts UUID from datasets/*.yaml."""
    from superset.examples.data_loading import _get_multi_dataset_config

    # Create datasets directory and YAML file
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()

    yaml_content = """
table_name: cleaned_sales_data
schema: null
uuid: e8623bb9-5e00-f531-506a-19607f5f8005
"""
    dataset_yaml = datasets_dir / "cleaned_sales_data.yaml"
    dataset_yaml.write_text(yaml_content)

    data_file = tmp_path / "data" / "cleaned_sales_data.parquet"

    result = _get_multi_dataset_config(tmp_path, "cleaned_sales_data", data_file)

    assert result["uuid"] == "e8623bb9-5e00-f531-506a-19607f5f8005"
    assert result["table_name"] == "cleaned_sales_data"


def test_get_multi_dataset_config_handles_missing_uuid(tmp_path: Path) -> None:
    """Test that missing UUID in multi-dataset config returns None."""
    from superset.examples.data_loading import _get_multi_dataset_config

    # Create datasets directory and YAML file without UUID
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()

    yaml_content = """
table_name: my_dataset
schema: null
"""
    dataset_yaml = datasets_dir / "my_dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    data_file = tmp_path / "data" / "my_dataset.parquet"

    result = _get_multi_dataset_config(tmp_path, "my_dataset", data_file)

    assert result["uuid"] is None
    assert result["table_name"] == "my_dataset"


def test_get_multi_dataset_config_handles_missing_file(tmp_path: Path) -> None:
    """Test that missing datasets/*.yaml returns None for UUID."""
    from superset.examples.data_loading import _get_multi_dataset_config

    data_file = tmp_path / "data" / "my_dataset.parquet"

    result = _get_multi_dataset_config(tmp_path, "my_dataset", data_file)

    assert result["uuid"] is None
    # Falls back to dataset_name when no YAML
    assert result["table_name"] == "my_dataset"


def test_get_multi_dataset_config_schema_main(tmp_path: Path) -> None:
    """Test that schema: 'main' becomes None in multi-dataset config."""
    from superset.examples.data_loading import _get_multi_dataset_config

    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()

    yaml_content = """
table_name: my_dataset
schema: main
uuid: test-uuid-1234
"""
    dataset_yaml = datasets_dir / "my_dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    data_file = tmp_path / "data" / "my_dataset.parquet"

    result = _get_multi_dataset_config(tmp_path, "my_dataset", data_file)

    # SQLite's 'main' schema should be treated as None
    assert result["schema"] is None
    assert result["uuid"] == "test-uuid-1234"


def test_get_multi_dataset_config_missing_table_name(tmp_path: Path) -> None:
    """Test that missing table_name falls back to dataset_name."""
    from superset.examples.data_loading import _get_multi_dataset_config

    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()

    # YAML without table_name
    yaml_content = """
schema: public
uuid: test-uuid-5678
"""
    dataset_yaml = datasets_dir / "my_dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    data_file = tmp_path / "data" / "my_dataset.parquet"

    result = _get_multi_dataset_config(tmp_path, "my_dataset", data_file)

    # Falls back to dataset_name when table_name not in YAML
    assert result["table_name"] == "my_dataset"
    assert result["uuid"] == "test-uuid-5678"


def test_get_multi_dataset_config_data_file_override(tmp_path: Path) -> None:
    """Test that explicit data_file in YAML overrides the default data file."""
    from superset.examples.data_loading import _get_multi_dataset_config

    # Create datasets directory and YAML file with explicit data_file
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()

    # Create data directory and the explicit data file
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    explicit_file = data_dir / "custom_data.parquet"
    explicit_file.write_bytes(b"fake parquet")

    yaml_content = """
table_name: my_dataset
schema: public
uuid: 14f48794-ebfa-4f60-a26a-582c49132f1b
data_file: custom_data.parquet
"""
    dataset_yaml = datasets_dir / "my_dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    # Default data file (would be used if no override)
    default_data_file = data_dir / "my_dataset.parquet"

    result = _get_multi_dataset_config(tmp_path, "my_dataset", default_data_file)

    # Should use the explicit data_file from YAML
    assert result["data_file"] == explicit_file
    assert result["table_name"] == "my_dataset"
    assert result["uuid"] == "14f48794-ebfa-4f60-a26a-582c49132f1b"


def test_get_multi_dataset_config_data_file_missing(tmp_path: Path) -> None:
    """Test that missing explicit data_file keeps the default data file."""
    from superset.examples.data_loading import _get_multi_dataset_config

    # Create datasets directory and YAML file with non-existent data_file
    datasets_dir = tmp_path / "datasets"
    datasets_dir.mkdir()

    # Create data directory but NOT the explicit file
    data_dir = tmp_path / "data"
    data_dir.mkdir()

    yaml_content = """
table_name: my_dataset
schema: public
uuid: 14f48794-ebfa-4f60-a26a-582c49132f1b
data_file: nonexistent.parquet
"""
    dataset_yaml = datasets_dir / "my_dataset.yaml"
    dataset_yaml.write_text(yaml_content)

    # Default data file passed to the function
    default_data_file = data_dir / "my_dataset.parquet"

    result = _get_multi_dataset_config(tmp_path, "my_dataset", default_data_file)

    # Should keep the default data_file since explicit one doesn't exist
    assert result["data_file"] == default_data_file
    assert result["uuid"] == "14f48794-ebfa-4f60-a26a-582c49132f1b"
