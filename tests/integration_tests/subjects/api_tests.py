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
from typing import Generator

import pytest
import rison

import tests.integration_tests.test_app  # noqa: F401
from superset import db
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME

SUBJECTS_FIXTURE_COUNT = 3


class TestSubjectApi(SupersetTestCase):
    def insert_subject(
        self,
        label: str,
        subject_type: SubjectType = SubjectType.ROLE,
    ) -> Subject:
        subject = Subject(label=label, type=subject_type, active=True)
        db.session.add(subject)
        db.session.commit()
        return subject

    @pytest.fixture
    def create_subjects(self) -> Generator[list[Subject], None, None]:
        with self.create_app().app_context():
            subjects = [
                self.insert_subject(label=f"subject_label{cx}")
                for cx in range(SUBJECTS_FIXTURE_COUNT)
            ]
            yield subjects

            for subject in subjects:
                db.session.delete(subject)
            db.session.commit()

    @pytest.mark.usefixtures("create_subjects")
    def test_get_list_subject(self) -> None:
        """Subject API: Test get list"""
        self.login(ADMIN_USERNAME)
        uri = "api/v1/security/subject/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == db.session.query(Subject).count()
        result_columns = set(data["result"][0].keys())
        # a representative subset of the exposed columns
        assert {"id", "label", "type", "active"} <= result_columns

    @pytest.mark.usefixtures("create_subjects")
    def test_get_list_subject_filter(self) -> None:
        """Subject API: Test text filter on label"""
        self.login(ADMIN_USERNAME)
        expected = (
            db.session.query(Subject)
            .filter(Subject.label.ilike("%subject_label1%"))
            .count()
        )
        query_string = {
            "filters": [
                {"col": "label", "opr": "subject_all_text", "value": "subject_label1"}
            ],
        }
        uri = f"api/v1/security/subject/?q={rison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == expected

    @pytest.mark.usefixtures("create_subjects")
    def test_get_list_subject_filter_by_type(self) -> None:
        """Subject API: Test equality filter on type"""
        self.login(ADMIN_USERNAME)
        expected = (
            db.session.query(Subject).filter(Subject.type == SubjectType.ROLE).count()
        )
        query_string = {
            "filters": [{"col": "type", "opr": "eq", "value": int(SubjectType.ROLE)}],
        }
        uri = f"api/v1/security/subject/?q={rison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == expected

    @pytest.mark.usefixtures("create_subjects")
    def test_get_subject(self) -> None:
        """Subject API: Test get single subject"""
        self.login(ADMIN_USERNAME)
        subject = db.session.query(Subject).first()
        uri = f"api/v1/security/subject/{subject.id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"]["id"] == subject.id
        assert data["result"]["label"] == subject.label

    def test_info_subject_security(self) -> None:
        """Subject API: Test info security is read-only"""
        self.login(ADMIN_USERNAME)
        params = {"keys": ["permissions"]}
        uri = f"api/v1/security/subject/_info?q={rison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        # Read-only API: only can_read is exposed, no can_write
        assert data["permissions"] == ["can_read"]

    @pytest.mark.usefixtures("create_subjects")
    def test_get_list_subject_gamma(self) -> None:
        """Subject API: Test non-admin is forbidden"""
        self.login(GAMMA_USERNAME)
        uri = "api/v1/security/subject/"
        rv = self.client.get(uri)
        assert rv.status_code == 403

    def test_subject_write_methods_absent(self) -> None:
        """Subject API: Test create/update/delete routes are not registered"""
        self.login(ADMIN_USERNAME)
        assert self.client.post("api/v1/security/subject/", json={}).status_code == 405
        assert self.client.put("api/v1/security/subject/1", json={}).status_code == 405
        assert self.client.delete("api/v1/security/subject/1").status_code == 405
