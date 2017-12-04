from superset import db
from superset.connectors.druid.models import DruidCluster


class BaseTask:
    """
    Task base class, which other classes derive.
    Subclasses must implement `execute` and `validate_config`.
    """

    def __init__(self, config):
        self.config = config

    def execute(self):
        return False

    @classmethod
    def validate_task_config(cls, config):
        return False


class DruidClusterRefreshTask(BaseTask):
    """
    This task will trigger a refresh of Druid clusters
    specified as an `array` in `clusters`. If `refresh_all` is
    set to `false`, the task will only check for new datasources
    instead of refreshing all metadata.
    """

    def __repr__(self):
        return "druid_cluster_refresh"

    @classmethod
    def validate_task_config(cls, config):
        if 'clusters' not in config:
            raise ValueError("Key 'clusters' is not defined")
        if not isinstance(config['clusters'], list):
            raise TypeError("'clusters' should be a list")
        if not len(config['clusters']):
            raise ValueError("No clusters specified")
        return True

    def execute(self):
        # grab the list of cluster names
        cluster_names = self.config['clusters']
        # whether to force refresh all, default `True`
        refreshAll = self.config.get('refresh_all', True)
        clusters = (
            db.session.query(DruidCluster)
            .filter(DruidCluster.cluster_name.in_(cluster_names))
        )
        # start refreshing
        for cluster in clusters:
            cluster.refresh_datasources(refreshAll=refreshAll)


# list of task classes live here
task_list = {
    'druid_cluster_refresh': DruidClusterRefreshTask,
}
