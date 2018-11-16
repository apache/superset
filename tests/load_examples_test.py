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

    def test_load_random_time_series_data(self):
        data.load_random_time_series_data()

    def test_load_country_map_data(self):
        data.load_country_map_data()

    def test_load_multiformat_time_series_data(self):
        data.load_multiformat_time_series()

    def test_load_paris_iris_geojson(self):
        data.load_paris_iris_geojson()

    def test_load_bart_lines(self):
        data.load_bart_lines()

    def test_load_multi_line(self):
        data.load_multi_line()

    def test_load_misc_dashboard(self):
        data.load_misc_dashboard()

    def test_load_unicode_test_data(self):
        data.load_unicode_test_data()

    def test_load_deck_dash(self):
        data.load_long_lat_data()
        data.load_flights()
        data.load_sf_population_polygons()
        data.load_deck_dash()

    def test_load_test_users_run(self):
        load_test_users_run()
