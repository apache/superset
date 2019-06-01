from urllib import parse

from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class SnowflakeEngineSpec(PostgresBaseEngineSpec):
    engine = 'snowflake'
    force_column_alias_quotes = True
    max_column_name_length = 256

    time_grain_functions = {
        None: '{col}',
        'PT1S': "DATE_TRUNC('SECOND', {col})",
        'PT1M': "DATE_TRUNC('MINUTE', {col})",
        'PT5M': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 5) * 5, \
                DATE_TRUNC('HOUR', {col}))",
        'PT10M': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 10) * 10, \
                 DATE_TRUNC('HOUR', {col}))",
        'PT15M': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 15) * 15, \
                 DATE_TRUNC('HOUR', {col}))",
        'PT0.5H': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 30) * 30, \
                  DATE_TRUNC('HOUR', {col}))",
        'PT1H': "DATE_TRUNC('HOUR', {col})",
        'P1D': "DATE_TRUNC('DAY', {col})",
        'P1W': "DATE_TRUNC('WEEK', {col})",
        'P1M': "DATE_TRUNC('MONTH', {col})",
        'P0.25Y': "DATE_TRUNC('QUARTER', {col})",
        'P1Y': "DATE_TRUNC('YEAR', {col})",
    }

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        database = uri.database
        if '/' in uri.database:
            database = uri.database.split('/')[0]
        if selected_schema:
            selected_schema = parse.quote(selected_schema, safe='')
            uri.database = database + '/' + selected_schema
        return uri
