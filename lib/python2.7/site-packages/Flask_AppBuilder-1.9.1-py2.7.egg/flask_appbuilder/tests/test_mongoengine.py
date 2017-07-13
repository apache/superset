from nose.tools import eq_, ok_, raises
import unittest
import os
import string
import random
import datetime
from flask_mongoengine import MongoEngine
from mongoengine import Document
from mongoengine import IntField, FloatField, DateTimeField, StringField, ReferenceField, ListField, FileField, ImageField
from flask_appbuilder.models.mongoengine.filters import FilterStartsWith, FilterEqual
from flask_appbuilder.views import MasterDetailView, CompactCRUDMixin
from flask_appbuilder.charts.views import (ChartView, TimeChartView,
                                           DirectChartView, GroupByChartView,
                                           DirectByChartView)
from flask_appbuilder.models.group import aggregate_avg, aggregate_count, aggregate_sum


import logging

logging.basicConfig(format='%(asctime)s:%(levelname)s:%(name)s:%(message)s')
logging.getLogger().setLevel(logging.DEBUG)


"""
    Constant english display string from framework
"""
DEFAULT_INDEX_STRING = 'Welcome'
INVALID_LOGIN_STRING = 'Invalid login'
ACCESS_IS_DENIED = "Access is Denied"
UNIQUE_VALIDATION_STRING = 'Already exists'
NOTNULL_VALIDATION_STRING = 'This field is required'
DEFAULT_ADMIN_USER = 'admin'
DEFAULT_ADMIN_PASSWORD = 'general'

log = logging.getLogger(__name__)


class Model1(Document):
    field_string = StringField(unique=True, required=True)
    field_integer = IntField()
    field_float = FloatField()
    field_date = DateTimeField()
    field_file = FileField()
    field_image = ImageField()

    def __repr__(self):
        return str(self.field_string)

    def __unicode__(self):
        return self.field_string


class Model2(Document):
    field_string = StringField(unique=True, required=True)
    field_integer = IntField()
    field_float = FloatField()
    field_date = DateTimeField()
    excluded_string = StringField(default="EXCLUDED")
    default_string = StringField(default="DEFAULT")
    group = ReferenceField(Model1, required=True)

    def __repr__(self):
        return str(self.field_string)

    def field_method(self):
       return "field_method_value"


class FlaskTestCase(unittest.TestCase):
    def setUp(self):
        from flask import Flask
        from flask_appbuilder import AppBuilder
        from flask_appbuilder.models.mongoengine.interface import MongoEngineInterface
        from flask_appbuilder import ModelView
        from flask_appbuilder.security.mongoengine.manager import SecurityManager

        self.app = Flask(__name__)
        self.basedir = os.path.abspath(os.path.dirname(__file__))
        self.app.config['MONGODB_SETTINGS'] = {'DB': 'test'}
        self.app.config['CSRF_ENABLED'] = False
        self.app.config['SECRET_KEY'] = 'thisismyscretkey'
        self.app.config['WTF_CSRF_ENABLED'] = False

        self.db = MongoEngine(self.app)
        self.appbuilder = AppBuilder(self.app, security_manager_class=SecurityManager)

        class Model2View(ModelView):
            datamodel = MongoEngineInterface(Model2)
            list_columns = ['field_integer', 'field_float', 'field_string', 'field_method', 'group.field_string']
            edit_form_query_rel_fields = {'group':[['field_string', FilterEqual, 'G2']]}
            add_form_query_rel_fields = {'group':[['field_string', FilterEqual, 'G1']]}
            add_exclude_columns = ['excluded_string']

        class Model22View(ModelView):
            datamodel = MongoEngineInterface(Model2)
            list_columns = ['field_integer', 'field_float', 'field_string', 'field_method', 'group.field_string']
            add_exclude_columns = ['excluded_string']
            edit_exclude_columns = ['excluded_string']
            show_exclude_columns = ['excluded_string']


        class Model1View(ModelView):
            datamodel = MongoEngineInterface(Model1)
            related_views = [Model2View]
            list_columns = ['field_string','field_file']

        class Model1CompactView(CompactCRUDMixin, ModelView):
            datamodel = MongoEngineInterface(Model1)

        class Model1Filtered1View(ModelView):
            datamodel = MongoEngineInterface(Model1)
            base_filters = [['field_string', FilterStartsWith, 'a']]

        class Model1MasterView(MasterDetailView):
            datamodel = MongoEngineInterface(Model1)
            related_views = [Model2View]

        class Model1Filtered2View(ModelView):
            datamodel = MongoEngineInterface(Model1)
            base_filters = [['field_integer', FilterEqual, 0]]

        class Model2GroupByChartView(GroupByChartView):
            datamodel = MongoEngineInterface(Model2)
            chart_title = 'Test Model1 Chart'

            definitions = [
                {
                    'group':'field_string',
                    'series':[(aggregate_sum,'field_integer',
                               aggregate_avg, 'field_integer',
                               aggregate_count,'field_integer')
                            ]
                }
            ]

        class Model2DirectByChartView(DirectByChartView):
            datamodel = MongoEngineInterface(Model2)
            chart_title = 'Test Model1 Chart'

            definitions = [
                {
                    'group':'field_string',
                    'series':['field_integer','field_float']
                }
            ]

        class Model2DirectChartView(DirectChartView):
            datamodel = MongoEngineInterface(Model2)
            chart_title = 'Test Model1 Chart'
            direct_columns = {'stat1': ('group', 'field_integer')}

        class Model1MasterView(MasterDetailView):
            datamodel = MongoEngineInterface(Model1)
            related_views = [Model2View]

        class Model1MasterChartView(MasterDetailView):
            datamodel = MongoEngineInterface(Model1)
            related_views = [Model2DirectByChartView]


        self.appbuilder.add_view(Model1View, "Model1", category='Model1')
        self.appbuilder.add_view(Model1CompactView, "Model1Compact", category='Model1')
        self.appbuilder.add_view(Model1MasterView, "Model1Master", category='Model1')
        self.appbuilder.add_view(Model1MasterChartView, "Model1MasterChart", category='Model1')
        self.appbuilder.add_view(Model1Filtered1View, "Model1Filtered1", category='Model1')
        self.appbuilder.add_view(Model1Filtered2View, "Model1Filtered2", category='Model1')

        self.appbuilder.add_view(Model2View, "Model2")
        self.appbuilder.add_view(Model22View, "Model22")
        self.appbuilder.add_view(Model2View, "Model2 Add", href='/model2view/add')
        self.appbuilder.add_view(Model2GroupByChartView, "Model2 Group By Chart")
        self.appbuilder.add_view(Model2DirectByChartView, "Model2 Direct By Chart")
        self.appbuilder.add_view(Model2DirectChartView, "Model2 Direct Chart")

        role_admin = self.appbuilder.sm.find_role('Admin')
        try:
            self.appbuilder.sm.add_user('admin', 'admin', 'user', 'admin@fab.org', role_admin, 'general')
        except:
            pass

    def tearDown(self):
        self.appbuilder = None
        self.app = None
        self.db = None
        log.debug("TEAR DOWN")


    """ ---------------------------------
            TEST HELPER FUNCTIONS
        ---------------------------------
    """

    def login(self, client, username, password):
        # Login with default admin
        return client.post('/login/', data=dict(
            username=username,
            password=password
        ), follow_redirects=True)

    def logout(self, client):
        return client.get('/logout/')

    def insert_data(self):
        for x, i in zip(string.ascii_letters[:23], range(23)):
            model = Model1(field_string="%stest" % (x), field_integer=i)
            model.save()

    def insert_data2(self):
        models1 = [Model1(field_string='G1'),
                   Model1(field_string='G2'),
                   Model1(field_string='G3')]
        for model1 in models1:
            try:
                model1.save()
                for x, i in zip(string.ascii_letters[:10], range(10)):
                    model = Model2(field_string="%stest" % (x),
                                   field_integer=random.randint(1, 10),
                                   field_float=random.uniform(0.0, 1.0),
                                   group=model1)
                    year = random.choice(range(1900, 2012))
                    month = random.choice(range(1, 12))
                    day = random.choice(range(1, 28))
                    model.field_date = datetime.datetime(year, month, day)

                    model.save()
            except Exception as e:
                print("ERROR {0}".format(str(e)))

    def clean_data(self):
        Model1.drop_collection()
        Model2.drop_collection()

    def test_fab_views(self):
        """
            Test views creation and registration
        """
        eq_(len(self.appbuilder.baseviews), 24)  # current minimal views are 12

    def test_index(self):
        """
            Test initial access and index message
        """
        client = self.app.test_client()

        # Check for Welcome Message
        rv = client.get('/')
        data = rv.data.decode('utf-8')
        ok_(DEFAULT_INDEX_STRING in data)

    def test_sec_login(self):
        """
            Test Security Login, Logout, invalid login, invalid access
        """
        client = self.app.test_client()

        # Try to List and Redirect to Login
        rv = client.get('/model1view/list/')
        eq_(rv.status_code, 302)
        rv = client.get('/model2view/list/')
        eq_(rv.status_code, 302)

        # Login and list with admin
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        rv = client.get('/model1view/list/')
        eq_(rv.status_code, 200)
        rv = client.get('/model2view/list/')
        eq_(rv.status_code, 200)

        # Logout and and try to list
        self.logout(client)
        rv = client.get('/model1view/list/')
        eq_(rv.status_code, 302)
        rv = client.get('/model2view/list/')
        eq_(rv.status_code, 302)

        # Invalid Login
        rv = self.login(client, DEFAULT_ADMIN_USER, 'password')
        data = rv.data.decode('utf-8')
        ok_(INVALID_LOGIN_STRING in data)

    def test_sec_reset_password(self):
        """
            Test Security reset password
        """
        from flask_appbuilder.security.mongoengine.models import User
        client = self.app.test_client()

        # Try Reset My password
        user = User.objects.filter(**{'username': 'admin'})[0]
        rv = client.get('/users/action/resetmypassword/{0}'.format(user.id), follow_redirects=True)
        data = rv.data.decode('utf-8')
        ok_(ACCESS_IS_DENIED in data)

        #Reset My password
        rv = self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        rv = client.get('/users/action/resetmypassword/{0}'.format(user.id), follow_redirects=True)
        data = rv.data.decode('utf-8')
        ok_("Reset Password Form" in data)
        rv = client.post('/resetmypassword/form',
                         data=dict(password='password', conf_password='password'), follow_redirects=True)
        eq_(rv.status_code, 200)
        self.logout(client)
        self.login(client, DEFAULT_ADMIN_USER, 'password')
        rv = client.post('/resetmypassword/form',
                         data=dict(password=DEFAULT_ADMIN_PASSWORD, conf_password=DEFAULT_ADMIN_PASSWORD),
                         follow_redirects=True)
        eq_(rv.status_code, 200)

        #Reset Password Admin
        rv = client.get('/users/action/resetpasswords/{0}'.format(user.id), follow_redirects=True)
        data = rv.data.decode('utf-8')
        ok_("Reset Password Form" in data)
        rv = client.post('/resetmypassword/form',
                         data=dict(password=DEFAULT_ADMIN_PASSWORD, conf_password=DEFAULT_ADMIN_PASSWORD),
                         follow_redirects=True)
        eq_(rv.status_code, 200)


    def test_generic_interface(self):
        """
            Test Generic Interface for generic-alter datasource
        """
        client = self.app.test_client()
        rv = self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        rv = client.get('/psview/list')
        data = rv.data.decode('utf-8')


    def test_model_crud(self):
        """
            Test Model add, delete, edit
        """
        client = self.app.test_client()
        rv = self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)

        rv = client.post('/model1view/add',
                             data=dict(field_string='test1', field_integer='1',
                                       field_float='0.12',
                                       field_date='2014-01-01 23:10:07'), follow_redirects=True)
        eq_(rv.status_code, 200)

        model = Model1.objects[0]
        eq_(model.field_string, u'test1')
        eq_(model.field_integer, 1)

        model1 = Model1.objects(field_string='test1')[0]
        rv = client.post('/model1view/edit/{0}'.format(model1.id),
                         data=dict(field_string='test2', field_integer='2'), follow_redirects=True)
        eq_(rv.status_code, 200)

        model = Model1.objects[0]
        eq_(model.field_string, u'test2')
        eq_(model.field_integer, 2)

        rv = client.get('/model1view/delete/{0}'.format(model.id), follow_redirects=True)
        eq_(rv.status_code, 200)
        model = Model1.objects
        eq_(len(model), 0)
        self.clean_data()

    def test_excluded_cols(self):
        """
            Test add_exclude_columns, edit_exclude_columns, show_exclude_columns
        """
        client = self.app.test_client()
        rv = self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        rv = client.get('/model22view/add')
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_('field_string' in data)
        ok_('field_integer' in data)
        ok_('field_float' in data)
        ok_('field_date' in data)
        ok_('excluded_string' not in data)
        self.insert_data2()
        model2 = Model2.objects[0]
        rv = client.get('/model22view/edit/{0}'.format(model2.id))
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_('field_string' in data)
        ok_('field_integer' in data)
        ok_('field_float' in data)
        ok_('field_date' in data)
        ok_('excluded_string' not in data)
        rv = client.get('/model22view/show/{0}'.format(model2.id))
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_('Field String' in data)
        ok_('Field Integer' in data)
        ok_('Field Float' in data)
        ok_('Field Date' in data)
        ok_('Excluded String' not in data)
        self.clean_data()


    def test_query_rel_fields(self):
        """
            Test add and edit form related fields filter
        """
        client = self.app.test_client()
        rv = self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        self.insert_data2()

        # Base filter string starts with
        rv = client.get('/model2view/add')
        data = rv.data.decode('utf-8')
        ok_('G1' in data)
        ok_('G2' not in data)

        model2 = Model2.objects[0]
        # Base filter string starts with
        rv = client.get('/model2view/edit/{0}'.format(model2.id))
        data = rv.data.decode('utf-8')
        ok_('G2' in data)
        ok_('G1' not in data)
        self.clean_data()

    def test_model_list_order(self):
        """
            Test Model order on lists
        """
        self.insert_data()

        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)

        rv = client.post('/model1view/list?_oc_Model1View=field_string&_od_Model1View=asc',
                        follow_redirects=True)
        # TODO: fix this 405 Method not allowed error
        # eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        # TODO
        # VALIDATE LIST IS ORDERED
        rv = client.post('/model1view/list?_oc_Model1View=field_string&_od_Model1View=desc',
                        follow_redirects=True)
        # TODO: fix this 405 Method not allowed error
        # eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        # TODO
        # VALIDATE LIST IS ORDERED
        self.clean_data()


    def test_model_add_validation(self):
        """
            Test Model add validations
        """
        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)

        rv = client.post('/model1view/add',
                         data=dict(field_string='test1', field_integer='1'), follow_redirects=True)
        eq_(rv.status_code, 200)

        rv = client.post('/model1view/add',
                         data=dict(field_string='test1', field_integer='2'), follow_redirects=True)
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_(UNIQUE_VALIDATION_STRING in data)

        model = Model1.objects()
        eq_(len(model), 1)

        rv = client.post('/model1view/add',
                         data=dict(field_string='', field_integer='1'), follow_redirects=True)
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_(NOTNULL_VALIDATION_STRING in data)

        model = Model1.objects()
        eq_(len(model), 1)
        self.clean_data()

    def test_model_edit_validation(self):
        """
            Test Model edit validations
        """
        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)

        client.post('/model1view/add',
                    data=dict(field_string='test1', field_integer='1'), follow_redirects=True)
        model1 = Model1.objects(field_string='test1')[0]
        client.post('/model1view/add',
                    data=dict(field_string='test2', field_integer='1'), follow_redirects=True)
        rv = client.post('/model1view/edit/{0}'.format(model1.id),
                         data=dict(field_string='test2', field_integer='2'), follow_redirects=True)
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_(UNIQUE_VALIDATION_STRING in data)

        rv = client.post('/model1view/edit/{0}'.format(model1.id),
                         data=dict(field_string='', field_integer='2'), follow_redirects=True)
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_(NOTNULL_VALIDATION_STRING in data)
        self.clean_data()

    def test_model_base_filter(self):
        """
            Test Model base filtered views
        """
        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        self.insert_data()
        models = Model1.objects()
        eq_(len(models), 23)

        # Base filter string starts with
        rv = client.get('/model1filtered1view/list/')
        data = rv.data.decode('utf-8')
        ok_('atest' in data)
        ok_('btest' not in data)

        # Base filter integer equals
        rv = client.get('/model1filtered2view/list/')
        data = rv.data.decode('utf-8')
        ok_('atest' in data)
        ok_('btest' not in data)
        self.clean_data()

    def test_model_list_method_field(self):
        """
            Tests a model's field has a method
        """
        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        self.insert_data2()
        rv = client.get('/model2view/list/')
        eq_(rv.status_code, 200)
        data = rv.data.decode('utf-8')
        ok_('field_method_value' in data)
        self.clean_data()

    def test_compactCRUDMixin(self):
        """
            Test CompactCRUD Mixin view
        """
        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        self.insert_data2()
        rv = client.get('/model1compactview/list/')
        eq_(rv.status_code, 200)
        self.clean_data()

    # def test_charts_view(self):
    #     """
    #         Test Various Chart views
    #     """
    #     client = self.app.test_client()
    #     self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
    #     self.insert_data2()
    #     log.info("CHART TEST")
    #     rv = client.get('/model2groupbychartview/chart/')
    #     eq_(rv.status_code, 200)
    #     rv = client.get('/model2directbychartview/chart/')
    #     eq_(rv.status_code, 200)
    #     rv = client.get('/model2directchartview/chart/')
    #     #eq_(rv.status_code, 200)
    #     self.clean_data()

    """
    def test_master_detail_view(self):

        client = self.app.test_client()
        self.login(client, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD)
        self.insert_data2()
        rv = client.get('/model1masterview/list/')
        eq_(rv.status_code, 200)
        rv = client.get('/model1masterview/list/1')
        eq_(rv.status_code, 200)
        rv = client.get('/model1masterchartview/list/')
        eq_(rv.status_code, 200)
        rv = client.get('/model1masterchartview/list/1')
        eq_(rv.status_code, 200)
    """
