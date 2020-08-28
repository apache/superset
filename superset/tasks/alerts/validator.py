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

import json
from typing import Callable

from superset.models.alerts import AlertValidatorType, SQLObserver


def not_null_validator(
    observer: SQLObserver, validator_config: str  # pylint: disable=unused-argument
) -> bool:
    """Returns True if a SQLObserver's recent observation is not NULL"""

    observation = observer.get_observations(1)[0]
    if not observation.valid_result or observation.value == 0:
        return False
    return True


def greater_than_validator(observer: SQLObserver, validator_config: str) -> bool:
    """
    Returns True if a SQLObserver's recent observation is greater than or equal to
    the value given in the validator config
    """

    observation = observer.get_observations(1)[0]
    threshold = json.loads(validator_config)["gte_threshold"]
    if observation.valid_result and observation.value >= threshold:
        return True

    return False


def less_than_validator(observer: SQLObserver, validator_config: str) -> bool:
    """
    Returns True if a SQLObserver's recent observation is less than or equal to
    the value given in the validator config
    """

    observation = observer.get_observations(1)[0]
    threshold = json.loads(validator_config)["lte_threshold"]
    if observation.valid_result and observation.value <= threshold:
        return True

    return False


def get_validator_function(
    validator_type: AlertValidatorType,
) -> Callable[[SQLObserver, str], bool]:
    """Returns a validation function based on validator_type"""

    validator_validators = {
        AlertValidatorType.not_null: not_null_validator,
        AlertValidatorType.gte_threshold: greater_than_validator,
        AlertValidatorType.lte_threshold: less_than_validator,
    }

    return validator_validators[validator_type]
