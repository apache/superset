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
from botocore.utils import get_service_module_name
from botocore.docs.method import document_model_driven_method


class WaiterDocumenter(object):
    def __init__(self, client, service_waiter_model):
        self._client = client
        self._service_name = self._client.meta.service_model.service_name
        self._service_waiter_model = service_waiter_model

    def document_waiters(self, section):
        """Documents the various waiters for a service.

        :param section: The section to write to.
        """
        section.style.h2('Waiters')
        section.style.new_line()
        section.writeln('The available waiters are:')
        for waiter_name in self._service_waiter_model.waiter_names:
            section.style.li(
                ':py:class:`%s.Waiter.%s`' % (
                    self._client.__class__.__name__, waiter_name))
            self._add_single_waiter(section, waiter_name)

    def _add_single_waiter(self, section, waiter_name):
        section = section.add_new_section(waiter_name)
        section.style.start_sphinx_py_class(
            class_name='%s.Waiter.%s' % (
                self._client.__class__.__name__, waiter_name))

        # Add example on how to instantiate waiter.
        section.style.start_codeblock()
        section.style.new_line()
        section.write(
            'waiter = client.get_waiter(\'%s\')' % xform_name(waiter_name)
        )
        section.style.end_codeblock()

        # Add information on the wait() method
        section.style.new_line()
        document_wait_method(
            section=section,
            waiter_name=waiter_name,
            event_emitter=self._client.meta.events,
            service_model=self._client.meta.service_model,
            service_waiter_model=self._service_waiter_model
        )


def document_wait_method(section, waiter_name, event_emitter,
                         service_model, service_waiter_model,
                         include_signature=True):
    """Documents a the wait method of a waiter

    :param section: The section to write to

    :param waiter_name: The name of the waiter

    :param event_emitter: The event emitter to use to emit events

    :param service_model: The service model

    :param service_waiter_model: The waiter model associated to the service

    :param include_signature: Whether or not to include the signature.
        It is useful for generating docstrings.
    """
    waiter_model = service_waiter_model.get_waiter(waiter_name)
    operation_model = service_model.operation_model(
        waiter_model.operation)

    wait_description = (
        'Polls :py:meth:`{0}.Client.{1}` every {2} '
        'seconds until a successful state is reached. An error is '
        'returned after {3} failed checks.'.format(
            get_service_module_name(service_model),
            xform_name(waiter_model.operation),
            waiter_model.delay, waiter_model.max_attempts)
    )

    document_model_driven_method(
        section, 'wait', operation_model,
        event_emitter=event_emitter,
        method_description=wait_description,
        example_prefix='waiter.wait',
        document_output=False,
        include_signature=include_signature
    )
