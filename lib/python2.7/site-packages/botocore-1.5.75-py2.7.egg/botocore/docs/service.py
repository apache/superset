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
from botocore.exceptions import DataNotFoundError
from botocore.docs.utils import get_official_service_name
from botocore.docs.client import ClientDocumenter
from botocore.docs.waiter import WaiterDocumenter
from botocore.docs.paginator import PaginatorDocumenter
from botocore.docs.bcdoc.restdoc import DocumentStructure


class ServiceDocumenter(object):
    def __init__(self, service_name, session):
        self._session = session
        self._service_name = service_name

        self._client = self._session.create_client(
            service_name, region_name='us-east-1', aws_access_key_id='foo',
            aws_secret_access_key='bar')

        self.sections = [
            'title',
            'table-of-contents',
            'client-api',
            'paginator-api',
            'waiter-api'
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
        self.client_api(doc_structure.get_section('client-api'))
        self.paginator_api(doc_structure.get_section('paginator-api'))
        self.waiter_api(doc_structure.get_section('waiter-api'))
        return doc_structure.flush_structure()

    def title(self, section):
        section.style.h1(self._client.__class__.__name__)

    def table_of_contents(self, section):
        section.style.table_of_contents(title='Table of Contents', depth=2)

    def client_api(self, section):
        examples = None
        try:
            examples = self.get_examples(self._service_name)
        except DataNotFoundError:
            pass

        ClientDocumenter(self._client, examples).document_client(section)

    def paginator_api(self, section):
        try:
            service_paginator_model = self._session.get_paginator_model(
                self._service_name)
        except DataNotFoundError:
            return
        paginator_documenter = PaginatorDocumenter(
            self._client, service_paginator_model)
        paginator_documenter.document_paginators(section)

    def waiter_api(self, section):
        if self._client.waiter_names:
            service_waiter_model = self._session.get_waiter_model(
                self._service_name)
            waiter_documenter = WaiterDocumenter(
                self._client, service_waiter_model)
            waiter_documenter.document_waiters(section)

    def get_examples(self, service_name, api_version=None):
        loader = self._session.get_component('data_loader')
        examples = loader.load_service_model(
            service_name, 'examples-1', api_version)
        return examples['examples']
