from marshmallow import fields, Schema

busniess_type_convert_schema = {
    "type": "object",
    "properties": {
        "type": {
            "type": "string"
        },
        "value": {
            "type": "string"
        },
    }
}
