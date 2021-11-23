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
# pylint: disable=invalid-name, no-self-use, too-few-public-methods, too-many-arguments
from __future__ import annotations

from typing import Any, Callable, Dict, Optional, TYPE_CHECKING

from flask_babel import gettext as __, ngettext
from jinja2 import TemplateError
from jinja2.meta import find_undeclared_variables

from superset import is_feature_enabled
from superset.errors import SupersetErrorType
from superset.sqllab.command import SqlQueryRender
from superset.sqllab.exceptions import SqlLabException
from superset.utils import core as utils

MSG_OF_1006 = "Issue 1006 - One or more parameters specified in the query are missing."

if TYPE_CHECKING:
    from superset.jinja_context import BaseTemplateProcessor
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext

PARAMETER_MISSING_ERR = (
    "Please check your template parameters for syntax errors and make sure "
    "they match across your SQL query and Set Parameters. Then, try running "
    "your query again."
)


class SqlQueryRenderImpl(SqlQueryRender):
    _sql_template_processor_factory: Callable[..., BaseTemplateProcessor]

    def __init__(
        self, sql_template_factory: Callable[..., BaseTemplateProcessor]
    ) -> None:

        self._sql_template_processor_factory = sql_template_factory  # type: ignore

    def render(self, execution_context: SqlJsonExecutionContext) -> str:
        query_model = execution_context.query
        try:
            sql_template_processor = self._sql_template_processor_factory(
                database=query_model.database, query=query_model
            )

            rendered_query = sql_template_processor.process_template(
                query_model.sql, **execution_context.template_params
            )
            self._validate(execution_context, rendered_query, sql_template_processor)
            return rendered_query
        except TemplateError as ex:
            self._raise_template_exception(ex, execution_context)
            return "NOT_REACHABLE_CODE"

    def _validate(
        self,
        execution_context: SqlJsonExecutionContext,
        rendered_query: str,
        sql_template_processor: BaseTemplateProcessor,
    ) -> None:
        if is_feature_enabled("ENABLE_TEMPLATE_PROCESSING"):
            # pylint: disable=protected-access
            syntax_tree = sql_template_processor._env.parse(rendered_query)
            undefined_parameters = find_undeclared_variables(  # type: ignore
                syntax_tree
            )
            if undefined_parameters:
                self._raise_undefined_parameter_exception(
                    execution_context, undefined_parameters
                )

    def _raise_undefined_parameter_exception(
        self, execution_context: SqlJsonExecutionContext, undefined_parameters: Any
    ) -> None:
        raise SqlQueryRenderException(
            sql_json_execution_context=execution_context,
            error_type=SupersetErrorType.MISSING_TEMPLATE_PARAMS_ERROR,
            reason_message=ngettext(
                "The parameter %(parameters)s in your query is undefined.",
                "The following parameters in your query are undefined: %(parameters)s.",
                len(undefined_parameters),
                parameters=utils.format_list(undefined_parameters),
            ),
            suggestion_help_msg=PARAMETER_MISSING_ERR,
            extra={
                "undefined_parameters": list(undefined_parameters),
                "template_parameters": execution_context.template_params,
                "issue_codes": [{"code": 1006, "message": MSG_OF_1006,}],
            },
        )

    def _raise_template_exception(
        self, ex: Exception, execution_context: SqlJsonExecutionContext
    ) -> None:
        raise SqlQueryRenderException(
            sql_json_execution_context=execution_context,
            error_type=SupersetErrorType.INVALID_TEMPLATE_PARAMS_ERROR,
            reason_message=__(
                "The query contains one or more malformed template parameters."
            ),
            suggestion_help_msg=__(
                "Please check your query and confirm that all template "
                "parameters are surround by double braces, for example, "
                '"{{ ds }}". Then, try running your query again.'
            ),
        ) from ex


class SqlQueryRenderException(SqlLabException):
    _extra: Optional[Dict[str, Any]]

    def __init__(
        self,
        sql_json_execution_context: SqlJsonExecutionContext,
        error_type: SupersetErrorType,
        reason_message: Optional[str] = None,
        exception: Optional[Exception] = None,
        suggestion_help_msg: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            sql_json_execution_context,
            error_type,
            reason_message,
            exception,
            suggestion_help_msg,
        )
        self._extra = extra

    @property
    def extra(self) -> Optional[Dict[str, Any]]:
        return self._extra

    def to_dict(self) -> Dict[str, Any]:
        rv = super().to_dict()
        if self._extra:
            rv["extra"] = self._extra
        return rv
