"""
Schemas for business types
"""

business_type_convert_schema = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "type": {"type": "string"},
            "value": {"type": "string"},
        },
    },
}
