# TDengine driver for Apache SuperSet
from superset.db_engine_specs.base import  BaseEngineSpec

class TDengineEngineSpec(BaseEngineSpec):
    engine = "taosws"
    engine_name = "TDengine"
    max_column_name_length = 64
    default_driver = "taosws"
    sqlalchemy_uri_placeholder = ("taosws://user:password@host:port/dbname[?key=value&key=value...]")
    
    # time grain
    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "TIMETRUNCATE({col}, 1s, 0)",
        "PT1M": "TIMETRUNCATE({col}, 1m, 0)",
        "PT1H": "TIMETRUNCATE({col}, 1h, 0)",
        "P1D":  "TIMETRUNCATE({col}, 1d, 0)",
        "P1W":  "TIMETRUNCATE({col}, 1w, 0)",
    }