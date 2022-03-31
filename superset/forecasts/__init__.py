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
from typing import Type, Union, Dict
from . import base
from .base import BaseForecaster, ProphetForecaster, LeastSquaresForecaster, ScikitLearnForecaster

from superset import app

from importlib import import_module

config = app.config


def get_model(
    model_name: str,
    confidence_interval: float,
    yearly_seasonality: Union[bool, int],
    monthly_seasonality: Union[bool, int],
    weekly_seasonality: Union[bool, int],
    daily_seasonality: Union[bool, int],
) -> Type[base.BaseForecaster]:
    model = available_models[model_name]
    return model(
        model_name=model_name,
        confidence_interval=confidence_interval,
        yearly_seasonality=yearly_seasonality,
        monthly_seasonality=monthly_seasonality,
        weekly_seasonality=weekly_seasonality,
        daily_seasonality=daily_seasonality,
    )


def register() -> Dict[str, Type[base.BaseForecaster]]:
    model_mapping = {}
    for model_name in config["ALLOWED_FORECASTERS"]:
        try:
            mod_name, cls_name = model_name.rsplit('.', 1)
            getattr(import_module(mod_name), cls_name)
            if model_name == "prophet.Prophet":
                model_mapping["prophet.Prophet"] = ProphetForecaster
            elif model_name == "numpy.linalg.lstsq":
                model_mapping["numpy.linalg.lstsq"] = LeastSquaresForecaster
            else:
                model_mapping[model_name] = ScikitLearnForecaster
        except AttributeError:
            pass
    return model_mapping


available_models = register()
