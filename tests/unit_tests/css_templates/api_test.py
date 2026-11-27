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
from collections.abc import Iterator
from io import BytesIO
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.models.core import CssTemplate

IMPORT_URL = "/api/v1/css_template/import/"


@pytest.fixture
def session_with_schema(session: Session) -> Iterator[Session]:
    engine = session.get_bind()
    CssTemplate.metadata.create_all(engine)  # pylint: disable=no-member
    yield session
    session.rollback()


@pytest.fixture
def can_write(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.css.import_templates.security_manager.can_access",
        return_value=True,
    )


def css_file(name: str, content: str) -> tuple[BytesIO, str]:
    return BytesIO(content.encode()), name


def test_import_css_templates(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    """Uploading CSS files creates one template per file."""
    response = client.post(
        IMPORT_URL,
        data={
            "formData": [
                css_file("dark_mode.css", ".dashboard { background: #000; }"),
                css_file("light_mode.css", ".dashboard { background: #fff; }"),
            ]
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.json == {"message": "Imported 2 CSS templates"}
    saved = {
        template.template_name: template.css
        for template in session_with_schema.query(CssTemplate).all()
    }
    assert saved == {
        "dark_mode": ".dashboard { background: #000; }",
        "light_mode": ".dashboard { background: #fff; }",
    }


def test_import_css_templates_with_duplicate_names(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    """Files sharing a name are all imported."""
    response = client.post(
        IMPORT_URL,
        data={
            "formData": [
                css_file("theme.css", "h1 { color: red; }"),
                css_file("theme.css", "h1 { color: blue; }"),
            ]
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.json == {"message": "Imported 2 CSS templates"}
    assert (
        session_with_schema.query(CssTemplate).filter_by(template_name="theme").count()
        == 2
    )


def test_import_css_templates_single_file_message(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    response = client.post(
        IMPORT_URL,
        data={"formData": css_file("theme.css", "h1 { color: red; }")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.json == {"message": "Imported 1 CSS template"}


def test_import_css_templates_requires_a_file(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    response = client.post(
        IMPORT_URL,
        data={},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.json == {"message": "At least one CSS file is required"}


def test_import_css_templates_requires_form_data(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    response = client.post(IMPORT_URL, json={"css": "h1 { color: red; }"})

    assert response.status_code == 400


def test_import_css_templates_rejects_non_css_file(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    response = client.post(
        IMPORT_URL,
        data={"formData": css_file("theme.yaml", "template_name: theme")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    assert response.json["errors"][0]["message"] == "File theme.yaml is not a CSS file"
    assert session_with_schema.query(CssTemplate).count() == 0


def test_import_css_templates_rejects_dangerous_css(
    client: Any,
    full_api_access: None,
    can_write: None,
    session_with_schema: Session,
) -> None:
    """One invalid file fails the whole upload and nothing is saved."""
    response = client.post(
        IMPORT_URL,
        data={
            "formData": [
                css_file("valid.css", "h1 { color: red; }"),
                css_file("evil.css", "div { width: expression(alert(1)); }"),
            ]
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    error = response.json["errors"][0]
    assert error["message"].startswith("Error importing CSS templates: evil.css")
    assert "evil.css" in error["extra"]
    assert session_with_schema.query(CssTemplate).count() == 0


def test_import_css_templates_forbidden(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """A user without permission to create CSS templates gets a 403."""
    mocker.patch(
        "superset.commands.css.import_templates.security_manager.can_access",
        return_value=False,
    )

    response = client.post(
        IMPORT_URL,
        data={"formData": css_file("theme.css", "h1 { color: red; }")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 403
    assert session_with_schema.query(CssTemplate).count() == 0
