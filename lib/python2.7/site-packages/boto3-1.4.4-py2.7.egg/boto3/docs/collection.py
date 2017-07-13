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
from botocore import xform_name
from botocore.docs.method import get_instance_public_methods
from botocore.docs.utils import DocumentedShape

from boto3.docs.base import BaseDocumenter
from boto3.docs.utils import get_resource_ignore_params
from boto3.docs.method import document_model_driven_resource_method
from boto3.docs.utils import add_resource_type_overview


class CollectionDocumenter(BaseDocumenter):
    def document_collections(self, section):
        collections = self._resource.meta.resource_model.collections
        collections_list = []
        add_resource_type_overview(
            section=section,
            resource_type='Collections',
            description=(
                'Collections provide an interface to iterate over and '
                'manipulate groups of resources. '),
            intro_link='guide_collections')
        self.member_map['collections'] = collections_list
        for collection in collections:
            collection_section = section.add_new_section(collection.name)
            collections_list.append(collection.name)
            self._document_collection(collection_section, collection)

    def _document_collection(self, section, collection):
        methods = get_instance_public_methods(
            getattr(self._resource, collection.name))
        document_collection_object(section, collection)
        batch_actions = {}
        for batch_action in collection.batch_actions:
            batch_actions[batch_action.name] = batch_action

        for method in sorted(methods):
            method_section = section.add_new_section(method)
            if method in batch_actions:
                document_batch_action(
                    section=method_section,
                    resource_name=self._resource_name,
                    event_emitter=self._resource.meta.client.meta.events,
                    batch_action_model=batch_actions[method],
                    collection_model=collection,
                    service_model=self._resource.meta.client.meta.service_model
                )
            else:
                document_collection_method(
                    section=method_section,
                    resource_name=self._resource_name,
                    action_name=method,
                    event_emitter=self._resource.meta.client.meta.events,
                    collection_model=collection,
                    service_model=self._resource.meta.client.meta.service_model
                )


def document_collection_object(section, collection_model,
                               include_signature=True):
    """Documents a collection resource object

    :param section: The section to write to

    :param collection_model: The model of the collection

    :param include_signature: Whether or not to include the signature.
        It is useful for generating docstrings.
    """
    if include_signature:
        section.style.start_sphinx_py_attr(collection_model.name)
    section.include_doc_string(
        'A collection of %s resources' % collection_model.resource.type)


def document_batch_action(section, resource_name, event_emitter,
                          batch_action_model, service_model, collection_model,
                          include_signature=True):
    """Documents a collection's batch action

    :param section: The section to write to

    :param resource_name: The name of the resource

    :param action_name: The name of collection action. Currently only
        can be all, filter, limit, or page_size

    :param event_emitter: The event emitter to use to emit events

    :param batch_action_model: The model of the batch action

    :param collection_model: The model of the collection

    :param service_model: The model of the service

    :param include_signature: Whether or not to include the signature.
        It is useful for generating docstrings.
    """
    operation_model = service_model.operation_model(
        batch_action_model.request.operation)
    ignore_params = get_resource_ignore_params(
        batch_action_model.request.params)

    example_return_value = 'response'
    if batch_action_model.resource:
        example_return_value = xform_name(batch_action_model.resource.type)

    example_resource_name = xform_name(resource_name)
    if service_model.service_name == resource_name:
        example_resource_name = resource_name
    example_prefix = '%s = %s.%s.%s' % (
        example_return_value, example_resource_name,
        collection_model.name, batch_action_model.name
    )
    document_model_driven_resource_method(
        section=section, method_name=batch_action_model.name,
        operation_model=operation_model,
        event_emitter=event_emitter,
        method_description=operation_model.documentation,
        example_prefix=example_prefix,
        exclude_input=ignore_params,
        resource_action_model=batch_action_model,
        include_signature=include_signature
    )


def document_collection_method(section, resource_name, action_name,
                               event_emitter, collection_model, service_model,
                               include_signature=True):
    """Documents a collection method

    :param section: The section to write to

    :param resource_name: The name of the resource

    :param action_name: The name of collection action. Currently only
        can be all, filter, limit, or page_size

    :param event_emitter: The event emitter to use to emit events

    :param collection_model: The model of the collection

    :param service_model: The model of the service

    :param include_signature: Whether or not to include the signature.
        It is useful for generating docstrings.
    """
    operation_model = service_model.operation_model(
        collection_model.request.operation)

    underlying_operation_members = []
    if operation_model.input_shape:
        underlying_operation_members = operation_model.input_shape.members

    example_resource_name = xform_name(resource_name)
    if service_model.service_name == resource_name:
        example_resource_name = resource_name

    custom_action_info_dict = {
        'all': {
            'method_description': (
                'Creates an iterable of all %s resources '
                'in the collection.' % collection_model.resource.type),
            'example_prefix': '%s_iterator = %s.%s.all' % (
                xform_name(collection_model.resource.type),
                example_resource_name, collection_model.name),
            'exclude_input': underlying_operation_members
        },
        'filter': {
            'method_description': (
                'Creates an iterable of all %s resources '
                'in the collection filtered by kwargs passed to '
                'method.' % collection_model.resource.type),
            'example_prefix': '%s_iterator = %s.%s.filter' % (
                xform_name(collection_model.resource.type),
                example_resource_name, collection_model.name),
            'exclude_input': get_resource_ignore_params(
                collection_model.request.params)
        },
        'limit': {
            'method_description': (
                'Creates an iterable up to a specified amount of '
                '%s resources in the collection.' %
                collection_model.resource.type),
            'example_prefix': '%s_iterator = %s.%s.limit' % (
                xform_name(collection_model.resource.type),
                example_resource_name, collection_model.name),
            'include_input': [
                DocumentedShape(
                    name='count', type_name='integer',
                    documentation=(
                        'The limit to the number of resources '
                        'in the iterable.'))],
            'exclude_input': underlying_operation_members
        },
        'page_size': {
            'method_description': (
                'Creates an iterable of all %s resources '
                'in the collection, but limits the number of '
                'items returned by each service call by the specified '
                'amount.' % collection_model.resource.type),
            'example_prefix': '%s_iterator = %s.%s.page_size' % (
                xform_name(collection_model.resource.type),
                example_resource_name, collection_model.name),
            'include_input': [
                DocumentedShape(
                    name='count', type_name='integer',
                    documentation=(
                        'The number of items returned by each '
                        'service call'))],
            'exclude_input': underlying_operation_members
        }
    }
    if action_name in custom_action_info_dict:
        action_info = custom_action_info_dict[action_name]
        document_model_driven_resource_method(
            section=section, method_name=action_name,
            operation_model=operation_model,
            event_emitter=event_emitter,
            resource_action_model=collection_model,
            include_signature=include_signature,
            **action_info
        )
