from superset.db_engine_specs.base import BaseEngineSpec


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = 'impala'

    time_grain_functions = {
        None: '{col}',
        'PT1M': "TRUNC({col}, 'MI')",
        'PT1H': "TRUNC({col}, 'HH')",
        'P1D': "TRUNC({col}, 'DD')",
        'P1W': "TRUNC({col}, 'WW')",
        'P1M': "TRUNC({col}, 'MONTH')",
        'P0.25Y': "TRUNC({col}, 'Q')",
        'P1Y': "TRUNC({col}, 'YYYY')",
    }

    @classmethod
    def epoch_to_dttm(cls):
        return 'from_unixtime({col})'

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "'{}'".format(dttm.strftime('%Y-%m-%d'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def get_schema_names(cls, inspector):
        schemas = [row[0] for row in inspector.engine.execute('SHOW SCHEMAS')
                   if not row[0].startswith('_')]
        return schemas
