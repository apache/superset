import sys
import warnings

PY2 = sys.version_info[0] == 2

if not PY2:
    text_type = str
    string_types = (str,)
    from urllib.parse import urlparse
else:
    text_type = unicode
    string_types = (str, unicode)
    from urlparse import urlparse


def to_bytes(text):
    """Transform string to bytes."""
    if isinstance(text, text_type):
        text = text.encode('utf-8')
    return text


def to_unicode(input_bytes, encoding='utf-8'):
    """Decodes input_bytes to text if needed."""
    if not isinstance(input_bytes, string_types):
        input_bytes = input_bytes.decode(encoding)
    return input_bytes


class FlaskWTFDeprecationWarning(DeprecationWarning):
    pass


warnings.simplefilter('always', FlaskWTFDeprecationWarning)
warnings.filterwarnings('ignore', category=FlaskWTFDeprecationWarning, module='wtforms|flask_wtf')
