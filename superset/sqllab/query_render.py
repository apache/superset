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
from __future__ import annotations
from typing import Callable, TYPE_CHECKING

from flask_babel import gettext as __, ngettext
from jinja2 import TemplateError

from superset import is_feature_enabled
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetTemplateParamsErrorException
from superset.sqllab.commands.execute_sql_json_command import SqlQueryRender
from superset.utils.core import QueryStatus
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.sqllab.execution_context import SqlJsonExecutionContext
    from superset.jinja_context import BaseTemplateProcessor

PARAMETER_MISSING_ERR = (
    "Please check your template parameters for syntax errors and make sure "
    "they match across your SQL query and Set Parameters. Then, try running "
    "your query again."
)


class SqlQueryRenderImpl(SqlQueryRender):
    _sql_template_processor_factory: Callable[..., BaseTemplateProcessor]

    def __init__(self, sql_template_processor_factory: Callable[..., BaseTemplateProcessor]) -> None:
        self._sql_template_processor_factory = sql_template_processor_factory

    def render(self, execution_context: SqlJsonExecutionContext) -> str:
        query_model = execution_context.query
        try:
            sql_template_processor = self._sql_template_processor_factory(
                database=query_model.database, query=query_model)

            rendered_query = sql_template_processor.process_template(
                query_model.sql, **execution_context.template_params
            )
            if is_feature_enabled("ENABLE_TEMPLATE_PROCESSING"):
                # pylint: disable=protected-access
                ast = sql_template_processor._env.parse(rendered_query)
                undefined_parameters = find_undeclared_variables(ast)  # type: ignore
                if undefined_parameters:
                    query_model.status = QueryStatus.FAILED
                    raise SupersetTemplateParamsErrorException(
                        message=ngettext(
                            "The parameter %(parameters)s in your query is undefined.",
                            "The following parameters in your query are undefined: %(parameters)s.",
                            len(undefined_parameters),
                            parameters=utils.format_list(undefined_parameters),
                        )
                                + " "
                                + PARAMETER_MISSING_ERR,
                        error=SupersetErrorType.MISSING_TEMPLATE_PARAMS_ERROR,
                        extra={
                            "undefined_parameters": list(undefined_parameters),
                            "template_parameters": execution_context.template_params,
                        },
                    )

            return rendered_query
        except TemplateError as ex:
            query_model.status = QueryStatus.FAILED
            raise SupersetTemplateParamsErrorException(
                message=__(
                    'The query contains one or more malformed template parameters. Please check your query and confirm that all template parameters are surround by double braces, for example, "{{ ds }}". Then, try running your query again.'
                ),
                error=SupersetErrorType.INVALID_TEMPLATE_PARAMS_ERROR,
            ) from ex
