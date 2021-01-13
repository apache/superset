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
from typing import Any, Dict, List

import sqlalchemy as sa
from flask_babel import lazy_gettext as _
from jinja2.exceptions import TemplateError
from sqlalchemy import or_
from sqlalchemy.sql.expression import BooleanClauseList, Label

from superset.constants import NULL_STRING
from superset.exceptions import QueryObjectValidationError
from superset.jinja_context import BaseTemplateProcessor
from superset.utils.core import cast_to_num, FilterOperator


def get_having_clause(
    extra_having: Any, template_processor: BaseTemplateProcessor
) -> List[BooleanClauseList]:
    """
    generate complete having clause from extra arg 'have'
    """
    having_clause = []
    if extra_having:
        try:
            having = template_processor.process_template(extra_having)
        except TemplateError as ex:
            raise QueryObjectValidationError(
                _(
                    "Error in jinja expression in HAVING clause: %(msg)s",
                    msg=ex.message,
                )
            )
        having_clause += [sa.text("({})".format(having))]
    return having_clause


def get_expected_labels_from_select(select_expressions: List[Label]) -> List[str]:
    return [
        c._df_label_expected  # pylint: disable=protected-access
        for c in select_expressions
    ]


def get_where_operation(  # pylint:disable=too-many-branches
    flt: Dict[str, Any], operation: str, col_obj: Any, value: Any
) -> Any:
    if operation in (FilterOperator.IN.value, FilterOperator.NOT_IN.value,):
        condition = col_obj.get_sqla_col().in_(value)
        if isinstance(value, str) and NULL_STRING in value:
            condition = or_(
                condition,
                col_obj.get_sqla_col() == None,  # pylint: disable=singleton-comparison
            )
        if operation == FilterOperator.NOT_IN.value:
            condition = ~condition
    else:
        if col_obj.is_numeric:
            value = cast_to_num(flt["val"])

        if operation == FilterOperator.EQUALS.value:
            condition = col_obj.get_sqla_col() == value
        elif operation == FilterOperator.NOT_EQUALS.value:
            condition = col_obj.get_sqla_col() != value
        elif operation == FilterOperator.GREATER_THAN.value:
            condition = col_obj.get_sqla_col() > value
        elif operation == FilterOperator.LESS_THAN.value:
            condition = col_obj.get_sqla_col() < value
        elif operation == FilterOperator.GREATER_THAN_OR_EQUALS.value:
            condition = col_obj.get_sqla_col() >= value
        elif operation == FilterOperator.LESS_THAN_OR_EQUALS.value:
            condition = col_obj.get_sqla_col() <= value
        elif operation == FilterOperator.LIKE.value:
            condition = col_obj.get_sqla_col().like(value)
        elif operation == FilterOperator.IS_NULL.value:
            condition = (
                col_obj.get_sqla_col() == None  # pylint: disable=singleton-comparison
            )
        elif operation == FilterOperator.IS_NOT_NULL.value:
            condition = (
                col_obj.get_sqla_col() != None  # pylint: disable=singleton-comparison
            )
        else:
            raise QueryObjectValidationError(
                _("Invalid filter operation type: %(op)s", op=operation,)
            )
    return condition
