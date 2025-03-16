# DODO added #32839638

from marshmallow import fields, Schema


class TeamSchema(Schema):
    id = fields.Int()
    name = fields.String()


class UserSchema(Schema):
    id = fields.Int()
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()
    email = fields.String()
    last_login = fields.DateTime()
    created_on = fields.DateTime()
    login_count = fields.Int()
    team = fields.Nested(TeamSchema())
