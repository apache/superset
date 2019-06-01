from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod


class TeradataEngineSpec(BaseEngineSpec):
    """Dialect for Teradata DB."""
    engine = 'teradata'
    limit_method = LimitMethod.WRAP_SQL
    max_column_name_length = 30  # since 14.10 this is 128

    time_grain_functions = {
        None: '{col}',
        'PT1M': "TRUNC(CAST({col} as DATE), 'MI')",
        'PT1H': "TRUNC(CAST({col} as DATE), 'HH')",
        'P1D': "TRUNC(CAST({col} as DATE), 'DDD')",
        'P1W': "TRUNC(CAST({col} as DATE), 'WW')",
        'P1M': "TRUNC(CAST({col} as DATE), 'MONTH')",
        'P0.25Y': "TRUNC(CAST({col} as DATE), 'Q')",
        'P1Y': "TRUNC(CAST({col} as DATE), 'YEAR')",
    }
