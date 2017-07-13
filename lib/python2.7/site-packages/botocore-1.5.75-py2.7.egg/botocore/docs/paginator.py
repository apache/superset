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
from botocore.compat import OrderedDict
from botocore.docs.utils import DocumentedShape
from botocore.utils import get_service_module_name
from botocore.docs.method import document_model_driven_method


class PaginatorDocumenter(object):
    def __init__(self, client, service_paginator_model):
        self._client = client
        self._service_name = self._client.meta.service_model.service_name
        self._service_paginator_model = service_paginator_model

    def document_paginators(self, section):
        """Documents the various paginators for a service

        param section: The section to write to.
        """
        section.style.h2('Paginators')
        section.style.new_line()
        section.writeln('The available paginators are:')

        paginator_names = sorted(
            self._service_paginator_model._paginator_config)

        # List the available paginators and then document each paginator.
        for paginator_name in paginator_names:
            section.style.li(
                ':py:class:`%s.Paginator.%s`' % (
                    self._client.__class__.__name__, paginator_name))
            self._add_paginator(section, paginator_name)

    def _add_paginator(self, section, paginator_name):
        section = section.add_new_section(paginator_name)

        # Docment the paginator class
        section.style.start_sphinx_py_class(
            class_name='%s.Paginator.%s' % (
                self._client.__class__.__name__, paginator_name))
        section.style.start_codeblock()
        section.style.new_line()

        # Document how to instantiate the paginator.
        section.write(
            'paginator = client.get_paginator(\'%s\')' % xform_name(
                paginator_name)
        )
        section.style.end_codeblock()
        section.style.new_line()
        # Get the pagination model for the particular paginator.
        paginator_config = self._service_paginator_model.get_paginator(
            paginator_name)
        document_paginate_method(
            section=section,
            paginator_name=paginator_name,
            event_emitter=self._client.meta.events,
            service_model=self._client.meta.service_model,
            paginator_config=paginator_config
        )


def document_paginate_method(section, paginator_name, event_emitter,
                             service_model, paginator_config,
                             include_signature=True):
    """Documents the paginate method of a paginator

    :param section: The section to write to

    :param paginator_name: The name of the paginator. It is snake cased.

    :param event_emitter: The event emitter to use to emit events

    :param service_model: The service model

    :param paginator_config: The paginator config associated to a particular
        paginator.

    :param include_signature: Whether or not to include the signature.
        It is useful for generating docstrings.
    """
    # Retrieve the operation model of the underlying operation.
    operation_model = service_model.operation_model(
        paginator_name)

    # Add representations of the request and response parameters
    # we want to include in the description of the paginate method.
    # These are parameters we expose via the botocore interface.
    pagination_config_members = OrderedDict()

    pagination_config_members['MaxItems'] = DocumentedShape(
        name='MaxItems', type_name='integer',
        documentation=(
            '<p>The total number of items to return. If the total '
            'number of items available is more than the value '
            'specified in max-items then a <code>NextToken</code> '
            'will be provided in the output that you can use to '
            'resume pagination.</p>'))

    pagination_config_members['PageSize'] = DocumentedShape(
        name='PageSize', type_name='integer',
        documentation='<p>The size of each page.<p>')

    pagination_config_members['StartingToken'] = DocumentedShape(
        name='StartingToken', type_name='string',
        documentation=(
            '<p>A token to specify where to start paginating. '
            'This is the <code>NextToken</code> from a previous '
            'response.</p>'))

    botocore_pagination_params = [
        DocumentedShape(
            name='PaginationConfig', type_name='structure',
            documentation=(
                '<p>A dictionary that provides parameters to control '
                'pagination.</p>'),
            members=pagination_config_members)
    ]

    botocore_pagination_response_params = [
        DocumentedShape(
            name='NextToken', type_name='string',
            documentation=(
                '<p>A token to resume pagination.</p>'))
    ]

    service_pagination_params = []

    # Add the normal input token of the method to a list
    # of input paramters that we wish to hide since we expose our own.
    if isinstance(paginator_config['input_token'], list):
        service_pagination_params += paginator_config['input_token']
    else:
        service_pagination_params.append(paginator_config['input_token'])

    # Hide the limit key in the documentation.
    if paginator_config.get('limit_key', None):
        service_pagination_params.append(paginator_config['limit_key'])

    # Hide the output tokens in the documentation.
    service_pagination_response_params = []
    if isinstance(paginator_config['output_token'], list):
        service_pagination_response_params += paginator_config[
            'output_token']
    else:
        service_pagination_response_params.append(paginator_config[
            'output_token'])

    paginate_description = (
        'Creates an iterator that will paginate through responses '
        'from :py:meth:`{0}.Client.{1}`.'.format(
            get_service_module_name(service_model), xform_name(paginator_name))
    )

    document_model_driven_method(
        section, 'paginate', operation_model,
        event_emitter=event_emitter,
        method_description=paginate_description,
        example_prefix='response_iterator = paginator.paginate',
        include_input=botocore_pagination_params,
        include_output=botocore_pagination_response_params,
        exclude_input=service_pagination_params,
        exclude_output=service_pagination_response_params,
        include_signature=include_signature
    )
