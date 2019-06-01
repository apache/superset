from superset.db_engine_specs.sqlite import SqliteEngineSpec


class GSheetsEngineSpec(SqliteEngineSpec):
    """Engine for Google spreadsheets"""
    engine = 'gsheets'
    inner_joins = False
    allows_subquery = False
