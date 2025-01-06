from superset.models.dashboard import Workspace
from superset.models.dashboard import Dashboard
from superset.security.manager import SupersetSecurityManager
from superset import db
from sqlalchemy import func
from flask import session
from superset.tags.models import Tag, TaggedObject, ObjectType
import jwt
import logging

logger = logging.getLogger(__name__)
class WorkspaceResourceManager():

    @staticmethod
    def list_intern_resource(user):
        if user.is_anonymous:
            return db.session.query(Workspace).filter(Workspace.title == 'TEST').all()
        roles = SupersetSecurityManager.get_user_roles(user)
        roles = [role.name for role in roles]

        ### NEW ###
        token = session['oauth'][0]
        decoded = jwt.decode(token, options={"verify_signature": False})
        roles = decoded['groups']
        logger.info("THESE ARE THE ROLES: {}".format(roles))
        return db.session.query(Workspace).filter((Workspace.tags == None) | (
            Workspace.tags.any(Tag.name.in_(r for r in roles)))).all()
        ### END NEW ###


        # if 'Management' not in roles:
        #     return db.session.query(Workspace).filter(Workspace.title != 'Management').all()
        # return db.session.query(Workspace).all()

    def delete_intern_resource(self, pk):
        workspace, _ = self.get_intern_resource(pk)
        db.session.delete(workspace)
        db.session.commit()

    @staticmethod
    def create_intern_resource(title: str,
                               color: str,
                               created_by: str,
                               description: str,
                               ):
        last_pk = db.session.query(func.max(Workspace.id)).scalar() or 0
        workspace = Workspace(
            id=last_pk+1,
            title=title,
            color=color,
            created_by=created_by,
            description=description,
        )
        db.session.add(workspace)
        db.session.commit()
        return workspace


    # @staticmethod
    def update_intern_resource(self, pk,
                               title: str,
                               color: str,
                               created_by: str,
                               description: str,
                               tags: str
                               ):
        workspace = db.session.query(Workspace).filter(Workspace.id==pk).first()
        workspace.title = title
        workspace.color = color
        workspace.created_by = created_by
        workspace.description = description
        logger.info(f"TAGS: {tags}")
        tags = tags.split(',')
        for tag in tags:
            tag_obj = self.insert_tag(tag)
            self.insert_tagged_object(tag_obj.id, pk)
        db.session.commit()


    @staticmethod
    def get_intern_resource(pk):
        return db.session.query(Workspace).filter(Workspace.id == pk).one(), db.session.query(Dashboard).filter(Dashboard.workspace_id == pk).all()

    @staticmethod
    def insert_tag(name: str, tag_type: str='custom' ) -> Tag:
        tag_name = name.strip()
        exists = db.session.query(Tag).filter(Tag.name == tag_name).first()
        if exists:
            return exists
        tag = Tag(
            name=tag_name,
            type=tag_type,
            # workspace_id=db.session.query(Workspace).filter(Workspace.title == tag_name).first().id,
        )
        db.session.add(tag)
        db.session.commit()
        return tag

    @staticmethod
    def insert_tagged_object(
        tag_id: int,
        object_id: int,
    ) -> TaggedObject:
        logger.info(f"TAG DATA: {object_id}, {tag_id}")
        tag = db.session.query(Tag).filter(Tag.id == tag_id).first()
        exists = db.session.query(TaggedObject).filter(TaggedObject.tag == tag).first()
        if exists:
            return exists
        tagged_object = TaggedObject(
            tag=tag, object_id=object_id, object_type=ObjectType.workspace.name
        )
        db.session.add(tagged_object)
        db.session.commit()
        return tagged_object
