from superset.db_engine_specs.base import BaseEngineSpec

class FireboltEngineSpec(BaseEngineSpec):
    """Engine spec for Firebolt"""

    engine = "firebolt"
    engine_name = "Firebolt"
    default_driver = "firebolt"
