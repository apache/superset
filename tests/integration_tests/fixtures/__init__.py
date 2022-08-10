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

from .birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_dashboard_with_slices_module_scope,
)
from .energy_dashboard import load_energy_table_data, load_energy_table_with_slice
from .public_role import public_role_like_gamma, public_role_like_test_role
from .unicode_dashboard import (
    load_unicode_dashboard_with_position,
    load_unicode_dashboard_with_slice,
)
from .world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_dashboard_with_slices_module_scope,
)
