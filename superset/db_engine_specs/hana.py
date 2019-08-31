from superset.db_engine_specs.base import LimitMethod
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class HanaPyhdbEngineSpec(PostgresBaseEngineSpec):
    engine = "hana+pyhdb"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30
    time_grain_functions = {
        None: '{col}',
        'P1D': "TO_DATE({col})",
        'P1M': "SUBSTRING(to_date({col}),0,7)||'-01'",
        'P0.25Y': "SUBSTRING(to_date({col}),0,5)||'0'||SUBSTRING(QUARTER(TO_DATE({col}), 1),7,1)||'-01'",
        'P1Y': "YEAR({col})||'-01-01'",
    }
    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return ("""to_date('{}'""").format(
            dttm.isoformat()
        )

class HanaEngineSpec(PostgresBaseEngineSpec):
    engine = "hana"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30
    time_grain_functions = {
        None: '{col}',
        'P1D': "TO_DATE({col})",
        'P1M': "SUBSTRING(to_date({col}),0,7)||'-01'",
        'P0.25Y': "SUBSTRING(to_date({col}),0,5)||'0'||SUBSTRING(QUARTER(TO_DATE({col}), 1),7,1)||'-01'",
        'P1Y': "YEAR({col})||'-01-01'",
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return ("""to_date('{}')""").format(
            dttm.isoformat()
        )

class PyhdbEngineSpec(PostgresBaseEngineSpec):
    engine = "pyhdb"
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30
    time_grain_functions = {
        None: '{col}',
        'P1D': "TO_DATE({col})",
        'P1M': "SUBSTRING(to_date({col}),0,7)||'-01'",
        'P0.25Y': "SUBSTRING(to_date({col}),0,5)||'0'||SUBSTRING(QUARTER(TO_DATE({col}), 1),7,1)||'-01'",
        'P1Y': "YEAR({col})||'-01-01'",
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return ("""to_date('{}')""").format(
            dttm.isoformat()
        )
