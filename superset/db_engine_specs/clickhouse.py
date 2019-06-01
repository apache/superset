from superset.db_engine_specs.base import BaseEngineSpec


class ClickHouseEngineSpec(BaseEngineSpec):
    """Dialect for ClickHouse analytical DB."""

    engine = 'clickhouse'

    time_secondary_columns = True
    time_groupby_inline = True

    time_grain_functions = {
        None: '{col}',
        'PT1M': 'toStartOfMinute(toDateTime({col}))',
        'PT5M': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 300)*300)',
        'PT10M': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 600)*600)',
        'PT15M': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 900)*900)',
        'PT0.5H': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 1800)*1800)',
        'PT1H': 'toStartOfHour(toDateTime({col}))',
        'P1D': 'toStartOfDay(toDateTime({col}))',
        'P1W': 'toMonday(toDateTime({col}))',
        'P1M': 'toStartOfMonth(toDateTime({col}))',
        'P0.25Y': 'toStartOfQuarter(toDateTime({col}))',
        'P1Y': 'toStartOfYear(toDateTime({col}))',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "toDate('{}')".format(dttm.strftime('%Y-%m-%d'))
        if tt == 'DATETIME':
            return "toDateTime('{}')".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))
