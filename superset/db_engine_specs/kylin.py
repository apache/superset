from superset.db_engine_specs.base import BaseEngineSpec


class KylinEngineSpec(BaseEngineSpec):
    """Dialect for Apache Kylin"""

    engine = 'kylin'

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO SECOND) AS TIMESTAMP)',
        'PT1M': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO MINUTE) AS TIMESTAMP)',
        'PT1H': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO HOUR) AS TIMESTAMP)',
        'P1D': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO DAY) AS DATE)',
        'P1W': 'CAST(TIMESTAMPADD(WEEK, WEEK(CAST({col} AS DATE)) - 1, \
               FLOOR(CAST({col} AS TIMESTAMP) TO YEAR)) AS DATE)',
        'P1M': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO MONTH) AS DATE)',
        'P0.25Y': 'CAST(TIMESTAMPADD(QUARTER, QUARTER(CAST({col} AS DATE)) - 1, \
                  FLOOR(CAST({col} AS TIMESTAMP) TO YEAR)) AS DATE)',
        'P1Y': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO YEAR) AS DATE)',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "CAST('{}' AS DATE)".format(dttm.isoformat()[:10])
        if tt == 'TIMESTAMP':
            return "CAST('{}' AS TIMESTAMP)".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))
