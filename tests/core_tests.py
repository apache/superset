import imp
import doctest
import os
import unittest

from flask import escape

import caravel
from caravel import app, db, models, utils, appbuilder

os.environ['CARAVEL_CONFIG'] = 'tests.caravel_test_config'

app.config['TESTING'] = True
app.config['CSRF_ENABLED'] = False
app.config['SECRET_KEY'] = 'thisismyscretkey'
app.config['WTF_CSRF_ENABLED'] = False
BASE_DIR = app.config.get("BASE_DIR")
cli = imp.load_source('cli', BASE_DIR + "/bin/caravel")


class CaravelTests(unittest.TestCase):

    def __init__(self, *args, **kwargs):
        super(CaravelTests, self).__init__(*args, **kwargs)
        self.client = app.test_client()
        role_admin = appbuilder.sm.find_role('Admin')
        user = appbuilder.sm.find_user('admin')
        if not user:
            appbuilder.sm.add_user(
                'admin', 'admin',' user', 'admin@fab.org',
                role_admin, 'general')
        utils.init(caravel)
        self.load_examples()

    def setUp(self):
        pass

    def tearDown(self):
        pass

    def login(self):
        self.client.post(
            '/login/',
            data=dict(username='admin', password='general'),
            follow_redirects=True)

    def load_examples(self):
        cli.load_examples(sample=True)

    def test_slices(self):
        # Testing by running all the examples
        self.login()
        Slc = models.Slice
        urls = []
        for slc in db.session.query(Slc).all():
            urls += [
                slc.slice_url,
                slc.viz.json_endpoint,
            ]
        for url in urls:
            self.client.get(url)

    def test_csv(self):
        self.client.get('/caravel/explore/table/1/?viz_type=table&granularity=ds&since=100+years&until=now&metrics=count&groupby=name&limit=50&show_brush=y&show_brush=false&show_legend=y&show_brush=false&rich_tooltip=y&show_brush=false&show_brush=false&show_brush=false&show_brush=false&y_axis_format=&x_axis_showminmax=y&show_brush=false&line_interpolation=linear&rolling_type=None&rolling_periods=&time_compare=&num_period_compare=&where=&having=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&flt_col_0=gender&flt_op_0=in&flt_eq_0=&slice_id=14&slice_name=Boys&collapsed_fieldsets=&action=&datasource_name=birth_names&datasource_id=1&datasource_type=table&previous_viz_type=line&csv=true')

    def test_dashboard(self):
        self.login()
        urls = {}
        for dash in db.session.query(models.Dashboard).all():
            urls[dash.dashboard_title] = dash.url
        for title, url in urls.items():
            print(url)
            assert escape(title) in self.client.get(url).data

    def test_doctests(self):
        modules = [utils]
        for mod in modules:
            failed, tests = doctest.testmod(mod)
            if failed:
                raise Exception("Failed a doctest")

    def test_misc(self):
        assert self.client.get('/health').data == "OK"
        assert self.client.get('/ping').data == "OK"


if __name__ == '__main__':
    unittest.main()
