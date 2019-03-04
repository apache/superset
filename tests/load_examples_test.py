from superset import data
from superset.cli import load_test_users_run
from .base_tests import SupersetTestCase


class SupersetDataFrameTestCase(SupersetTestCase):

    def test_load_css_templates(self):
        data.load_css_templates()

    def test_load_energy(self):
        data.load_energy()

    def test_load_world_bank_health_n_pop(self):
        data.load_world_bank_health_n_pop()

    def test_load_birth_names(self):
        data.load_birth_names()

    def test_load_test_users_run(self):
        load_test_users_run()
