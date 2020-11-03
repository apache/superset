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
# isort:skip_file
"""Unit tests for Superset"""
from datetime import datetime
from typing import Optional
import json

import pytest
import prison
from sqlalchemy.sql import func

import tests.test_app
from superset import db
from superset.models.annotations import Annotation, AnnotationLayer

from tests.base_tests import SupersetTestCase


ANNOTATION_LAYERS_COUNT = 10
ANNOTATIONS_COUNT = 5


class TestAnnotationLayerApi(SupersetTestCase):
    def insert_annotation_layer(
        self, name: str = "", descr: str = ""
    ) -> AnnotationLayer:
        annotation_layer = AnnotationLayer(name=name, descr=descr,)
        db.session.add(annotation_layer)
        db.session.commit()
        return annotation_layer

    def insert_annotation(
        self,
        layer: AnnotationLayer,
        short_descr: str,
        long_descr: str,
        json_metadata: Optional[str] = "",
        start_dttm: Optional[datetime] = None,
        end_dttm: Optional[datetime] = None,
    ) -> Annotation:
        annotation = Annotation(
            layer=layer,
            short_descr=short_descr,
            long_descr=long_descr,
            json_metadata=json_metadata,
            start_dttm=start_dttm,
            end_dttm=end_dttm,
        )
        db.session.add(annotation)
        db.session.commit()
        return annotation

    @pytest.fixture()
    def create_annotation_layers(self):
        """
        Creates ANNOTATION_LAYERS_COUNT-1 layers with no annotations
        and a final one with ANNOTATION_COUNT childs
        :return:
        """
        with self.create_app().app_context():
            annotation_layers = []
            annotations = []
            for cx in range(ANNOTATION_LAYERS_COUNT - 1):
                annotation_layers.append(
                    self.insert_annotation_layer(name=f"name{cx}", descr=f"descr{cx}")
                )
            layer_with_annotations = self.insert_annotation_layer(
                "layer_with_annotations"
            )
            annotation_layers.append(layer_with_annotations)
            for cx in range(ANNOTATIONS_COUNT):
                annotations.append(
                    self.insert_annotation(
                        layer_with_annotations,
                        short_descr=f"short_descr{cx}",
                        long_descr=f"long_descr{cx}",
                    )
                )
            yield annotation_layers

            # rollback changes
            for annotation_layer in annotation_layers:
                db.session.delete(annotation_layer)
            for annotation in annotations:
                db.session.delete(annotation)
            db.session.commit()

    @staticmethod
    def get_layer_with_annotation() -> AnnotationLayer:
        return (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "layer_with_annotations")
            .one_or_none()
        )

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_annotation_layer(self):
        """
        Annotation Api: Test get annotation layer
        """
        annotation_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name1")
            .first()
        )

        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{annotation_layer.id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200

        expected_result = {
            "id": annotation_layer.id,
            "name": "name1",
            "descr": "descr1",
        }
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"] == expected_result

    def test_info_annotation(self):
        """
        Annotation API: Test info
        """
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/_info"
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_annotation_layer_not_found(self):
        """
        Annotation Api: Test get annotation layer not found
        """
        max_id = db.session.query(func.max(AnnotationLayer.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{max_id + 1}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_list_annotation_layer(self):
        """
        Annotation Api: Test get list annotation layers
        """
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/"
        rv = self.get_assert_metric(uri, "get_list")

        expected_fields = [
            "name",
            "descr",
            "created_by",
            "created_on",
            "changed_by",
            "changed_on_delta_humanized",
            "changed_on",
        ]
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == ANNOTATION_LAYERS_COUNT
        for expected_field in expected_fields:
            assert expected_field in data["result"][0]

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_list_annotation_layer_sorting(self):
        """
        Annotation Api: Test sorting on get list annotation layers
        """
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/"

        order_columns = [
            "name",
            "descr",
            "created_by.first_name",
            "changed_by.first_name",
            "changed_on",
            "changed_on_delta_humanized",
            "created_on",
        ]

        for order_column in order_columns:
            arguments = {"order_column": order_column, "order_direction": "asc"}
            uri = f"api/v1/annotation_layer/?q={prison.dumps(arguments)}"
            rv = self.get_assert_metric(uri, "get_list")
            assert rv.status_code == 200

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_list_annotation_layer_filter(self):
        """
        Annotation Api: Test filters on get list annotation layers
        """
        self.login(username="admin")
        arguments = {
            "columns": ["name", "descr"],
            "filters": [
                {"col": "name", "opr": "annotation_layer_all_text", "value": "2"}
            ],
        }
        uri = f"api/v1/annotation_layer/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        expected_result = {
            "name": "name2",
            "descr": "descr2",
        }
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1
        assert data["result"][0] == expected_result

        arguments = {
            "columns": ["name", "descr"],
            "filters": [
                {"col": "name", "opr": "annotation_layer_all_text", "value": "descr3"}
            ],
        }
        uri = f"api/v1/annotation_layer/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        expected_result = {
            "name": "name3",
            "descr": "descr3",
        }

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1
        assert data["result"][0] == expected_result

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_create_annotation_layer(self):
        """
        Annotation Api: Test create annotation layer
        """
        self.login(username="admin")
        annotation_layer_data = {"name": "new3", "descr": "description"}
        uri = "api/v1/annotation_layer/"
        rv = self.client.post(uri, json=annotation_layer_data)
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))
        created_model = db.session.query(AnnotationLayer).get(data.get("id"))
        assert created_model is not None
        assert created_model.name == annotation_layer_data["name"]
        assert created_model.descr == annotation_layer_data["descr"]

        # Rollback changes
        db.session.delete(created_model)
        db.session.commit()

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_create_annotation_layer_uniqueness(self):
        """
        Annotation Api: Test create annotation layer uniqueness
        """
        self.login(username="admin")
        annotation_layer_data = {"name": "name3", "descr": "description"}
        uri = "api/v1/annotation_layer/"
        rv = self.client.post(uri, json=annotation_layer_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"name": ["Name must be unique"]}}

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_update_annotation_layer(self):
        """
        Annotation Api: Test update annotation layer
        """
        annotation_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name2")
            .one_or_none()
        )

        self.login(username="admin")
        annotation_layer_data = {"name": "changed_name", "descr": "changed_description"}
        uri = f"api/v1/annotation_layer/{annotation_layer.id}"
        rv = self.client.put(uri, json=annotation_layer_data)
        assert rv.status_code == 200
        updated_model = db.session.query(AnnotationLayer).get(annotation_layer.id)
        assert updated_model is not None
        assert updated_model.name == annotation_layer_data["name"]
        assert updated_model.descr == annotation_layer_data["descr"]

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_update_annotation_layer_uniqueness(self):
        """
        Annotation Api: Test update annotation layer uniqueness
        """
        annotation_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name2")
            .one_or_none()
        )

        self.login(username="admin")
        annotation_layer_data = {"name": "name3", "descr": "changed_description"}
        uri = f"api/v1/annotation_layer/{annotation_layer.id}"
        rv = self.client.put(uri, json=annotation_layer_data)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        assert data == {"message": {"name": ["Name must be unique"]}}

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_update_annotation_layer_not_found(self):
        """
        Annotation Api: Test update annotation layer not found
        """
        max_id = db.session.query(func.max(AnnotationLayer.id)).scalar()

        self.login(username="admin")
        annotation_layer_data = {"name": "changed_name", "descr": "changed_description"}
        uri = f"api/v1/annotation_layer/{max_id + 1}"
        rv = self.client.put(uri, json=annotation_layer_data)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_delete_annotation_layer(self):
        """
        Annotation Api: Test update annotation layer
        """
        annotation_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name1")
            .one_or_none()
        )
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{annotation_layer.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        updated_model = db.session.query(AnnotationLayer).get(annotation_layer.id)
        assert updated_model is None

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_delete_annotation_layer_not_found(self):
        """
        Annotation Api: Test delete annotation layer not found
        """
        max_id = db.session.query(func.max(AnnotationLayer.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{max_id + 1}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_delete_annotation_layer_integrity(self):
        """
        Annotation Api: Test delete annotation layer integrity error
        """
        query_child_layer = db.session.query(AnnotationLayer).filter(
            AnnotationLayer.name == "layer_with_annotations"
        )
        child_layer = query_child_layer.one_or_none()
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{child_layer.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 422

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_bulk_delete_annotation_layer(self):
        """
        Annotation Api: Test bulk delete annotation layers
        """
        query_no_child_layers = db.session.query(AnnotationLayer).filter(
            AnnotationLayer.name.like("name%")
        )

        no_child_layers = query_no_child_layers.all()
        no_child_layers_ids = [
            annotation_layer.id for annotation_layer in no_child_layers
        ]
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/?q={prison.dumps(no_child_layers_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        deleted_annotation_layers = query_no_child_layers.all()
        assert deleted_annotation_layers == []
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": f"Deleted {len(no_child_layers_ids)} annotation layers"
        }
        assert response == expected_response

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_bulk_delete_annotation_layer_not_found(self):
        """
        Annotation Api: Test bulk delete annotation layers not found
        """
        all_annotation_layers = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name.like("name%"))
            .all()
        )
        all_annotation_layers_ids = [
            annotation_layer.id for annotation_layer in all_annotation_layers
        ]
        max_id = db.session.query(func.max(AnnotationLayer.id)).scalar()
        all_annotation_layers_ids.append(max_id + 1)
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/?q={prison.dumps(all_annotation_layers_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_annotation(self):
        """
        Annotation API: Test get annotation
        """
        annotation = (
            db.session.query(Annotation)
            .filter(Annotation.short_descr == "short_descr1")
            .one_or_none()
        )

        self.login(username="admin")
        uri = (
            f"api/v1/annotation_layer/{annotation.layer_id}/annotation/{annotation.id}"
        )
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200

        expected_result = {
            "id": annotation.id,
            "end_dttm": None,
            "json_metadata": "",
            "layer": {"id": annotation.layer_id, "name": "layer_with_annotations"},
            "long_descr": annotation.long_descr,
            "short_descr": annotation.short_descr,
            "start_dttm": None,
        }

        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"] == expected_result

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_annotation_not_found(self):
        """
        Annotation API: Test get annotation not found
        """
        layer = self.get_layer_with_annotation()
        max_id = db.session.query(func.max(Annotation.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/{max_id + 1}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_list_annotation(self):
        """
        Annotation Api: Test get list of annotations
        """
        layer = self.get_layer_with_annotation()
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/"
        rv = self.get_assert_metric(uri, "get_list")

        expected_fields = [
            "short_descr",
            "created_by",
            "changed_by",
            "start_dttm",
            "end_dttm",
        ]

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == ANNOTATIONS_COUNT
        for expected_field in expected_fields:
            assert expected_field in data["result"][0]

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_list_annotation_sorting(self):
        """
        Annotation Api: Test sorting on get list of annotations
        """
        layer = self.get_layer_with_annotation()
        self.login(username="admin")

        order_columns = [
            "short_descr",
            "created_by.first_name",
            "changed_by.first_name",
            "changed_on_delta_humanized",
            "start_dttm",
            "end_dttm",
        ]
        for order_column in order_columns:
            arguments = {"order_column": order_column, "order_direction": "asc"}
            uri = f"api/v1/annotation_layer/{layer.id}/annotation/?q={prison.dumps(arguments)}"
            rv = self.get_assert_metric(uri, "get_list")
            assert rv.status_code == 200

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_get_list_annotation_filter(self):
        """
        Annotation Api: Test filters on get list annotation layers
        """
        layer = self.get_layer_with_annotation()
        self.login(username="admin")
        arguments = {
            "filters": [
                {"col": "short_descr", "opr": "annotation_all_text", "value": "2"}
            ]
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1

        arguments = {
            "filters": [
                {"col": "short_descr", "opr": "annotation_all_text", "value": "descr3"}
            ]
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_create_annotation(self):
        """
        Annotation Api: Test create annotation
        """
        layer = self.get_layer_with_annotation()

        self.login(username="admin")
        annotation_data = {
            "short_descr": "new",
            "long_descr": "description",
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/"
        rv = self.client.post(uri, json=annotation_data)
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))
        created_model: Annotation = db.session.query(Annotation).get(data.get("id"))
        assert created_model is not None
        assert created_model.short_descr == annotation_data["short_descr"]
        assert created_model.long_descr == annotation_data["long_descr"]

        # Rollback changes
        db.session.delete(created_model)
        db.session.commit()

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_create_annotation_uniqueness(self):
        """
        Annotation Api: Test create annotation uniqueness
        """
        layer = self.get_layer_with_annotation()

        self.login(username="admin")
        annotation_data = {
            "short_descr": "short_descr2",
            "long_descr": "description",
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/"
        rv = self.client.post(uri, json=annotation_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": {
                "short_descr": ["Short description must be unique for this layer"]
            }
        }

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_update_annotation(self):
        """
        Annotation Api: Test update annotation
        """
        layer = self.get_layer_with_annotation()
        annotation = (
            db.session.query(Annotation)
            .filter(Annotation.short_descr == "short_descr2")
            .one_or_none()
        )

        self.login(username="admin")
        annotation_layer_data = {
            "short_descr": "changed_name",
            "long_descr": "changed_description",
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/{annotation.id}"
        rv = self.client.put(uri, json=annotation_layer_data)
        assert rv.status_code == 200
        updated_model: Annotation = db.session.query(Annotation).get(annotation.id)
        assert updated_model is not None
        assert updated_model.short_descr == annotation_layer_data["short_descr"]
        assert updated_model.long_descr == annotation_layer_data["long_descr"]

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_update_annotation_uniqueness(self):
        """
        Annotation Api: Test update annotation uniqueness
        """
        layer = self.get_layer_with_annotation()
        annotation = (
            db.session.query(Annotation)
            .filter(Annotation.short_descr == "short_descr2")
            .one_or_none()
        )

        self.login(username="admin")
        annotation_layer_data = {
            "short_descr": "short_descr3",
            "long_descr": "changed_description",
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/{annotation.id}"
        rv = self.client.put(uri, json=annotation_layer_data)
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": {
                "short_descr": ["Short description must be unique for this layer"]
            }
        }

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_update_annotation_not_found(self):
        """
        Annotation Api: Test update annotation not found
        """
        layer = self.get_layer_with_annotation()
        max_id = db.session.query(func.max(Annotation.id)).scalar()

        self.login(username="admin")
        annotation_layer_data = {
            "short_descr": "changed_name",
        }
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/{max_id + 1}"
        rv = self.client.put(uri, json=annotation_layer_data)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_delete_annotation(self):
        """
        Annotation Api: Test update annotation
        """
        layer = self.get_layer_with_annotation()
        annotation = (
            db.session.query(Annotation)
            .filter(Annotation.short_descr == "short_descr1")
            .one_or_none()
        )
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/{annotation.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        updated_model = db.session.query(Annotation).get(annotation.id)
        assert updated_model is None

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_delete_annotation_not_found(self):
        """
        Annotation Api: Test delete annotation not found
        """
        layer = self.get_layer_with_annotation()
        max_id = db.session.query(func.max(Annotation.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{layer.id}/annotation{max_id + 1}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_bulk_delete_annotation(self):
        """
        Annotation Api: Test bulk delete annotation
        """
        layer = self.get_layer_with_annotation()
        query_annotations = db.session.query(Annotation).filter(
            Annotation.layer == layer
        )

        annotations = query_annotations.all()
        annotations_ids = [annotation.id for annotation in annotations]
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/?q={prison.dumps(annotations_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        deleted_annotations = query_annotations.all()
        assert deleted_annotations == []
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {len(annotations_ids)} annotations"}
        assert response == expected_response

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_bulk_delete_annotation_not_found(self):
        """
        Annotation Api: Test bulk delete annotation not found
        """
        layer = self.get_layer_with_annotation()
        query_annotations = db.session.query(Annotation).filter(
            Annotation.layer == layer
        )

        annotations = query_annotations.all()
        annotations_ids = [annotation.id for annotation in annotations]

        max_id = db.session.query(func.max(Annotation.id)).scalar()

        annotations_ids.append(max_id + 1)
        self.login(username="admin")
        uri = f"api/v1/annotation_layer/{layer.id}/annotation/?q={prison.dumps(annotations_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404
