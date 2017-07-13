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
import os

import boto3
from botocore.exceptions import DataNotFoundError
from botocore.docs.service import ServiceDocumenter as BaseServiceDocumenter
from botocore.docs.bcdoc.restdoc import DocumentStructure

from boto3.utils import ServiceContext
from boto3.docs.client import Boto3ClientDocumenter
from boto3.docs.resource import ResourceDocumenter
from boto3.docs.resource import ServiceResourceDocumenter


class ServiceDocumenter(BaseServiceDocumenter):
    # The path used to find examples
    EXAMPLE_PATH = os.path.join(os.path.dirname(boto3.__file__), 'examples')

    def __init__(self, service_name, session):
        self._service_name = service_name
        self._boto3_session = session
        # I know that this is an internal attribute, but the botocore session
        # is needed to load the paginator and waiter models.
        self._session = session._session
        self._client = self._boto3_session.client(service_name)
        self._service_resource = None
        if self._service_name in self._boto3_session.get_available_resources():
            self._service_resource = self._boto3_session.resource(service_name)
        self.sections = [
            'title',
            'table-of-contents',
            'client',
            'paginators',
            'waiters',
            'service-resource',
            'resources',
            'examples'
        ]

    def document_service(self):
        """Documents an entire service.

        :returns: The reStructured text of the documented service.
        """
        doc_structure = DocumentStructure(
            self._service_name, section_names=self.sections,
            target='html')
        self.title(doc_structure.get_section('title'))
        self.table_of_contents(doc_structure.get_section('table-of-contents'))

        self.client_api(doc_structure.get_section('client'))
        self.paginator_api(doc_structure.get_section('paginators'))
        self.waiter_api(doc_structure.get_section('waiters'))
        if self._service_resource:
            self._document_service_resource(
                doc_structure.get_section('service-resource'))
            self._document_resources(doc_structure.get_section('resources'))
        self._document_examples(doc_structure.get_section('examples'))
        return doc_structure.flush_structure()

    def client_api(self, section):
        examples = None
        try:
            examples = self.get_examples(self._service_name)
        except DataNotFoundError:
            pass

        Boto3ClientDocumenter(self._client, examples).document_client(section)

    def _document_service_resource(self, section):
        ServiceResourceDocumenter(
            self._service_resource, self._session).document_resource(
                section)

    def _document_resources(self, section):
        temp_identifier_value = 'foo'
        loader = self._session.get_component('data_loader')
        json_resource_model = loader.load_service_model(
            self._service_name, 'resources-1')
        service_model = self._service_resource.meta.client.meta.service_model
        for resource_name in json_resource_model['resources']:
            resource_model = json_resource_model['resources'][resource_name]
            resource_cls = self._boto3_session.resource_factory.\
                load_from_definition(
                    resource_name=resource_name,
                    single_resource_json_definition=resource_model,
                    service_context=ServiceContext(
                        service_name=self._service_name,
                        resource_json_definitions=json_resource_model[
                            'resources'],
                        service_model=service_model,
                        service_waiter_model=None
                    )
                )
            identifiers = resource_cls.meta.resource_model.identifiers
            args = []
            for _ in identifiers:
                args.append(temp_identifier_value)
            resource = resource_cls(*args, client=self._client)
            ResourceDocumenter(
                resource, self._session).document_resource(
                    section.add_new_section(resource.meta.resource_model.name))

    def _get_example_file(self):
        return os.path.realpath(
            os.path.join(self.EXAMPLE_PATH,
                         self._service_name + '.rst'))

    def _document_examples(self, section):
        examples_file = self._get_example_file()
        if os.path.isfile(examples_file):
            section.style.h2('Examples')
            section.style.new_line()
            section.write(".. contents::\n    :local:\n    :depth: 1")
            section.style.new_line()
            section.style.new_line()
            with open(examples_file, 'r') as f:
                section.write(f.read())
