from marshmallow import fields, Schema

from superset import typemallow as tm

from superset import app

# with app.app_context() as context:
#     from superset.charts import schemas

# @tm.ts_interface()
# class Foo(Schema):
#     some_field_one = fields.Str(required=True)
#     another_field = fields.Date()
#     one_more_field = fields.Integer()


tm.generate_ts("./output.ts")
