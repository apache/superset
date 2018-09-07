# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
from os import path

from superset import db
from superset.models import core as models

FIXTURES_DIR = 'tests/fixtures'


def load_fixture(fixture_file_name):
    with open(path.join(FIXTURES_DIR, fixture_file_name)) as fixture_file:
        return json.load(fixture_file)


def get_main_database(session):
    return (
        db.session.query(models.Database)
        .filter_by(database_name='main')
        .first()
    )
