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
# pylint: disable=too-few-public-methods

import logging
from typing import Any, Dict, List, Type, Union
from urllib import request
from urllib.error import URLError

from celery.utils.log import get_task_logger

from superset import app
from superset.extensions import celery_app
from superset.tasks.caching.strategies.dashboard_tags import DashboardTagsStrategy
from superset.tasks.caching.strategies.dummy import DummyStrategy
from superset.tasks.caching.strategies.top_n import TopNDashboardsStrategy
from superset.tasks.caching.strategy import Strategy

logger = get_task_logger(__name__)
logger.setLevel(logging.INFO)


strategies: List[Type[Strategy]] = [
    DummyStrategy,
    TopNDashboardsStrategy,
    DashboardTagsStrategy,
]


@celery_app.task(name="cache-warmup")
def cache_warmup(
    strategy_name: str, *args: Any, **kwargs: Any  # pylint: disable=unused-argument
) -> Union[Dict[str, List[str]], str]:
    """
    Warm up cache.

    This task periodically hits charts to warm up the cache.

    """
    logger.info("Loading strategy")
    class_ = None
    extra_strategies: List[Type[Strategy]] = app.config["EXTRA_CACHING_STRATEGIES"]
    for class_ in strategies + extra_strategies:
        if class_.__name__ == strategy_name:
            break
    else:
        message = f"No strategy {strategy_name} found!"
        logger.error(message, exc_info=True)
        return message

    logger.info("Loading %s", class_.__name__)
    try:
        strategy = class_(*args, **kwargs)  # pylint: disable=too-many-arguments
        logger.info("Success!")
    except TypeError:
        message = "Error loading strategy!"
        logger.exception(message)
        return message

    results: Dict[str, List[str]] = {"success": [], "errors": []}
    for url in strategy.get_urls():
        try:
            logger.info("Fetching %s", url)
            request.urlopen(url)  # pylint: disable=consider-using-with
            results["success"].append(url)
        except URLError:
            logger.exception("Error warming up cache!")
            results["errors"].append(url)

    return results
