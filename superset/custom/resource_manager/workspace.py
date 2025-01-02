from superset.models.dashboard import Workspace
from superset.models.dashboard import Dashboard
from superset.security.manager import SupersetSecurityManager
from superset import db
from sqlalchemy import func

import logging

logger = logging.getLogger(__name__)
class WorkspaceResourceManager():

    @staticmethod
    def list_intern_resource(user):
        if user.is_anonymous:
            return db.session.query(Workspace).filter(Workspace.title == 'TEST').all()
        roles = SupersetSecurityManager.get_user_roles(user)
        roles = [role.name for role in roles]
        if 'Management' not in roles:
            return db.session.query(Workspace).filter(Workspace.title != 'Management').all()
        return db.session.query(Workspace).all()

    def delete_intern_resource(self, pk):
        workspace, _ = self.get_intern_resource(pk)
        db.session.delete(workspace)
        db.session.commit()

    @staticmethod
    def create_intern_resource(title: str,
                               color: str,
                               created_by: str,
                               description: str
                               ):
        last_pk = db.session.query(func.max(Workspace.id)).scalar() or 0
        workspace = Workspace(
            id=last_pk+1,
            title=title,
            color=color,
            created_by=created_by,
            description=description
        )
        db.session.add(workspace)
        db.session.commit()
        return workspace


    @staticmethod
    def update_intern_resource(pk,
                               title: str,
                               color: str,
                               created_by: str,
                               description: str
                               ):
        workspace = db.session.query(Workspace).filter(Workspace.id==pk).first()
        workspace.title = title
        workspace.color = color
        workspace.created_by = created_by
        workspace.description = description
        db.session.commit()


    @staticmethod
    def get_intern_resource(pk):
        return db.session.query(Workspace).filter(Workspace.id == pk).one(), db.session.query(Dashboard).filter(Dashboard.workspace_id == pk).all()

