# The @semantic_layer decorator on DatabricksMetricViewsLayer handles
# registration automatically. This import triggers the decorator at
# extension load time.
from databricks_metric_views.layer import DatabricksMetricViewsLayer  # noqa: F401
