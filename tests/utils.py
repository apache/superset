# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
from os import path

FIXTURES_DIR = 'tests/fixtures'


def load_fixture(fixture_file_name):
    with open(path.join(FIXTURES_DIR, fixture_file_name)) as fixture_file:
        return json.load(fixture_file)
