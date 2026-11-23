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
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.commands.css.exceptions import CssTemplateNotFoundError
from superset.commands.css.export_css import ExportCssTemplatesCommand
from superset.commands.export.models import METADATA_FILE_NAME
from superset.models.core import CssTemplate
from superset.utils.dict_import_export import EXPORT_VERSION

TEMPLATE_UUID = UUID("2f8a1b6e-6d1c-4c3b-9b3e-0a8f6a3d2c11")
CSS = ".dashboard-header {\n  color: red;\n}\n"


def _template(template_name: str = "My Template") -> CssTemplate:
    return CssTemplate(id=1, template_name=template_name, css=CSS, uuid=TEMPLATE_UUID)


def _export_css_files(mocker: MockerFixture, template: CssTemplate) -> dict[str, str]:
    mocker.patch(
        "superset.commands.css.export_css.CssTemplateDAO.find_by_ids",
        return_value=[template],
    )
    return {
        name: content()
        for name, content in ExportCssTemplatesCommand([template.id]).run()
        if name != METADATA_FILE_NAME
    }


def test_export_css_template_header_then_css(mocker: MockerFixture) -> None:
    files = _export_css_files(mocker, _template())

    assert list(files) == ["My_Template.css"]
    expected_header = (
        "/*\n"
        " * template_name: My Template\n"
        f" * uuid: {TEMPLATE_UUID}\n"
        f" * version: {EXPORT_VERSION}\n"
        " */\n"
    )
    assert files["My_Template.css"] == expected_header + CSS


def test_export_css_template_name_cannot_close_header(
    mocker: MockerFixture,
) -> None:
    files = _export_css_files(mocker, _template("evil */ body{display:none}"))

    content = next(iter(files.values()))
    header, css = content.split(" */\n", 1)
    assert "*/" not in header
    assert css == CSS


def test_export_css_template_not_found(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.css.export_css.CssTemplateDAO.find_by_ids",
        return_value=[],
    )
    with pytest.raises(CssTemplateNotFoundError):
        list(ExportCssTemplatesCommand([1]).run())
