from typing import List

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils


class SqliteEngineSpec(BaseEngineSpec):
    engine = 'sqlite'

    time_grain_functions = {
        None: '{col}',
        'PT1H': "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))",
        'P1D': 'DATE({col})',
        'P1W': "DATE({col}, -strftime('%W', {col}) || ' days')",
        'P1M': "DATE({col}, -strftime('%d', {col}) || ' days', '+1 day')",
        'P1Y': "DATETIME(STRFTIME('%Y-01-01T00:00:00', {col}))",
        'P1W/1970-01-03T00:00:00Z': "DATE({col}, 'weekday 6')",
        '1969-12-28T00:00:00Z/P1W': "DATE({col}, 'weekday 0', '-7 days')",
    }

    @classmethod
    def epoch_to_dttm(cls):
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def get_all_datasource_names(cls, db, datasource_type: str) \
            -> List[utils.DatasourceName]:
        schemas = db.get_all_schema_names(cache=db.schema_cache_enabled,
                                          cache_timeout=db.schema_cache_timeout,
                                          force=True)
        schema = schemas[0]
        if datasource_type == 'table':
            return db.get_all_table_names_in_schema(
                schema=schema, force=True,
                cache=db.table_cache_enabled,
                cache_timeout=db.table_cache_timeout)
        elif datasource_type == 'view':
            return db.get_all_view_names_in_schema(
                schema=schema, force=True,
                cache=db.table_cache_enabled,
                cache_timeout=db.table_cache_timeout)
        else:
            raise Exception(f'Unsupported datasource_type: {datasource_type}')

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        iso = dttm.isoformat().replace('T', ' ')
        if '.' not in iso:
            iso += '.000000'
        return "'{}'".format(iso)

    @classmethod
    def get_table_names(cls, inspector, schema):
        """Need to disregard the schema for Sqlite"""
        return sorted(inspector.get_table_names())
