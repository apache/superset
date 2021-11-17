from marshmallow import Schema, fields


class UserResponse(Schema):
    id = fields.Integer(description="User id")
    first_name = fields.String(description="First name of the User")
    last_name = fields.String(description="Last name of the User")
    username = fields.String(description="Username of the User")
