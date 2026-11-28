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

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.session import Session

from superset.commands.css.exceptions import (
    CssTemplateForbiddenError,
    CssTemplateImportError,
    CssTemplateInvalidError,
)
from superset.commands.css.importers.dispatcher import ImportCssTemplatesCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError
from superset.models.core import CssTemplate


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


def test_import_creates_template_from_css_file(
    session_with_schema: Session, can_write: None
) -> None:
    """A CSS file becomes a template named after the file, holding its CSS."""
    templates = ImportCssTemplatesCommand(
        [("dark_mode.css", ".dashboard { background: #000; }")]
    ).run()

    assert len(templates) == 1
    saved = session_with_schema.query(CssTemplate).one()
    assert saved.template_name == "dark_mode"
    assert saved.css == ".dashboard { background: #000; }"
    assert saved.uuid is not None


def test_import_creates_one_template_per_file(
    session_with_schema: Session, can_write: None
) -> None:
    """Each uploaded file is imported as its own template."""
    ImportCssTemplatesCommand(
        [
            ("first.css", "h1 { color: red; }"),
            ("second.css", "h2 { color: blue; }"),
        ]
    ).run()

    saved = {
        template.template_name: template.css
        for template in session_with_schema.query(CssTemplate).all()
    }
    assert saved == {"first": "h1 { color: red; }", "second": "h2 { color: blue; }"}


def test_import_keeps_files_with_duplicate_names(
    session_with_schema: Session, can_write: None
) -> None:
    """Files sharing a name are all imported rather than collapsed into one."""
    ImportCssTemplatesCommand(
        [
            ("theme.css", "h1 { color: red; }"),
            ("theme.css", "h1 { color: blue; }"),
        ]
    ).run()

    saved = session_with_schema.query(CssTemplate).all()
    assert [template.template_name for template in saved] == ["theme", "theme"]
    assert {template.css for template in saved} == {
        "h1 { color: red; }",
        "h1 { color: blue; }",
    }
    assert len({template.uuid for template in saved}) == 2


def test_import_does_not_overwrite_existing_template(
    session_with_schema: Session, can_write: None
) -> None:
    """Importing a file named like an existing template adds a new template."""
    session_with_schema.add(CssTemplate(template_name="theme", css="p { margin: 0; }"))
    session_with_schema.flush()

    ImportCssTemplatesCommand([("theme.css", "p { margin: 1px; }")]).run()

    saved = session_with_schema.query(CssTemplate).filter_by(template_name="theme")
    assert {template.css for template in saved} == {
        "p { margin: 0; }",
        "p { margin: 1px; }",
    }


def test_import_requires_write_permission(
    session_with_schema: Session, mocker: MockerFixture
) -> None:
    """A user who can't create CSS templates can't import them either."""
    can_access = mocker.patch(
        "superset.commands.css.import_templates.security_manager.can_access",
        return_value=False,
    )

    with pytest.raises(CssTemplateForbiddenError):
        ImportCssTemplatesCommand([("theme.css", "h1 { color: red; }")]).run()

    can_access.assert_called_once_with("can_write", "CssTemplate")
    assert session_with_schema.query(CssTemplate).count() == 0


def test_import_requires_at_least_one_file(
    session_with_schema: Session, can_write: None
) -> None:
    with pytest.raises(CssTemplateInvalidError):
        ImportCssTemplatesCommand([]).run()


def test_import_rejects_empty_css(
    session_with_schema: Session, can_write: None
) -> None:
    with pytest.raises(CssTemplateInvalidError) as excinfo:
        ImportCssTemplatesCommand([("empty.css", "")]).run()

    assert excinfo.value.normalized_messages() == {
        "empty.css": {"css": ["CSS file is empty."]}
    }


@pytest.mark.parametrize(
    "css",
    [
        "div { width: expression(alert(1)); }",
        "div { background: url(javascript:alert(1)); }",
        "@import url('https://example.com/evil.css');",
    ],
)
def test_import_rejects_dangerous_css(
    session_with_schema: Session, can_write: None, css: str
) -> None:
    """Imported CSS goes through the same hardening as dashboard CSS."""
    with pytest.raises(CssTemplateInvalidError) as excinfo:
        ImportCssTemplatesCommand([("evil.css", css)]).run()

    assert "evil.css" in excinfo.value.normalized_messages()
    assert session_with_schema.query(CssTemplate).count() == 0


def test_import_rejects_template_name_too_long(
    session_with_schema: Session, can_write: None
) -> None:
    """A file name longer than the template_name column is rejected."""
    file_name = f"{'a' * 251}.css"

    with pytest.raises(CssTemplateInvalidError) as excinfo:
        ImportCssTemplatesCommand([(file_name, "h1 { color: red; }")]).run()

    assert file_name in excinfo.value.normalized_messages()


def test_import_rejects_empty_template_name(
    session_with_schema: Session, can_write: None
) -> None:
    """A file named only ``.css`` would produce an empty template name."""
    with pytest.raises(CssTemplateInvalidError):
        ImportCssTemplatesCommand([(".css", "h1 { color: red; }")]).run()


def test_import_is_all_or_nothing(
    session_with_schema: Session, can_write: None
) -> None:
    """One invalid file prevents every file in the upload from being imported."""
    with pytest.raises(CssTemplateInvalidError) as excinfo:
        ImportCssTemplatesCommand(
            [
                ("valid.css", "h1 { color: red; }"),
                ("evil.css", "div { width: expression(alert(1)); }"),
                ("empty.css", ""),
            ]
        ).run()

    assert set(excinfo.value.normalized_messages()) == {"evil.css", "empty.css"}
    assert session_with_schema.query(CssTemplate).count() == 0


def test_import_wraps_database_errors(
    session_with_schema: Session, can_write: None, mocker: MockerFixture
) -> None:
    """A database failure while saving is surfaced as an import error."""
    mocker.patch(
        "superset.commands.css.import_templates.CssTemplateDAO.create",
        side_effect=SQLAlchemyError("boom"),
    )

    with pytest.raises(CssTemplateImportError):
        ImportCssTemplatesCommand([("theme.css", "h1 { color: red; }")]).run()


def test_dispatcher_rejects_unhandled_contents(mocker: MockerFixture) -> None:
    """If no command version can handle the files, the import is invalid."""
    unhandled = mocker.MagicMock()
    unhandled.return_value.run.side_effect = IncorrectVersionError()
    mocker.patch(
        "superset.commands.css.importers.dispatcher.command_versions", [unhandled]
    )

    with pytest.raises(CommandInvalidError):
        ImportCssTemplatesCommand([("theme.css", "h1 { color: red; }")]).run()
