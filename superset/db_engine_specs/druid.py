from superset.db_engine_specs.base import BaseEngineSpec


class DruidEngineSpec(BaseEngineSpec):
    """Engine spec for Druid.io"""
    engine = 'druid'
    inner_joins = False
    allows_subquery = False

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'FLOOR({col} TO SECOND)',
        'PT1M': 'FLOOR({col} TO MINUTE)',
        'PT1H': 'FLOOR({col} TO HOUR)',
        'P1D': 'FLOOR({col} TO DAY)',
        'P1W': 'FLOOR({col} TO WEEK)',
        'P1M': 'FLOOR({col} TO MONTH)',
        'P0.25Y': 'FLOOR({col} TO QUARTER)',
        'P1Y': 'FLOOR({col} TO YEAR)',
    }

    @classmethod
    def alter_new_orm_column(cls, orm_col):
        if orm_col.column_name == '__time':
            orm_col.is_dttm = True
