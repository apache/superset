# DODO added #32839641

from enum import Enum

from marshmallow import fields, Schema


class CustomDodoRoles(Enum):
    CHECK_DATA = "readonly"
    CREATE_DATA = "Create data"
    VIZUALIZE_DATA = "Vizualize data"


class RolesSchema(Schema):
    id = fields.Int()
    name = fields.String()


class UserSchema(Schema):
    id = fields.Int()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    email = fields.String()
    roles = fields.List(fields.Nested(RolesSchema))


class StatementGetResponseSchema(Schema):
    id = fields.Int()
    user = fields.List(fields.Nested(UserSchema()))
    finished = fields.Boolean()
    team = fields.String()
    is_new_team = fields.Boolean()
    team_slug = fields.String()
    is_external = fields.Boolean()
    created_datetime = fields.DateTime()
    request_roles = fields.List(fields.String(validate=CustomDodoRoles))
    last_changed_datetime = fields.DateTime()


class StatementGetSchema(Schema):
    is_external = fields.Boolean()
    query = fields.String()


class StatementPutSchema(Schema):
    team_slug = fields.String()
    is_approved = fields.Boolean()
    request_roles = fields.List(fields.String(validate=CustomDodoRoles))


class StatementPostSchema(Schema):
    is_new_team = fields.Boolean()
    team = fields.String()
    team_slug = fields.String()
    is_external = fields.Boolean()
    request_roles = fields.List(fields.String(validate=CustomDodoRoles))
