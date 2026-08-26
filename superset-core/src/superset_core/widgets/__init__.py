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

"""Public contract for registering Dashboard V2 widgets.

Re-exported with the redundant-alias form so these are recognized as
intentional re-exports (this codebase does not use ``__all__``).
"""

from superset_core.widgets.base import Widget as Widget
from superset_core.widgets.composites import (
    composite_control as composite_control,
    list_composite_controls as list_composite_controls,
    MetricControl as MetricControl,
)
from superset_core.widgets.decorators import widget as widget
