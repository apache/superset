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
from typing import Optional

from flask_appbuilder.security.sqla.models import User

from superset.charts.commands.exceptions import (
    ChartAccessDeniedError,
    ChartNotFoundError,
)
from superset.datasets.commands.exceptions import (
    DatasetAccessDeniedError,
    DatasetNotFoundError,
)
from superset.explore.utils import check_access as explore_check_access
from superset.temporary_cache.commands.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheResourceNotFoundError,
)
from superset.utils.core import DatasourceType


def check_access(
    datasource_id: int,
    chart_id: Optional[int],
    actor: User,
    datasource_type: DatasourceType,
) -> None:
    try:
        explore_check_access(datasource_id, chart_id, actor, datasource_type)
    except (ChartNotFoundError, DatasetNotFoundError) as ex:
        raise TemporaryCacheResourceNotFoundError from ex
    except (ChartAccessDeniedError, DatasetAccessDeniedError) as ex:
        raise TemporaryCacheAccessDeniedError from ex
