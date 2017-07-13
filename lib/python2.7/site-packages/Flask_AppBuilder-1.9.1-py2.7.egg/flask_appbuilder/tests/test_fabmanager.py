from nose.tools import eq_, ok_, raises
import unittest
import os
import string
import random
import datetime
import shutil
from flask_appbuilder.console import create_app, create_admin
from click.testing import CliRunner

import logging

logging.basicConfig(format='%(asctime)s:%(levelname)s:%(name)s:%(message)s')
logging.getLogger().setLevel(logging.DEBUG)
log = logging.getLogger(__name__)



class FlaskTestCase(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        log.debug("TEAR DOWN")

    def test_create_app(self):
        """
            Test create app
        """
        runner = CliRunner()
        result = runner.invoke(create_app, input='myapp\nSQLAlchemy\n')
        ok_('Downloaded the skeleton app, good coding!' in result.output)
        shutil.rmtree('myapp')
        result = runner.invoke(create_app, input='myapp\nMongoEngine\n')
        ok_('Downloaded the skeleton app, good coding!' in result.output)
        shutil.rmtree('myapp')


