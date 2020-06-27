from typing import Set

from superset import ConnectorRegistry, db, security_manager
from superset.commands.base import BaseCommand
from superset.models.dashboard import Dashboard


class LDACAResult:
    datasources: set
    access_to_all: bool


class LoadDatasourcesAndCheckAccess(BaseCommand):
    datasources = set()

    def __init__(self, dashboard_id: str, datasource_id: str, datasource_type: str):
        self.dashboard_id = int(dashboard_id)
        self.datasource_id = int(datasource_id)
        self.datasource_type = datasource_type

    def validate(self) -> None:
        pass

    def run(self) -> (Set, bool):
        if self.dashboard_id:
            dash = db.session.query(Dashboard).filter_by(id=self.dashboard_id).one()
            self.datasources |= dash.datasources

        if self.datasource_id and self.datasource_type:
            ds_class = ConnectorRegistry.sources.get(self.datasource_type)
            datasource = (
                db.session.query(ds_class).filter_by(id=self.datasource_id).one()
            )
            self.datasources.add(datasource)

        has_access = all(
            (
                datasource and security_manager.can_access_datasource(datasource)
                for datasource in self.datasources
            )
        )

        return LDACAResult(datasources=self.datasources, access_to_all=has_access)
