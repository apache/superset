from typing import Any, Set

from superset import db
from superset.commands.base import BaseCommand
from superset.models.datasource_access_request import DatasourceAccessRequest


class RequestAccessCommand(BaseCommand):
    def __init__(self, datasources: Set[Any]):
        self.datasources = datasources

    def validate(self):
        pass

    def run(self):
        for ds in self.datasources:
            access_request = DatasourceAccessRequest(
                datasource_id=ds.id, datasource_type=ds.type
            )
            db.session.add(access_request)
        db.session.commit()
