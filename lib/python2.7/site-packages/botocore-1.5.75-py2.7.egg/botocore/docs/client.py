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
import inspect

from botocore.docs.utils import get_official_service_name
from botocore.docs.method import document_custom_method
from botocore.docs.method import document_model_driven_method
from botocore.docs.method import get_instance_public_methods
from botocore.docs.sharedexample import document_shared_examples


class ClientDocumenter(object):
    def __init__(self, client, shared_examples=None):
        self._client = client
        self._shared_examples = shared_examples
        if self._shared_examples is None:
            self._shared_examples = {}
        self._service_name = self._client.meta.service_model.service_name

    def document_client(self, section):
        """Documents a client and its methods

        :param section: The section to write to.
        """
        self._add_title(section)
        self._add_class_signature(section)
        client_methods = get_instance_public_methods(self._client)
        self._add_client_intro(section, client_methods)
        self._add_client_methods(section, client_methods)

    def _add_title(self, section):
        section.style.h2('Client')

    def _add_client_intro(self, section, client_methods):
        section = section.add_new_section('intro')
        # Write out the top level description for the client.
        official_service_name = get_official_service_name(
            self._client.meta.service_model)
        section.write(
            'A low-level client representing %s' % official_service_name)

        # Write out the client example instantiation.
        self._add_client_creation_example(section)

        # List out all of the possible client methods.
        section.style.new_line()
        section.write('These are the available methods:')
        section.style.new_line()
        class_name = self._client.__class__.__name__
        for method_name in sorted(client_methods):
            section.style.li(':py:meth:`~%s.Client.%s`' % (
                class_name, method_name))

    def _add_class_signature(self, section):
        section.style.start_sphinx_py_class(
            class_name='%s.Client' % self._client.__class__.__name__)

    def _add_client_creation_example(self, section):
        section.style.start_codeblock()
        section.style.new_line()
        section.write(
            'client = session.create_client(\'{service}\')'.format(
                service=self._service_name)
        )
        section.style.end_codeblock()

    def _add_client_methods(self, section, client_methods):
        section = section.add_new_section('methods')
        for method_name in sorted(client_methods):
            self._add_client_method(
                section, method_name, client_methods[method_name])

    def _add_client_method(self, section, method_name, method):
        section = section.add_new_section(method_name)
        if self._is_custom_method(method_name):
            self._add_custom_method(section, method_name, method)
        else:
            self._add_model_driven_method(section, method_name)

    def _is_custom_method(self, method_name):
        return method_name not in self._client.meta.method_to_api_mapping

    def _add_custom_method(self, section, method_name, method):
        document_custom_method(section, method_name, method)

    def _add_model_driven_method(self, section, method_name):
        service_model = self._client.meta.service_model
        operation_name = self._client.meta.method_to_api_mapping[method_name]
        operation_model = service_model.operation_model(operation_name)

        example_prefix = 'response = client.%s' % method_name
        document_model_driven_method(
            section, method_name, operation_model,
            event_emitter=self._client.meta.events,
            method_description=operation_model.documentation,
            example_prefix=example_prefix,
        )

        # Add the shared examples
        shared_examples = self._shared_examples.get(operation_name)
        if shared_examples:
            document_shared_examples(
                section, operation_model, example_prefix, shared_examples)
