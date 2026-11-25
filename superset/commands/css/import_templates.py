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
import logging
from functools import partial
from typing import Any

from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.css.exceptions import (
    CssTemplateForbiddenError,
    CssTemplateImportError,
    CssTemplateInvalidError,
)
from superset.css_templates.schemas import ImportV1CssTemplateSchema
from superset.css_templates.utils import get_template_name
from superset.daos.css import CssTemplateDAO
from superset.models.core import CssTemplate
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class ImportCssTemplatesCommand(BaseCommand):
    """
    Import CSS templates from CSS files.

    Each file becomes a new CSS template named after the file (without its
    ``.css`` extension), with the file's contents as the template's CSS. Every
    file is imported as a new template, so files sharing a name produce
    separate templates rather than overwriting each other or existing ones.

    The import is all-or-nothing: if any file is invalid, no templates are
    created.
    """

    def __init__(self, contents: list[tuple[str, str]], *args: Any, **kwargs: Any):
        """
        :param contents: ``(file_name, css)`` pairs, one per uploaded file. A
            list rather than a dict so that files sharing a name are kept.
        """
        self.contents = contents
        self._configs: list[dict[str, Any]] = []

    @transaction(on_error=partial(on_error, reraise=CssTemplateImportError))
    def run(self) -> list[CssTemplate]:
        self.validate()
        return [CssTemplateDAO.create(attributes=config) for config in self._configs]

    def validate(self) -> None:
        if not security_manager.can_access("can_write", "CssTemplate"):
            raise CssTemplateForbiddenError()

        if not self.contents:
            raise CssTemplateInvalidError(
                "No CSS files were provided",
                [ValidationError("At least one CSS file is required.")],
            )

        schema = ImportV1CssTemplateSchema()
        exceptions: list[ValidationError] = []
        error_summaries: list[str] = []
        configs: list[dict[str, Any]] = []
        for file_name, css in self.contents:
            try:
                configs.append(
                    schema.load(
                        {"template_name": get_template_name(file_name), "css": css}
                    )
                )
            except ValidationError as ex:
                logger.warning("Validation failed for %s: %s", file_name, ex.messages)
                exceptions.append(ValidationError({file_name: ex.messages}))
                error_summaries.append(f"{file_name}: {ex.messages}")

        if exceptions:
            raise CssTemplateInvalidError(
                f"Error importing CSS templates: {'; '.join(error_summaries)}",
                exceptions,
            )

        self._configs = configs
