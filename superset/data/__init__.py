# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from .bart_lines import load_bart_lines  # noqa
from .birth_names import load_birth_names  # noqa
from .country_map import load_country_map_data  # noqa
from .css_templates import load_css_templates  # noqa
from .deck import load_deck_dash  # noqa
from .energy import load_energy  # noqa
from .flights import load_flights  # noqa
from .long_lat import load_long_lat_data  # noqa
from .misc_dashboard import load_misc_dashboard  # noqa
from .multi_line import load_multi_line  # noqa
from .multiformat_time_series import load_multiformat_time_series  # noqa
from .paris import load_paris_iris_geojson  # noqa
from .random_time_series import load_random_time_series_data  # noqa
from .sf_population_polygons import load_sf_population_polygons  # noqa
from .unicode_test_data import load_unicode_test_data  # noqa
from .world_bank import load_world_bank_health_n_pop  # noqa

from abc import ABC

class AbstractSupersetExample(ABC):
    """Defines interface through which superset examples load themselves."""

    def __init__(self, description):
        self.description = description

    def load_data(self):
        # Task 1: Load file and create pandas.DataFrame
        # Task 2: Load data into SQL with pandas.DataFrame.to_sql() 
        # Task 3: Process through ORM to get back workable Table object from whichever data source the table is in
        pass

    def create_metrics(self): 
        # Task 1: Build any TableColumns
        # Task 2: Build Metrics - SQLMetrics
        # Task 3: Store metrics in DB via ORM
        pass
    
    def create_charts(self, slices):
        # Task 1: Build Slice from config/JSON
        # Task 2: Store to DB via - misc_dash_slices.add(slc.slice_name) / merge_slice(slc)
        pass
    
    def create_dashboards(self, name, config):
        # Task 1: Instantiate Dash via ORM
        # Task 2: Configure Dash via JSON
        # Task 3: Store to DB via ORM
        pass


class SupersetConfigExample():
    """Defines interface through which superset examples define themselves"""

    def __init__(self, description):
        self.description = description

    def load_data(self, data_path, data_types='csv', encoding='utf-8', dt_column=None):
        # Task 1: Load file and create pandas.DataFrame
        # Task 2: Load data into SQL with pandas.DataFrame.to_sql() 
        # Task 3: Process through ORM to get back workable Table object from whichever data source the table is in

        pass

    def create_metrics(self, metrics): 
        # Task 1: Build TableColumns
        # Task 2: Build Metrics - SQLMetrics
        # Task 3: Store metrics in DB via ORM
        pass
    
    def create_charts(self, slices):
        # Task 1: Build Slice from config/JSON
        # Task 2: Store to DB via - misc_dash_slices.add(slc.slice_name) / merge_slice(slc)
        pass
    
    def create_dashboards(self, name, config):
        # Task 1: Instantiate Dash via ORM
        # Task 2: Configure Dash via JSON
        # Task 3: Store to DB via ORM
        pass

