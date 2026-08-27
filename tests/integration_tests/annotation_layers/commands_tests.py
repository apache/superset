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

from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
import yaml

from superset import db, security_manager
from superset.commands.annotation_layer.exceptions import AnnotationLayerNotFoundError
from superset.commands.annotation_layer.export import ExportAnnotationLayersCommand
from superset.commands.annotation_layer.importers import v1
from superset.commands.annotation_layer.importers.dispatcher import (
    ImportAnnotationLayersCommand,
)
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.models.annotations import Annotation, AnnotationLayer
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase


def _metadata_config(type_: str = "AnnotationLayer") -> dict[str, Any]:
    """Build a valid metadata.yaml payload for versioned imports."""
    return {
        "version": "1.0.0",
        "type": type_,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


def _materialize_export(exported: Any) -> dict[str, str]:
    """Materialize export iterators into a path-to-YAML-string dictionary."""
    return {path: factory() for path, factory in exported}


def _create_layer(name: str, descr: str | None = None) -> AnnotationLayer:
    """Create and persist an annotation layer for command tests."""
    layer = AnnotationLayer(name=name, descr=descr)
    db.session.add(layer)
    db.session.commit()
    return layer


def _create_annotation(
    layer: AnnotationLayer,
    short_descr: str,
    long_descr: str | None = None,
    start_dttm: datetime | None = None,
    end_dttm: datetime | None = None,
    json_metadata: str | None = None,
) -> Annotation:
    """Create and persist an annotation attached to a layer."""
    annotation = Annotation(
        layer=layer,
        short_descr=short_descr,
        long_descr=long_descr,
        start_dttm=start_dttm,
        end_dttm=end_dttm,
        json_metadata=json_metadata,
    )
    db.session.add(annotation)
    db.session.commit()
    return annotation


def _delete_layer_graph(layer: AnnotationLayer) -> None:
    """Delete a layer and all its annotations in FK-safe order."""
    db.session.query(Annotation).filter(Annotation.layer_id == layer.id).delete()
    db.session.delete(layer)
    db.session.commit()


def _purge_layer_by_uuid(layer_uuid: str) -> None:
    """Delete a layer by UUID if present, including all child annotations."""
    layer = db.session.query(AnnotationLayer).filter_by(uuid=layer_uuid).one_or_none()
    if layer:
        db.session.query(Annotation).filter(Annotation.layer_id == layer.id).delete()
        db.session.delete(layer)
        db.session.commit()


def _extract_layer_payload(contents: dict[str, str]) -> tuple[str, dict[str, Any]]:
    """Return the exported layer path and parsed payload from export contents."""
    layer_paths = [path for path in contents if path.startswith("annotation_layers/")]
    assert len(layer_paths) == 1
    path = layer_paths[0]
    return path, yaml.safe_load(contents[path])


class TestExportAnnotationLayersCommand(SupersetTestCase):
    """Integration tests for annotation layer export command behavior."""

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command(self, mock_g: Any) -> None:
        """Export one layer with child annotations and validate payload values."""
        mock_g.user = security_manager.find_user("admin")
        layer = _create_layer(name=f"export_layer_{uuid4()}", descr="layer descr")
        try:
            _create_annotation(
                layer,
                short_descr="valid-json-meta",
                long_descr="long",
                start_dttm=datetime(2024, 1, 1, 0, 0, 0),
                end_dttm=datetime(2024, 1, 2, 0, 0, 0),
                json_metadata='{"color": "blue"}',
            )
            _create_annotation(
                layer,
                short_descr="invalid-json-meta",
                json_metadata="not-json",
            )
            _create_annotation(
                layer,
                short_descr="empty-json-meta",
                json_metadata="",
            )

            contents = _materialize_export(
                ExportAnnotationLayersCommand([layer.id]).run()
            )
            assert "metadata.yaml" in contents

            metadata = yaml.safe_load(contents["metadata.yaml"])
            assert metadata["version"] == "1.0.0"
            assert metadata["type"] == "AnnotationLayer"

            export_path, payload = _extract_layer_payload(contents)
            assert export_path.endswith(".yaml")
            assert payload["name"] == layer.name
            assert payload["descr"] == layer.descr
            assert payload["uuid"] == str(layer.uuid)
            assert payload["version"] == "1.0.0"
            assert len(payload["annotation"]) == 3

            annotations = {item["short_descr"]: item for item in payload["annotation"]}
            assert annotations["valid-json-meta"]["json_metadata"] == {"color": "blue"}
            assert annotations["invalid-json-meta"]["json_metadata"] is None
            assert annotations["empty-json-meta"]["json_metadata"] is None
            assert annotations["valid-json-meta"]["start_dttm"] == "2024-01-01T00:00:00"
            assert annotations["valid-json-meta"]["end_dttm"] == "2024-01-02T00:00:00"
        finally:
            _delete_layer_graph(layer)

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command_invalid_layer(self, mock_g: Any) -> None:
        """Raise not-found when exporting a non-existent annotation layer id."""
        mock_g.user = security_manager.find_user("admin")
        command = ExportAnnotationLayersCommand([-1])
        with pytest.raises(AnnotationLayerNotFoundError):
            next(command.run())

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command_key_order(self, mock_g: Any) -> None:
        """Validate top-level key order in exported layer YAML payload."""
        mock_g.user = security_manager.find_user("admin")
        layer = _create_layer(name=f"key_order_{uuid4()}", descr="ordered")
        try:
            _create_annotation(layer, short_descr="one")
            contents = _materialize_export(
                ExportAnnotationLayersCommand([layer.id]).run()
            )
            _, payload = _extract_layer_payload(contents)
            assert list(payload.keys()) == [
                "name",
                "descr",
                "uuid",
                "annotation",
                "version",
            ]
        finally:
            _delete_layer_graph(layer)

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command_no_related(self, mock_g: Any) -> None:
        """Export a layer with no annotations and assert empty related collection."""
        mock_g.user = security_manager.find_user("admin")
        layer = _create_layer(name=f"no_related_{uuid4()}", descr="empty children")
        try:
            contents = _materialize_export(
                ExportAnnotationLayersCommand([layer.id]).run()
            )
            _, payload = _extract_layer_payload(contents)
            assert payload["name"] == layer.name
            assert payload["descr"] == layer.descr
            assert payload["annotation"] == []
        finally:
            _delete_layer_graph(layer)

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command_multiple_layers(self, mock_g: Any) -> None:
        """Export multiple layers and verify each payload has correct children."""
        mock_g.user = security_manager.find_user("admin")
        layer_one = _create_layer(name=f"layer_one_{uuid4()}", descr="first")
        layer_two = _create_layer(name=f"layer_two_{uuid4()}", descr="second")
        try:
            _create_annotation(layer_one, short_descr="a1")
            _create_annotation(layer_two, short_descr="b1")
            _create_annotation(layer_two, short_descr="b2")

            contents = _materialize_export(
                ExportAnnotationLayersCommand([layer_one.id, layer_two.id]).run()
            )
            layer_paths = [
                path for path in contents if path.startswith("annotation_layers/")
            ]
            assert len(layer_paths) == 2

            payloads = [yaml.safe_load(contents[path]) for path in layer_paths]
            by_uuid = {payload["uuid"]: payload for payload in payloads}
            assert len(by_uuid[str(layer_one.uuid)]["annotation"]) == 1
            assert len(by_uuid[str(layer_two.uuid)]["annotation"]) == 2
        finally:
            _delete_layer_graph(layer_one)
            _delete_layer_graph(layer_two)

    @patch("superset.security.manager.g")
    def test_export_annotation_layer_command_unicode_chars(self, mock_g: Any) -> None:
        """Export unicode content and verify YAML serialization is preserved."""
        mock_g.user = security_manager.find_user("admin")
        layer = _create_layer(name="中文图层", descr="Описание")
        try:
            _create_annotation(layer, short_descr="δοκιμή", long_descr="日本語テキスト")
            contents = _materialize_export(
                ExportAnnotationLayersCommand([layer.id]).run()
            )
            export_path, _ = _extract_layer_payload(contents)
            assert export_path.endswith(".yaml")
            yaml_content = contents[export_path]
            payload = yaml.safe_load(yaml_content)
            assert payload["name"] == "中文图层"
            assert payload["descr"] == "Описание"
            assert payload["annotation"][0]["short_descr"] == "δοκιμή"
            assert "name: 中文图层" in yaml_content
        finally:
            _delete_layer_graph(layer)


class TestImportAnnotationLayersCommand(SupersetTestCase):
    """Integration tests for annotation layer import command behavior."""

    def test_import_v1_annotation_layer(self) -> None:
        """Import one layer and nested annotations from a v1 bundle payload."""
        layer_uuid = str(uuid4())
        ann_one_uuid = str(uuid4())
        ann_two_uuid = str(uuid4())
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/imported_layer.yaml": yaml.safe_dump(
                {
                    "name": "imported-layer",
                    "descr": "imported descr",
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                    "annotation": [
                        {
                            "uuid": ann_one_uuid,
                            "short_descr": "a1",
                            "long_descr": "long-a1",
                            "start_dttm": "2024-01-01T00:00:00",
                            "end_dttm": "2024-01-01T12:00:00",
                            "json_metadata": {"label": "one"},
                        },
                        {
                            "uuid": ann_two_uuid,
                            "short_descr": "a2",
                            "long_descr": None,
                            "start_dttm": None,
                            "end_dttm": None,
                            "json_metadata": None,
                        },
                    ],
                }
            ),
        }

        try:
            ImportAnnotationLayersCommand(contents).run()
            layer = db.session.query(AnnotationLayer).filter_by(uuid=layer_uuid).one()
            assert layer.name == "imported-layer"
            assert layer.descr == "imported descr"

            annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer.id).all()
            )
            assert len(annotations) == 2
            by_uuid = {str(annotation.uuid): annotation for annotation in annotations}
            assert json.loads(by_uuid[ann_one_uuid].json_metadata) == {"label": "one"}
            assert by_uuid[ann_two_uuid].json_metadata is None
        finally:
            _purge_layer_by_uuid(layer_uuid)

    def test_import_v1_annotation_layer_multi_layer_bundle(self) -> None:
        """Import multiple layers in one bundle and verify parent-child mapping."""
        layer_one_uuid = str(uuid4())
        layer_two_uuid = str(uuid4())
        layer_one_annotation_uuids = {str(uuid4()), str(uuid4())}
        layer_two_annotation_uuids = {str(uuid4())}
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer_one.yaml": yaml.safe_dump(
                {
                    "name": "bundle-layer-one",
                    "descr": "bundle descr one",
                    "uuid": layer_one_uuid,
                    "version": "1.0.0",
                    "annotation": [
                        {
                            "uuid": uuid_,
                            "short_descr": f"one-{index}",
                            "long_descr": f"one-long-{index}",
                            "json_metadata": {"layer": 1, "index": index},
                        }
                        for index, uuid_ in enumerate(layer_one_annotation_uuids)
                    ],
                }
            ),
            "annotation_layers/layer_two.yaml": yaml.safe_dump(
                {
                    "name": "bundle-layer-two",
                    "descr": "bundle descr two",
                    "uuid": layer_two_uuid,
                    "version": "1.0.0",
                    "annotation": [
                        {
                            "uuid": next(iter(layer_two_annotation_uuids)),
                            "short_descr": "two-0",
                            "long_descr": "two-long-0",
                            "json_metadata": {"layer": 2, "index": 0},
                        }
                    ],
                }
            ),
        }

        try:
            ImportAnnotationLayersCommand(contents).run()
            layer_one = (
                db.session.query(AnnotationLayer).filter_by(uuid=layer_one_uuid).one()
            )
            layer_two = (
                db.session.query(AnnotationLayer).filter_by(uuid=layer_two_uuid).one()
            )

            assert layer_one.name == "bundle-layer-one"
            assert layer_two.name == "bundle-layer-two"

            layer_one_annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer_one.id).all()
            )
            layer_two_annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer_two.id).all()
            )

            assert len(layer_one_annotations) == 2
            assert len(layer_two_annotations) == 1
            assert {
                str(annotation.uuid) for annotation in layer_one_annotations
            } == layer_one_annotation_uuids
            assert {
                str(annotation.uuid) for annotation in layer_two_annotations
            } == layer_two_annotation_uuids
            assert all(
                annotation.layer_id == layer_one.id
                for annotation in layer_one_annotations
            )
            assert all(
                annotation.layer_id == layer_two.id
                for annotation in layer_two_annotations
            )
        finally:
            _purge_layer_by_uuid(layer_one_uuid)
            _purge_layer_by_uuid(layer_two_uuid)

    def test_import_v1_annotation_layer_round_trip(self) -> None:
        """Round-trip export/import preserves key layer and annotation fields."""
        source_layer = _create_layer(name=f"round_trip_{uuid4()}", descr="rt descr")
        source_layer_name = source_layer.name
        source_layer_uuid = str(source_layer.uuid)
        try:
            source_annotation = _create_annotation(
                source_layer,
                short_descr="rt-1",
                long_descr="rt-long",
                start_dttm=datetime(2024, 1, 1, 0, 0, 0),
                end_dttm=datetime(2024, 1, 1, 1, 0, 0),
                json_metadata='{"foo": "bar"}',
            )
            _create_annotation(source_layer, short_descr="rt-2")

            exported = _materialize_export(
                ExportAnnotationLayersCommand([source_layer.id]).run()
            )

            _delete_layer_graph(source_layer)
            ImportAnnotationLayersCommand(exported).run()

            imported_layer = (
                db.session.query(AnnotationLayer)
                .filter_by(uuid=source_layer_uuid)
                .one()
            )
            imported_annotation = (
                db.session.query(Annotation)
                .filter_by(layer_id=imported_layer.id, uuid=str(source_annotation.uuid))
                .one()
            )

            assert imported_layer.name == source_layer_name
            assert imported_layer.descr == "rt descr"
            assert imported_annotation.short_descr == source_annotation.short_descr
            assert imported_annotation.long_descr == source_annotation.long_descr
            assert imported_annotation.start_dttm == source_annotation.start_dttm
            assert imported_annotation.end_dttm == source_annotation.end_dttm
            assert json.loads(imported_annotation.json_metadata or "{}") == {
                "foo": "bar"
            }
            assert imported_annotation.layer_id == imported_layer.id
        finally:
            _purge_layer_by_uuid(source_layer_uuid)

    def test_import_v1_annotation_layer_multiple(self) -> None:
        """Repeated overwrite import preserves a single logical layer."""
        layer_uuid = str(uuid4())
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "existing-layer",
                    "descr": "v1",
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                    "annotation": [],
                }
            ),
        }

        try:
            command = ImportAnnotationLayersCommand(contents, overwrite=True)
            command.run()
            command.run()

            layers = db.session.query(AnnotationLayer).filter_by(uuid=layer_uuid).all()
            assert len(layers) == 1
        finally:
            _purge_layer_by_uuid(layer_uuid)

    def test_import_v1_annotation_layer_overwrite_syncs_children(self) -> None:
        """Overwrite sync removes stale child annotations."""
        layer_uuid = str(uuid4())
        ann_one_uuid = str(uuid4())
        ann_two_uuid = str(uuid4())
        contents_initial = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "sync-layer",
                    "descr": "before",
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                    "annotation": [
                        {
                            "uuid": ann_one_uuid,
                            "short_descr": "keep",
                            "json_metadata": None,
                        },
                        {
                            "uuid": ann_two_uuid,
                            "short_descr": "remove",
                            "json_metadata": None,
                        },
                    ],
                }
            ),
        }
        contents_overwrite = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "sync-layer-updated",
                    "descr": "after",
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                    "annotation": [
                        {
                            "uuid": ann_one_uuid,
                            "short_descr": "keep-updated",
                            "json_metadata": None,
                        }
                    ],
                }
            ),
        }

        try:
            ImportAnnotationLayersCommand(contents_initial).run()
            ImportAnnotationLayersCommand(contents_overwrite, overwrite=True).run()

            layer = db.session.query(AnnotationLayer).filter_by(uuid=layer_uuid).one()
            assert layer.name == "sync-layer-updated"
            assert layer.descr == "after"

            annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer.id).all()
            )
            assert len(annotations) == 1
            assert str(annotations[0].uuid) == ann_one_uuid
            assert annotations[0].short_descr == "keep-updated"
        finally:
            _purge_layer_by_uuid(layer_uuid)

    def test_import_annotation_layer_command_missing_metadata_raises(self) -> None:
        """Raise invalid-command error when metadata.yaml is missing from contents."""
        contents = {
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "missing-meta",
                    "descr": None,
                    "uuid": str(uuid4()),
                    "version": "1.0.0",
                    "annotation": [],
                }
            )
        }
        with pytest.raises(CommandInvalidError) as excinfo:
            ImportAnnotationLayersCommand(contents).run()
        assert str(excinfo.value) == "Could not find a valid command to import file"

    def test_import_annotation_layer_command_invalid_metadata_type(self) -> None:
        """Raise validation error when metadata type does not match AnnotationLayer."""
        layer_uuid = str(uuid4())
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config(type_="Database")),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "bad-meta-type",
                    "descr": None,
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                    "annotation": [],
                }
            ),
        }
        with pytest.raises(CommandInvalidError) as excinfo:
            ImportAnnotationLayersCommand(contents).run()
        assert str(excinfo.value).startswith("Error importing annotation_layer")
        assert excinfo.value.normalized_messages() == {
            "metadata.yaml": {"type": ["Must be equal to AnnotationLayer."]}
        }

    def test_import_annotation_layer_command_invalid_metadata_version(self) -> None:
        """Raise invalid-command error when metadata version is not supported."""
        contents = {
            "metadata.yaml": yaml.safe_dump(
                {
                    "version": "2.0.0",
                    "type": "AnnotationLayer",
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                }
            ),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "unsupported-version",
                    "descr": None,
                    "uuid": str(uuid4()),
                    "version": "1.0.0",
                    "annotation": [],
                }
            ),
        }
        with pytest.raises(CommandInvalidError) as excinfo:
            ImportAnnotationLayersCommand(contents).run()
        assert str(excinfo.value) == "Could not find a valid command to import file"

    def test_import_v1_annotation_layer_validation(self) -> None:
        """Validate direct v1 importer raises IncorrectVersionError for bad version."""
        contents = {
            "metadata.yaml": yaml.safe_dump(
                {
                    "version": "2.0.0",
                    "type": "AnnotationLayer",
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                }
            ),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "unsupported-version",
                    "descr": None,
                    "uuid": str(uuid4()),
                    "version": "1.0.0",
                    "annotation": [],
                }
            ),
        }
        command = v1.ImportAnnotationLayersCommand(contents)
        with pytest.raises(IncorrectVersionError) as excinfo:
            command.run()
        assert str(excinfo.value) == "Must be equal to 1.0.0."

    def test_import_annotation_layer_command_missing_required_fields(self) -> None:
        """Raise validation error for missing required child annotation UUID fields."""
        layer_uuid = str(uuid4())
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "missing-annotation-uuid",
                    "descr": None,
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                    "annotation": [{"short_descr": "missing uuid"}],
                }
            ),
        }

        with pytest.raises(CommandInvalidError) as excinfo:
            ImportAnnotationLayersCommand(contents).run()
        assert str(excinfo.value).startswith("Error importing annotation_layer")
        messages = excinfo.value.normalized_messages()
        layer_errors = messages["annotation_layers/layer.yaml"]
        assert "annotation" in layer_errors
        assert "uuid" in layer_errors["annotation"][0]

    def test_import_annotation_layer_command_malformed_yaml(self) -> None:
        """Raise validation error when layer payload is not valid YAML."""
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer.yaml": "name: broken: yaml",
        }
        with pytest.raises(CommandInvalidError) as excinfo:
            ImportAnnotationLayersCommand(contents).run()
        assert str(excinfo.value).startswith("Error importing annotation_layer")
        assert excinfo.value.normalized_messages() == {
            "annotation_layers/layer.yaml": "Not a valid YAML file"
        }

    def test_import_annotation_layer_command_missing_annotation_list_defaults_to_empty(
        self,
    ) -> None:
        """Missing annotation list defaults to empty on import."""
        layer_uuid = str(uuid4())
        contents = {
            "metadata.yaml": yaml.safe_dump(_metadata_config()),
            "annotation_layers/layer.yaml": yaml.safe_dump(
                {
                    "name": "no-annotations",
                    "descr": None,
                    "uuid": layer_uuid,
                    "version": "1.0.0",
                }
            ),
        }

        try:
            ImportAnnotationLayersCommand(contents).run()
            layer = db.session.query(AnnotationLayer).filter_by(uuid=layer_uuid).one()
            annotations = (
                db.session.query(Annotation).filter_by(layer_id=layer.id).all()
            )
            assert annotations == []
        finally:
            _purge_layer_by_uuid(layer_uuid)
