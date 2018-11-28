import json
from os import path

FIXTURES_DIR = 'tests/fixtures'


def read_fixture(fixture_file_name):
    with open(path.join(FIXTURES_DIR, fixture_file_name), 'rb') as fixture_file:
        return fixture_file.read()


def load_fixture(fixture_file_name):
    return json.loads(read_fixture(fixture_file_name))
