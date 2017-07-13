# Copyright (c) 2012-2013 Mitch Garnaat http://garnaat.org/
# Copyright 2012-2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You
# may not use this file except in compliance with the License. A copy of
# the License is located at
#
# http://aws.amazon.com/apache2.0/
#
# or in the "license" file accompanying this file. This file is
# distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
# ANY KIND, either express or implied. See the License for the specific
# language governing permissions and limitations under the License.
from botocore.utils import merge_dicts


def build_retry_config(endpoint_prefix, retry_model, definitions):
    service_config = retry_model.get(endpoint_prefix, {})
    resolve_references(service_config, definitions)
    # We want to merge the global defaults with the service specific
    # defaults, with the service specific defaults taking precedence.
    # So we use the global defaults as the base.
    final_retry_config = {'__default__': retry_model.get('__default__', {})}
    resolve_references(final_retry_config, definitions)
    # The merge the service specific config on top.
    merge_dicts(final_retry_config, service_config)
    return final_retry_config


def resolve_references(config, definitions):
    """Recursively replace $ref keys.

    To cut down on duplication, common definitions can be declared
    (and passed in via the ``definitions`` attribute) and then
    references as {"$ref": "name"}, when this happens the reference
    dict is placed with the value from the ``definition`` dict.

    This is recursively done.

    """
    for key, value in config.items():
        if isinstance(value, dict):
            if len(value) == 1 and list(value.keys())[0] == '$ref':
                # Then we need to resolve this reference.
                config[key] = definitions[list(value.values())[0]]
            else:
                resolve_references(value, definitions)
