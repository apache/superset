# DODO added #32839638

from enum import Enum

from marshmallow import fields, Schema


class CustomDodoRoles(Enum):
    CHECK_DATA = "readonly"
    CREATE_DATA = "Create data"
    VIZUALIZE_DATA = "Vizualize data"


class UserSchema(Schema):
    id = fields.Int()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    email = fields.String()
    last_login = fields.DateTime()
    created_on = fields.DateTime()
    login_count = fields.Int()


class RolesSchema(Schema):
    id = fields.Int()
    name = fields.String()


class TeamGetSchema(Schema):
    id = fields.Int()
    name = fields.String()
    slug = fields.String()
    is_external = fields.Boolean()
    roles = fields.List(fields.Nested(RolesSchema))
    participants = fields.List(fields.Nested(UserSchema()))


class TeamGetResponseSchema(Schema):
    result = fields.List(fields.Nested(TeamGetSchema))


class TeamPostSchema(Schema):
    is_external = fields.Boolean()
    name = fields.String()
    slug = fields.String()
    roles = fields.List(fields.String(validate=CustomDodoRoles))


class AddUserSchema(Schema):
    user_id = fields.Int()
    team_id = fields.Int()
