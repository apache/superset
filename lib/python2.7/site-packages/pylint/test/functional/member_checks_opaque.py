# pylint: disable=missing-docstring

import json


json.loads('bar').get('baz') # [no-member]
