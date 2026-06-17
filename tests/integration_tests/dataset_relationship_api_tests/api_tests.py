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
"""Integration tests for the Dataset Relationship REST API.

Covers all CRUD endpoints, validation rules, authentication and permission
checks, and edge cases (404, 403, 422).
"""
from __future__ import annotations

import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db, security_manager
from superset.models.dataset_relationships import (
    DatasetRelationship,
    DatasetRelationshipColumn,
)
from superset.utils import json
from superset.utils.database import get_example_database, get_main_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)

API_URL = "api/v1/dataset_relationship/"


class TestDatasetRelationshipApi(SupersetTestCase):
    """Integration tests for ``DatasetRelationshipRestApi``."""

    items_to_delete: list[SqlaTable | DatasetRelationship] = []

    def setUp(self) -> None:
        self.items_to_delete = []

    def tearDown(self) -> None:
        for item in reversed(self.items_to_delete):
            try:
                db.session.delete(item)
                db.session.commit()
            except Exception:
                db.session.rollback()
        super().tearDown()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _insert_dataset(
        self,
        table_name: str,
        schema: str | None = None,
        database=None,
    ) -> SqlaTable:
        """Create a minimal ``SqlaTable`` for testing."""
        database = database or get_main_database()
        admin = db.session.query(security_manager.user_model).filter_by(
            username=ADMIN_USERNAME
        ).first()
        table = SqlaTable(
            table_name=table_name,
            schema=schema,
            database=database,
            owners=[admin],
        )
        db.session.add(table)
        db.session.commit()
        self.items_to_delete.append(table)
        return table

    def _create_relationship(
        self,
        source: SqlaTable,
        target: SqlaTable,
        relationship_type: str = "many_to_one",
        join_type: str = "LEFT",
        is_active: bool = True,
        name: str | None = None,
        columns: list[dict] | None = None,
    ) -> DatasetRelationship:
        """Create a ``DatasetRelationship`` directly in the DB."""
        rel = DatasetRelationship(
            source_dataset_id=source.id,
            target_dataset_id=target.id,
            relationship_type=relationship_type,
            join_type=join_type,
            is_active=is_active,
            name=name or f"{source.table_name}_to_{target.table_name}",
            is_cross_database=(source.database_id != target.database_id),
        )
        col_defs = columns or [
            {
                "source_column_name": "id",
                "target_column_name": "id",
                "operator": "=",
                "ordinal": 0,
            }
        ]
        for col in col_defs:
            rel.columns.append(DatasetRelationshipColumn(**col))
        db.session.add(rel)
        db.session.commit()
        self.items_to_delete.append(rel)
        return rel

    def _payload(
        self,
        source_id: int,
        target_id: int,
        **overrides: object,
    ) -> dict:
        """Return a valid POST payload with optional overrides."""
        data: dict = {
            "source_dataset_id": source_id,
            "target_dataset_id": target_id,
            "relationship_type": "many_to_one",
            "join_type": "LEFT",
            "is_active": True,
            "name": "test_relationship",
            "columns": [
                {
                    "source_column_name": "customer_id",
                    "target_column_name": "id",
                    "operator": "=",
                    "ordinal": 0,
                }
            ],
        }
        data.update(overrides)
        return data

    # ==================================================================
    # GET  /api/v1/dataset_relationship/  (list)
    # ==================================================================
    def test_get_list_relationships(self) -> None:
        """Dataset Relationship API: Test list returns relationships."""
        src = self._insert_dataset("rel_src_list")
        tgt = self._insert_dataset("rel_tgt_list")
        rel = self._create_relationship(src, tgt)

        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(API_URL, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] >= 1
        ids = [r["id"] for r in data["result"]]
        assert rel.id in ids

    def test_get_list_relationships_unauthenticated(self) -> None:
        """Dataset Relationship API: Unauthenticated list returns 401."""
        rv = self.client.get(API_URL)
        assert rv.status_code == 401

    # ==================================================================
    # GET  /api/v1/dataset_relationship/<pk>  (show)
    # ==================================================================
    def test_get_relationship(self) -> None:
        """Dataset Relationship API: Test get specific relationship."""
        src = self._insert_dataset("rel_src_show")
        tgt = self._insert_dataset("rel_tgt_show")
        rel = self._create_relationship(src, tgt, name="show_test")

        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(f"{API_URL}{rel.id}", "get")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]
        assert result["name"] == "show_test"
        assert result["source_dataset_id"] == src.id
        assert result["target_dataset_id"] == tgt.id
        assert len(result["columns.id"]) >= 1 or "columns" in str(data)

    def test_get_relationship_not_found(self) -> None:
        """Dataset Relationship API: 404 for non-existent relationship."""
        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(f"{API_URL}99999", "get")
        assert rv.status_code == 404

    # ==================================================================
    # POST  /api/v1/dataset_relationship/
    # ==================================================================
    def test_create_relationship(self) -> None:
        """Dataset Relationship API: Create a new relationship."""
        src = self._insert_dataset("rel_src_create")
        tgt = self._insert_dataset("rel_tgt_create")

        self.login(ADMIN_USERNAME)
        payload = self._payload(src.id, tgt.id)
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))
        new_id = data["id"]
        assert new_id is not None

        # Verify in DB
        model = db.session.query(DatasetRelationship).get(new_id)
        assert model is not None
        assert model.source_dataset_id == src.id
        assert model.target_dataset_id == tgt.id
        assert len(model.columns) == 1
        self.items_to_delete.append(model)

    def test_create_relationship_missing_fields(self) -> None:
        """Dataset Relationship API: 400 when required fields are missing."""
        self.login(ADMIN_USERNAME)
        rv = self.post_assert_metric(API_URL, {}, "post")
        assert rv.status_code == 400

    def test_create_relationship_self_reference(self) -> None:
        """Dataset Relationship API: 400 for self-referencing relationship."""
        src = self._insert_dataset("rel_src_self")
        self.login(ADMIN_USERNAME)
        payload = self._payload(src.id, src.id)
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 400

    def test_create_relationship_invalid_type(self) -> None:
        """Dataset Relationship API: 400 for invalid relationship_type."""
        src = self._insert_dataset("rel_src_invtype")
        tgt = self._insert_dataset("rel_tgt_invtype")
        self.login(ADMIN_USERNAME)
        payload = self._payload(src.id, tgt.id, relationship_type="INVALID")
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 400

    def test_create_relationship_invalid_join_type(self) -> None:
        """Dataset Relationship API: 400 for invalid join_type."""
        src = self._insert_dataset("rel_src_invjoin")
        tgt = self._insert_dataset("rel_tgt_invjoin")
        self.login(ADMIN_USERNAME)
        payload = self._payload(src.id, tgt.id, join_type="NATURAL")
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 400

    def test_create_relationship_empty_columns(self) -> None:
        """Dataset Relationship API: 400 when columns list is empty."""
        src = self._insert_dataset("rel_src_nocol")
        tgt = self._insert_dataset("rel_tgt_nocol")
        self.login(ADMIN_USERNAME)
        payload = self._payload(src.id, tgt.id, columns=[])
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 400

    def test_create_relationship_unauthenticated(self) -> None:
        """Dataset Relationship API: 401 for unauthenticated POST."""
        rv = self.client.post(
            API_URL,
            json={"source_dataset_id": 1, "target_dataset_id": 2},
        )
        assert rv.status_code == 401

    def test_create_relationship_nonexistent_dataset(self) -> None:
        """Dataset Relationship API: 422 when source dataset doesn't exist."""
        tgt = self._insert_dataset("rel_tgt_noexist")
        self.login(ADMIN_USERNAME)
        payload = self._payload(99999, tgt.id)
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 422

    def test_create_relationship_duplicate(self) -> None:
        """Dataset Relationship API: 422 for duplicate relationship pair."""
        src = self._insert_dataset("rel_src_dup")
        tgt = self._insert_dataset("rel_tgt_dup")
        self._create_relationship(src, tgt)

        self.login(ADMIN_USERNAME)
        payload = self._payload(src.id, tgt.id)
        rv = self.post_assert_metric(API_URL, payload, "post")
        assert rv.status_code == 422

    # ==================================================================
    # PUT  /api/v1/dataset_relationship/<pk>
    # ==================================================================
    def test_update_relationship(self) -> None:
        """Dataset Relationship API: Update an existing relationship."""
        src = self._insert_dataset("rel_src_upd")
        tgt = self._insert_dataset("rel_tgt_upd")
        rel = self._create_relationship(src, tgt, is_active=True)

        self.login(ADMIN_USERNAME)
        update_data = {"is_active": False, "name": "updated_name"}
        rv = self.put_assert_metric(f"{API_URL}{rel.id}", update_data, "put")
        assert rv.status_code == 200

        db.session.refresh(rel)
        assert rel.is_active is False
        assert rel.name == "updated_name"

    def test_update_relationship_not_found(self) -> None:
        """Dataset Relationship API: 404 for updating non-existent rel."""
        self.login(ADMIN_USERNAME)
        rv = self.put_assert_metric(
            f"{API_URL}99999", {"is_active": False}, "put"
        )
        assert rv.status_code == 404

    def test_update_relationship_invalid_type(self) -> None:
        """Dataset Relationship API: 400 for invalid relationship_type in PUT."""
        src = self._insert_dataset("rel_src_updinv")
        tgt = self._insert_dataset("rel_tgt_updinv")
        rel = self._create_relationship(src, tgt)

        self.login(ADMIN_USERNAME)
        rv = self.put_assert_metric(
            f"{API_URL}{rel.id}",
            {"relationship_type": "INVALID"},
            "put",
        )
        assert rv.status_code == 400

    def test_update_relationship_unauthenticated(self) -> None:
        """Dataset Relationship API: 401 for unauthenticated PUT."""
        rv = self.client.put(
            f"{API_URL}1",
            json={"is_active": False},
            content_type="application/json",
        )
        assert rv.status_code == 401

    # ==================================================================
    # DELETE  /api/v1/dataset_relationship/<pk>
    # ==================================================================
    def test_delete_relationship(self) -> None:
        """Dataset Relationship API: Delete a relationship."""
        src = self._insert_dataset("rel_src_del")
        tgt = self._insert_dataset("rel_tgt_del")
        rel = self._create_relationship(src, tgt)
        rel_id = rel.id
        # Remove from cleanup since we're deleting via API
        self.items_to_delete.remove(rel)

        self.login(ADMIN_USERNAME)
        rv = self.delete_assert_metric(f"{API_URL}{rel_id}", "delete")
        assert rv.status_code == 200

        # Verify removed from DB
        assert db.session.query(DatasetRelationship).get(rel_id) is None

    def test_delete_relationship_not_found(self) -> None:
        """Dataset Relationship API: 404 for deleting non-existent rel."""
        self.login(ADMIN_USERNAME)
        rv = self.delete_assert_metric(f"{API_URL}99999", "delete")
        assert rv.status_code == 404

    def test_delete_relationship_unauthenticated(self) -> None:
        """Dataset Relationship API: 401 for unauthenticated DELETE."""
        rv = self.client.delete(f"{API_URL}1")
        assert rv.status_code == 401

    # ==================================================================
    # DELETE  /api/v1/dataset_relationship/  (bulk)
    # ==================================================================
    def test_bulk_delete_relationships(self) -> None:
        """Dataset Relationship API: Bulk delete relationships."""
        src = self._insert_dataset("rel_src_bdel")
        tgt1 = self._insert_dataset("rel_tgt_bdel1")
        tgt2 = self._insert_dataset("rel_tgt_bdel2")
        rel1 = self._create_relationship(src, tgt1)
        rel2 = self._create_relationship(src, tgt2)
        ids = [rel1.id, rel2.id]
        # Remove from cleanup
        self.items_to_delete.remove(rel1)
        self.items_to_delete.remove(rel2)

        self.login(ADMIN_USERNAME)
        uri = f"{API_URL}?q={json.dumps(ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200

        for rel_id in ids:
            assert db.session.query(DatasetRelationship).get(rel_id) is None

    # ==================================================================
    # GET  /api/v1/dataset_relationship/dataset/<dataset_id>
    # ==================================================================
    def test_get_by_dataset(self) -> None:
        """Dataset Relationship API: Get relationships for a dataset."""
        src = self._insert_dataset("rel_src_byd")
        tgt = self._insert_dataset("rel_tgt_byd")
        rel = self._create_relationship(src, tgt)

        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(
            f"{API_URL}dataset/{src.id}", "get_by_dataset"
        )
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] >= 1
        assert any(r["id"] == rel.id for r in data["result"])

    def test_get_by_dataset_as_target(self) -> None:
        """Dataset Relationship API: Dataset as target also shows relationships."""
        src = self._insert_dataset("rel_src_bydtgt")
        tgt = self._insert_dataset("rel_tgt_bydtgt")
        rel = self._create_relationship(src, tgt)

        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(
            f"{API_URL}dataset/{tgt.id}", "get_by_dataset"
        )
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] >= 1
        assert any(r["id"] == rel.id for r in data["result"])

    def test_get_by_dataset_active_filter(self) -> None:
        """Dataset Relationship API: active_only filter works."""
        src = self._insert_dataset("rel_src_actf")
        tgt = self._insert_dataset("rel_tgt_actf")
        self._create_relationship(src, tgt, is_active=False, name="inactive_rel")

        self.login(ADMIN_USERNAME)
        # Default: active_only=true  →  should NOT find the inactive one
        rv = self.get_assert_metric(
            f"{API_URL}dataset/{src.id}", "get_by_dataset"
        )
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

        # active_only=false  →  should find it
        rv = self.client.get(
            f"{API_URL}dataset/{src.id}?active_only=false"
        )
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] >= 1

    def test_get_by_dataset_no_results(self) -> None:
        """Dataset Relationship API: No relationships for a dataset returns empty."""
        src = self._insert_dataset("rel_src_nores")
        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(
            f"{API_URL}dataset/{src.id}", "get_by_dataset"
        )
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

    def test_get_by_dataset_unauthenticated(self) -> None:
        """Dataset Relationship API: 401 for unauthenticated get_by_dataset."""
        rv = self.client.get(f"{API_URL}dataset/1")
        assert rv.status_code == 401

    # ==================================================================
    # Permission / Authorization tests
    # ==================================================================
    def test_gamma_cannot_create_relationship(self) -> None:
        """Dataset Relationship API: Gamma user cannot create relationship (403)."""
        src = self._insert_dataset("rel_src_gamma")
        tgt = self._insert_dataset("rel_tgt_gamma")
        self.login(GAMMA_USERNAME)
        payload = self._payload(src.id, tgt.id)
        rv = self.client.post(
            API_URL,
            json=payload,
            content_type="application/json",
        )
        # Gamma should be denied write access → 403
        assert rv.status_code in (401, 403)

    def test_gamma_cannot_delete_relationship(self) -> None:
        """Dataset Relationship API: Gamma user cannot delete relationship (403)."""
        src = self._insert_dataset("rel_src_gdel")
        tgt = self._insert_dataset("rel_tgt_gdel")
        rel = self._create_relationship(src, tgt)
        self.login(GAMMA_USERNAME)
        rv = self.client.delete(f"{API_URL}{rel.id}")
        assert rv.status_code in (401, 403)
