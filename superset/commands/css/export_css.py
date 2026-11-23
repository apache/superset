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
from typing import Callable

from superset.commands.css.exceptions import CssTemplateNotFoundError
from superset.commands.export.models import ExportModelsCommand
from superset.css_templates.utils import comment_safe
from superset.daos.css import CssTemplateDAO
from superset.models.core import CssTemplate
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename


class ExportCssTemplatesCommand(ExportModelsCommand):
    """Export CSS templates as plain, directly usable ``.css`` files.

    Each file starts with a comment header carrying the template's name, UUID
    and export version, followed by the template's CSS unchanged.
    """

    dao = CssTemplateDAO
    not_found = CssTemplateNotFoundError

    @staticmethod
    def _file_name(model: CssTemplate) -> str:
        file_name = get_filename(model.template_name or "", model.id, skip_id=True)
        return f"{file_name}.css"

    @staticmethod
    def _file_content(model: CssTemplate) -> str:
        header = (
            "/*\n"
            f" * template_name: {comment_safe(model.template_name or '')}\n"
            f" * uuid: {model.uuid}\n"
            f" * version: {EXPORT_VERSION}\n"
            " */\n"
        )
        return header + (model.css or "")

    @staticmethod
    def _export(
        model: CssTemplate, export_related: bool = True, seen: set[str] | None = None
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield (
            ExportCssTemplatesCommand._file_name(model),
            lambda: ExportCssTemplatesCommand._file_content(model),
        )
