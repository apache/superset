from superset.db_engine_specs.base import LimitMethod
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class OracleEngineSpec(PostgresBaseEngineSpec):
    engine = 'oracle'
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'CAST({col} as DATE)',
        'PT1M': "TRUNC(CAST({col} as DATE), 'MI')",
        'PT1H': "TRUNC(CAST({col} as DATE), 'HH')",
        'P1D': "TRUNC(CAST({col} as DATE), 'DDD')",
        'P1W': "TRUNC(CAST({col} as DATE), 'WW')",
        'P1M': "TRUNC(CAST({col} as DATE), 'MONTH')",
        'P0.25Y': "TRUNC(CAST({col} as DATE), 'Q')",
        'P1Y': "TRUNC(CAST({col} as DATE), 'YEAR')",
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return (
            """TO_TIMESTAMP('{}', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')"""
        ).format(dttm.isoformat())
