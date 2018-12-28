# pylint: disable=R
from typing import Dict, List

from superset import db
from superset.connectors.connector_registry import ConnectorRegistry
from .query_object import QueryObject


class QueryContext:
    """
    The query context contains the query object and additional fields necessary
    to retrieve the data payload for a given viz.
    """
    # TODO: Type datasource and query_object dictionary with TypedDict when it becomes
    # a vanilla python type https://github.com/python/mypy/issues/5288
    def __init__(
            self,
            datasource: Dict,
            queries: List[Dict],
    ):
        self.datasource = ConnectorRegistry.get_datasource(datasource.get('type'),
                                                           int(datasource.get('id')),
                                                           db.session)
        self.queries = list(map(lambda query_obj: QueryObject(**query_obj), queries))

    def get_data(self):
        raise NotImplementedError()
