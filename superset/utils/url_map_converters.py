# ---------------------------------------------------------------------
# Redirecting URL from previous names
from werkzeug.routing import BaseConverter
from superset.models.tags import ObjectTypes


class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]


class ObjectTypeConverter(BaseConverter):
    """Validate that object_type is indeed an object type."""

    def to_python(self, value):
        return ObjectTypes[value]

    def to_url(self, value):
        return value.name
