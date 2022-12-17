from marshmallow import Schema, fields

from superset.charts.schemas import ChartEntityResponseSchema


class AutoCompleteSchema(Schema):
    question = fields.String(description="Question")
    time = fields.DateTime(description="Time")
    email = fields.Email(description="Email")

class QuestionSchema(Schema):
    question = fields.String(description="Question section")

class AnswerSchema(Schema):
    question = fields.String(description="Question section")
    answer = fields.String(description="Answer in plain text")
    # slice = fields.Nested(ChartEntityResponseSchema)
