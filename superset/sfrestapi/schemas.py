from marshmallow import fields, Schema

class SFRestAPIListBucketSchema(Schema):
    buckets = fields.List(fields.String())