from .superset_test_config import *

globals().setdefault("FEATURE_FLAGS", {})
FEATURE_FLAGS["DASHBOARD_LEVEL_ACCESS"] = True  # type: ignore
