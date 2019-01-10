# -*- coding: utf-8 -*-
import json
from os import path

FIXTURES_DIR = 'tests/fixtures'


def load_fixture(fixture_file_name):
    with open(path.join(FIXTURES_DIR, fixture_file_name)) as fixture_file:
        return json.load(fixture_file)
