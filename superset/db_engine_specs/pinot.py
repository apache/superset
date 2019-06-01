from typing import Dict, Optional

from sqlalchemy.sql.expression import ColumnClause

from superset.db_engine_specs.base import BaseEngineSpec, TimestampExpression


class PinotEngineSpec(BaseEngineSpec):
    engine = 'pinot'
    allows_subquery = False
    inner_joins = False
    supports_column_aliases = False

    # Pinot does its own conversion below
    time_grain_functions: Dict[Optional[str], str] = {
        'PT1S': '1:SECONDS',
        'PT1M': '1:MINUTES',
        'PT1H': '1:HOURS',
        'P1D': '1:DAYS',
        'P1W': '1:WEEKS',
        'P1M': '1:MONTHS',
        'P0.25Y': '3:MONTHS',
        'P1Y': '1:YEARS',
    }

    @classmethod
    def get_timestamp_expr(cls, col: ColumnClause, pdf: Optional[str],
                           time_grain: Optional[str]) -> TimestampExpression:
        is_epoch = pdf in ('epoch_s', 'epoch_ms')
        if not is_epoch:
            raise NotImplementedError('Pinot currently only supports epochs')
        # The DATETIMECONVERT pinot udf is documented at
        # Per https://github.com/apache/incubator-pinot/wiki/dateTimeConvert-UDF
        # We are not really converting any time units, just bucketing them.
        seconds_or_ms = 'MILLISECONDS' if pdf == 'epoch_ms' else 'SECONDS'
        tf = f'1:{seconds_or_ms}:EPOCH'
        granularity = cls.time_grain_functions.get(time_grain)
        if not granularity:
            raise NotImplementedError('No pinot grain spec for ' + str(time_grain))
        # In pinot the output is a string since there is no timestamp column like pg
        time_expr = f'DATETIMECONVERT({{col}}, "{tf}", "{tf}", "{granularity}")'
        return TimestampExpression(time_expr, col)

    @classmethod
    def make_select_compatible(cls, groupby_exprs, select_exprs):
        # Pinot does not want the group by expr's to appear in the select clause
        select_sans_groupby = []
        # We want identity and not equality, so doing the filtering manually
        for s in select_exprs:
            for gr in groupby_exprs:
                if s is gr:
                    break
            else:
                select_sans_groupby.append(s)
        return select_sans_groupby
