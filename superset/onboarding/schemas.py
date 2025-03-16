# DODO added #32839641

from marshmallow import fields, Schema


class OnboardingGetResponseSchema(Schema):
    id = fields.Int()
    first_name = fields.String()
    last_name = fields.String()
    email = fields.String()
    is_onboarding_finished = fields.Boolean()
    onboarding_started_time = fields.DateTime(missing=True)


class OnboardingPutSchema(Schema):
    dodo_role = fields.String()
