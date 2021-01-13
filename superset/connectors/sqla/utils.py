from typing import Any, Dict, List

from flask_babel import lazy_gettext as _
from sqlalchemy import or_
from sqlalchemy.sql.expression import Label

from superset.constants import NULL_STRING
from superset.exceptions import QueryObjectValidationError
from superset.utils.core import cast_to_num, FilterOperator


def get_expected_labels_from_select(select_expressions: List[Label]) -> List[str]:
    return [
        c._df_label_expected  # pylint: disable=protected-access
        for c in select_expressions
    ]


def get_where_operation(  # pylint:disable=too-many-branches
    flt: Dict[str, Any], operation: str, col_obj: Any, value: Any
) -> Any:
    if operation in (FilterOperator.IN.value, FilterOperator.NOT_IN.value,):
        cond = col_obj.get_sqla_col().in_(value)
        if isinstance(value, str) and NULL_STRING in value:
            cond = or_(
                cond,
                col_obj.get_sqla_col() == None,  # pylint: disable=singleton-comparison
            )
        if operation == FilterOperator.NOT_IN.value:
            cond = ~cond
        # where_clause.append(cond)
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
