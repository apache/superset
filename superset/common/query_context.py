from typing import Dict

from superset import db
from superset.connectors.connector_registry import ConnectorRegistry
from .query_object import QueryObject


class QueryContext():
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """
    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    # a vanilla python type https://github.com/python/mypy/issues/5288
    def __init__(self,
                 datasource: Dict,
                 query_object: Dict,
                 ):
        self._datasource = ConnectorRegistry.get_datasource(datasource.get('type'),
                                                            datasource.get('id'),
                                                            db.session)
        self._query_object = QueryObject(**query_object)

    @property
    def datasource(self):
        return self._datasource

    @property
    def query_object(self):
        return self._query_object
