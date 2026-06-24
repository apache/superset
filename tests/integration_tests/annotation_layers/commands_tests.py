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
from unittest.mock import patch

import pytest
import yaml

from superset import db, security_manager
from superset.commands.annotation_layer.exceptions import AnnotationLayerNotFoundError
from superset.commands.annotation_layer.export import ExportAnnotationLayersCommand
from superset.commands.annotation_layer.importers.v1 import (
    ImportAnnotationLayersCommand,
)
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.models.annotations import Annotation, AnnotationLayer
from superset.utils import json
from tests.integration_tests.annotation_layers.fixtures import (
    create_annotation_layers,  # noqa: F401
)
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.importexport import (
    annotation_layer_config,
    annotation_layer_metadata_config,
)


class TestExportAnnotationLayersCommand(SupersetTestCase):
    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_annotation_layers")
    def test_export_annotation_layer_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        layer = (
            db.session.query(AnnotationLayer)
            .filter_by(name="layer_with_annotations")
            .one()
        )
        command = ExportAnnotationLayersCommand([layer.id])
        contents = dict(command.run())

        expected_keys = [
            "metadata.yaml",
            "annotation_layers/layer_with_annotations.yaml",
        ]
        assert expected_keys == list(contents.keys())

        metadata = yaml.safe_load(contents["metadata.yaml"]())
        assert metadata["version"] == "1.0.0"
        assert metadata["type"] == "AnnotationLayer"
        assert "timestamp" in metadata

        layer_data = yaml.safe_load(
            contents["annotation_layers/layer_with_annotations.yaml"]()
        )
        assert layer_data["name"] == "layer_with_annotations"
        assert layer_data["version"] == "1.0.0"
        assert len(layer_data["annotation"]) == 5

        # Verify annotation fields
        annotation = layer_data["annotation"][0]
        assert "short_descr" in annotation
        assert "long_descr" in annotation
        assert "start_dttm" in annotation
        assert "end_dttm" in annotation
        assert "uuid" in annotation
        assert "json_metadata" in annotation

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command_invalid_id(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        command = ExportAnnotationLayersCommand([-1])
        contents = command.run()
        with self.assertRaises(AnnotationLayerNotFoundError):  # noqa: PT027
            next(contents)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_annotation_layers")
    def test_export_annotation_layer_command_key_order(self, mock_g):
        """Test that the keys in the YAML have the same order as export_fields"""
        mock_g.user = security_manager.find_user("admin")

        layer = (
            db.session.query(AnnotationLayer)
            .filter_by(name="layer_with_annotations")
            .one()
        )
        command = ExportAnnotationLayersCommand([layer.id])
        contents = dict(command.run())

        layer_data = yaml.safe_load(
            contents["annotation_layers/layer_with_annotations.yaml"]()
        )
        assert list(layer_data.keys()) == [
            "name",
            "descr",
            "uuid",
            "annotation",
            "version",
        ]

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_annotation_layers")
    def test_export_annotation_layer_without_annotations(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        layer = db.session.query(AnnotationLayer).filter_by(name="name0").one()
        command = ExportAnnotationLayersCommand([layer.id])
        contents = dict(command.run())

        layer_data = yaml.safe_load(contents["annotation_layers/name0.yaml"]())
        assert layer_data["name"] == "name0"
        assert layer_data["annotation"] == []

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_annotation_layers")
    def test_export_annotation_layer_datetime_format(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        layer = (
            db.session.query(AnnotationLayer)
            .filter_by(name="layer_with_annotations")
            .one()
        )
        command = ExportAnnotationLayersCommand([layer.id])
        contents = dict(command.run())

        layer_data = yaml.safe_load(
            contents["annotation_layers/layer_with_annotations.yaml"]()
        )
        for annotation in layer_data["annotation"]:
            # datetime fields should be strings (ISO format), not datetime objects
            if annotation["start_dttm"] is not None:
                assert isinstance(annotation["start_dttm"], str)
            if annotation["end_dttm"] is not None:
                assert isinstance(annotation["end_dttm"], str)


class TestImportAnnotationLayersCommand(SupersetTestCase):
    def test_import_v1_annotation_layer(self) -> None:
        contents = {
            "metadata.yaml": yaml.safe_dump(annotation_layer_metadata_config),
            "annotation_layers/imported_layer.yaml": yaml.safe_dump(
                annotation_layer_config
            ),
        }
        command = ImportAnnotationLayersCommand(contents)
        command.run()

        layer = (
            db.session.query(AnnotationLayer)
            .filter_by(uuid=annotation_layer_config["uuid"])
            .one()
        )
        assert layer.name == "imported_layer"
        assert layer.descr == "A test annotation layer"

        annotations = (
            db.session.query(Annotation)
            .filter_by(layer_id=layer.id)
            .order_by(Annotation.short_descr)
            .all()
        )
        assert len(annotations) == 2
        assert annotations[0].short_descr == "annotation 1"
        assert annotations[0].long_descr == "First test annotation"
        assert annotations[0].json_metadata == json.dumps(
            {"color": "red", "opacity": 0.5}
        )
        assert annotations[1].short_descr == "annotation 2"
        assert annotations[1].json_metadata is None

        # Cleanup
        for ann in annotations:
            db.session.delete(ann)
        db.session.delete(layer)
        db.session.commit()

    def test_import_v1_annotation_layer_multiple(self) -> None:
        contents = {
            "metadata.yaml": yaml.safe_dump(annotation_layer_metadata_config),
            "annotation_layers/imported_layer.yaml": yaml.safe_dump(
                annotation_layer_config
            ),
        }
        command = ImportAnnotationLayersCommand(contents, overwrite=True)
        command.run()
        command.run()

        layers = (
            db.session.query(AnnotationLayer)
            .filter_by(uuid=annotation_layer_config["uuid"])
            .all()
        )
        assert len(layers) == 1

        annotations = (
            db.session.query(Annotation).filter_by(layer_id=layers[0].id).all()
        )

        # Cleanup
        for ann in annotations:
            db.session.delete(ann)
        db.session.delete(layers[0])
        db.session.commit()

    def test_import_v1_annotation_layer_overwrite_updates(self) -> None:
        contents = {
            "metadata.yaml": yaml.safe_dump(annotation_layer_metadata_config),
            "annotation_layers/imported_layer.yaml": yaml.safe_dump(
                annotation_layer_config
            ),
        }
        command = ImportAnnotationLayersCommand(contents, overwrite=True)
        command.run()

        # Import again with updated description
        updated_config = annotation_layer_config.copy()
        updated_config["descr"] = "Updated description"
        contents_updated = {
            "metadata.yaml": yaml.safe_dump(annotation_layer_metadata_config),
            "annotation_layers/imported_layer.yaml": yaml.safe_dump(updated_config),
        }
        command = ImportAnnotationLayersCommand(contents_updated, overwrite=True)
        command.run()

        layer = (
            db.session.query(AnnotationLayer)
            .filter_by(uuid=annotation_layer_config["uuid"])
            .one()
        )
        assert layer.descr == "Updated description"

        annotations = db.session.query(Annotation).filter_by(layer_id=layer.id).all()
        for ann in annotations:
            db.session.delete(ann)
        db.session.delete(layer)
        db.session.commit()

    def test_import_v1_annotation_layer_validation(self) -> None:
        # metadata.yaml must be present
        contents = {
            "annotation_layers/imported_layer.yaml": yaml.safe_dump(
                annotation_layer_config
            ),
        }
        command = ImportAnnotationLayersCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Missing metadata.yaml"

        # version should be 1.0.0
        contents["metadata.yaml"] = yaml.safe_dump(
            {
                "version": "2.0.0",
                "type": "AnnotationLayer",
                "timestamp": "2024-01-01T00:00:00.000000+00:00",
            }
        )
        command = ImportAnnotationLayersCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

        # type should be AnnotationLayer
        contents["metadata.yaml"] = yaml.safe_dump(
            {
                "version": "1.0.0",
                "type": "Slice",
                "timestamp": "2024-01-01T00:00:00.000000+00:00",
            }
        )
        command = ImportAnnotationLayersCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value).startswith("Error importing annotation_layer")
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to AnnotationLayer."]}
        }

        # must also validate annotation layer configs
        broken_config = annotation_layer_config.copy()
        del broken_config["name"]
        contents["metadata.yaml"] = yaml.safe_dump(annotation_layer_metadata_config)
        contents["annotation_layers/imported_layer.yaml"] = yaml.safe_dump(
            broken_config
        )
        command = ImportAnnotationLayersCommand(contents)
        with pytest.raises(CommandInvalidError) as excinfo:
            command.run()
        assert str(excinfo.value).startswith("Error importing annotation_layer")
        assert excinfo.value.normalized_messages() == {
            "annotation_layers/imported_layer.yaml": {
                "name": ["Missing data for required field."],
            }
        }

    def test_import_v1_annotation_layer_no_annotations(self) -> None:
        config_no_annotations = {
            "name": "empty_layer",
            "descr": "Layer with no annotations",
            "uuid": "c3d4e5f6-a7b8-9012-cdef-234567890abc",
            "version": "1.0.0",
            "annotation": [],
        }
        contents = {
            "metadata.yaml": yaml.safe_dump(annotation_layer_metadata_config),
            "annotation_layers/empty_layer.yaml": yaml.safe_dump(config_no_annotations),
        }
        command = ImportAnnotationLayersCommand(contents)
        command.run()

        layer = (
            db.session.query(AnnotationLayer)
            .filter_by(uuid=config_no_annotations["uuid"])
            .one()
        )
        assert layer.name == "empty_layer"
        annotations = db.session.query(Annotation).filter_by(layer_id=layer.id).all()
        assert len(annotations) == 0

        db.session.delete(layer)
        db.session.commit()

    def test_import_v1_annotation_layer_json_metadata_dict(self) -> None:
        config = {
            "name": "json_meta_layer",
            "descr": "",
            "uuid": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
            "version": "1.0.0",
            "annotation": [
                {
                    "short_descr": "with json metadata",
                    "long_descr": "",
                    "start_dttm": "2024-01-01T00:00:00",
                    "end_dttm": "2024-12-31T00:00:00",
                    "json_metadata": {"key": "value", "nested": {"a": 1}},
                    "uuid": "e5f6a7b8-c9d0-1234-ef56-7890abcdef01",
                },
            ],
        }
        contents = {
            "metadata.yaml": yaml.safe_dump(annotation_layer_metadata_config),
            "annotation_layers/json_meta_layer.yaml": yaml.safe_dump(config),
        }
        command = ImportAnnotationLayersCommand(contents)
        command.run()

        layer = db.session.query(AnnotationLayer).filter_by(uuid=config["uuid"]).one()
        annotation = db.session.query(Annotation).filter_by(layer_id=layer.id).one()
        # json_metadata should be stored as a JSON string in the database
        assert isinstance(annotation.json_metadata, str)
        assert json.loads(annotation.json_metadata) == {
            "key": "value",
            "nested": {"a": 1},
        }

        db.session.delete(annotation)
        db.session.delete(layer)
        db.session.commit()
