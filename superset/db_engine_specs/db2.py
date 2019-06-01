from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod


class Db2EngineSpec(BaseEngineSpec):
    engine = 'ibm_db_sa'
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'CAST({col} as TIMESTAMP)'
                ' - MICROSECOND({col}) MICROSECONDS',
        'PT1M': 'CAST({col} as TIMESTAMP)'
                ' - SECOND({col}) SECONDS'
                ' - MICROSECOND({col}) MICROSECONDS',
        'PT1H': 'CAST({col} as TIMESTAMP)'
                ' - MINUTE({col}) MINUTES'
                ' - SECOND({col}) SECONDS'
                ' - MICROSECOND({col}) MICROSECONDS ',
        'P1D': 'CAST({col} as TIMESTAMP)'
               ' - HOUR({col}) HOURS'
               ' - MINUTE({col}) MINUTES'
               ' - SECOND({col}) SECONDS'
               ' - MICROSECOND({col}) MICROSECONDS',
        'P1W': '{col} - (DAYOFWEEK({col})) DAYS',
        'P1M': '{col} - (DAY({col})-1) DAYS',
        'P0.25Y': '{col} - (DAY({col})-1) DAYS'
                  ' - (MONTH({col})-1) MONTHS'
                  ' + ((QUARTER({col})-1) * 3) MONTHS',
        'P1Y': '{col} - (DAY({col})-1) DAYS'
               ' - (MONTH({col})-1) MONTHS',
    }

    @classmethod
    def epoch_to_dttm(cls):
        return "(TIMESTAMP('1970-01-01', '00:00:00') + {col} SECONDS)"

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d-%H.%M.%S'))
