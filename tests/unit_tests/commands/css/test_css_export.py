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
from io import BytesIO
from typing import Any
from zipfile import ZipFile

import pytest
from sqlalchemy.orm import Session

from superset.commands.css.exceptions import CssTemplateNotFoundError
from superset.commands.css.export_css import ExportCssTemplatesCommand
from superset.models.core import CssTemplate


def _create_templates(session: Session) -> list[CssTemplate]:
    CssTemplate.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    templates = [
        CssTemplate(template_name="Light", css=".a { color: white; }"),
        CssTemplate(template_name="Dark", css=".a { color: black; }"),
        CssTemplate(template_name="Unused", css=""),
    ]
    session.add_all(templates)
    session.flush()
    return templates


def test_export_css_templates_returns_requested_models(session: Session) -> None:
    light, dark, _ = _create_templates(session)

    models = ExportCssTemplatesCommand([light.id, dark.id]).run()

    assert sorted(model.id for model in models) == sorted([light.id, dark.id])
    assert {model.css for model in models} == {light.css, dark.css}


def test_export_css_templates_missing_id_raises(session: Session) -> None:
    light, *_ = _create_templates(session)

    with pytest.raises(CssTemplateNotFoundError):
        ExportCssTemplatesCommand([light.id, 999_999]).run()


def test_export_css_templates_ignores_duplicate_ids(session: Session) -> None:
    light, *_ = _create_templates(session)

    models = ExportCssTemplatesCommand([light.id, light.id]).run()

    assert [model.id for model in models] == [light.id]


def _export_zip_names(client: Any, ids: list[int]) -> set[str]:
    """Call the export endpoint and return the file names inside the archive."""
    rison_ids = ",".join(str(model_id) for model_id in ids)
    response = client.get(f"/api/v1/css_template/export/?q=!({rison_ids})")
    assert response.status_code == 200
    assert response.mimetype == "application/zip"
    with ZipFile(BytesIO(response.data)) as bundle:
        # Entries live under a timestamped root directory.
        return {name.split("/", 1)[1] for name in bundle.namelist()}


def test_export_zip_numbers_duplicate_template_names(
    client: Any, full_api_access: None, session: Session
) -> None:
    CssTemplate.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    templates = [CssTemplate(template_name="Dark", css=f".a{i} {{}}") for i in range(3)]
    session.add_all(templates)
    session.flush()

    names = _export_zip_names(client, [template.id for template in templates])

    assert names == {"Dark.css", "Dark (1).css", "Dark (2).css"}


def test_export_zip_numbers_names_that_differ_only_by_case(
    client: Any, full_api_access: None, session: Session
) -> None:
    """Case-insensitive filesystems would extract these to the same path."""
    CssTemplate.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    templates = [
        CssTemplate(template_name="Theme", css=".upper {}"),
        CssTemplate(template_name="theme", css=".lower {}"),
    ]
    session.add_all(templates)
    session.flush()

    names = _export_zip_names(client, [template.id for template in templates])

    assert len({name.casefold() for name in names}) == 2
    assert len(names) == 2


def test_export_zip_keeps_all_entries_when_names_differ_only_by_sanitizing(
    client: Any, full_api_access: None, session: Session
) -> None:
    """Sanitized names must never overwrite another template's entry."""
    CssTemplate.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    templates = [
        CssTemplate(template_name="Dark", css=""),
        CssTemplate(template_name="Dark", css=""),
        CssTemplate(template_name="Dark (1)", css=""),
    ]
    session.add_all(templates)
    session.flush()

    names = _export_zip_names(client, [template.id for template in templates])

    assert len(names) == 3
    assert {"Dark.css", "Dark (1).css"} <= names


def test_export_zip_numbered_name_does_not_collide_with_id_fallback(
    client: Any, full_api_access: None, session: Session
) -> None:
    """A name with no usable characters falls back to its id, which can match
    another template's name; the second one must be numbered, not overwritten."""
    CssTemplate.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    unnamed = CssTemplate(template_name="日本", css=".unnamed {}")
    session.add(unnamed)
    session.flush()
    clashing = CssTemplate(template_name=str(unnamed.id), css=".clashing {}")
    session.add(clashing)
    session.flush()

    names = _export_zip_names(client, [unnamed.id, clashing.id])

    assert names == {f"{unnamed.id}.css", f"{unnamed.id} (1).css"}


def test_export_single_template_returns_css(
    client: Any, full_api_access: None, session: Session
) -> None:
    CssTemplate.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    template = CssTemplate(template_name="Dark", css=".a { color: black; }")
    session.add(template)
    session.flush()

    response = client.get(f"/api/v1/css_template/export/?q=!({template.id})")

    assert response.status_code == 200
    assert response.data.decode() == template.css
