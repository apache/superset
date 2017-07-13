# Copyright 2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
from botocore.docs.params import ResponseParamsDocumenter

from boto3.docs.utils import get_identifier_description


class ResourceShapeDocumenter(ResponseParamsDocumenter):
    EVENT_NAME = 'resource-shape'


def document_attribute(section, service_name, resource_name, attr_name,
                       event_emitter, attr_model, include_signature=True):
    if include_signature:
        section.style.start_sphinx_py_attr(attr_name)
    # Note that an attribute may have one, may have many, or may have no
    # operations that back the resource's shape. So we just set the
    # operation_name to the resource name if we ever to hook in and modify
    # a particular attribute.
    ResourceShapeDocumenter(
        service_name=service_name, operation_name=resource_name,
        event_emitter=event_emitter).document_params(
            section=section,
            shape=attr_model)


def document_identifier(section, resource_name, identifier_model,
                        include_signature=True):
    if include_signature:
        section.style.start_sphinx_py_attr(identifier_model.name)
    description = get_identifier_description(
        resource_name, identifier_model.name)
    description = '*(string)* ' + description
    section.write(description)


def document_reference(section, reference_model, include_signature=True):
    if include_signature:
        section.style.start_sphinx_py_attr(reference_model.name)
    reference_type = '(:py:class:`%s`) ' % reference_model.resource.type
    section.write(reference_type)
    section.include_doc_string(
        'The related %s if set, otherwise ``None``.' % reference_model.name
    )
