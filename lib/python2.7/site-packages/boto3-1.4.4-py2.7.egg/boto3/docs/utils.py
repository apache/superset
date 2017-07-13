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

import jmespath

from botocore.compat import six


def get_resource_ignore_params(params):
    """Helper method to determine which parameters to ignore for actions

    :returns: A list of the parameter names that does not need to be
        included in a resource's method call for documentation purposes.
    """
    ignore_params = []
    for param in params:
        result = jmespath.compile(param.target)
        current = result.parsed
        # Use JMESPath to find the left most element in the target expression
        # which will be the parameter to ignore in the action call.
        while current['children']:
            current = current['children'][0]
        # Make sure the parameter we are about to ignore is a field.
        # If it is not, we should ignore the result to avoid false positives.
        if current['type'] == 'field':
            ignore_params.append(current['value'])
    return ignore_params


def is_resource_action(action_handle):
    if six.PY3:
        return inspect.isfunction(action_handle)
    else:
        return inspect.ismethod(action_handle)


def get_resource_public_actions(resource_class):
    resource_class_members = inspect.getmembers(resource_class)
    resource_methods = {}
    for name, member in resource_class_members:
        if not name.startswith('_'):
            if not name[0].isupper():
                if not name.startswith('wait_until'):
                    if is_resource_action(member):
                        resource_methods[name] = member
    return resource_methods


def get_identifier_values_for_example(identifier_names):
    example_values = ['\'%s\'' % identifier for identifier in identifier_names]
    return ','.join(example_values)


def get_identifier_args_for_signature(identifier_names):
    return ','.join(identifier_names)


def get_identifier_description(resource_name, identifier_name):
    return "The %s's %s identifier. This **must** be set." % (
        resource_name, identifier_name)


def add_resource_type_overview(section, resource_type, description,
                               intro_link=None):
    section.style.new_line()
    section.write('.. rst-class:: admonition-title')
    section.style.new_line()
    section.style.new_line()
    section.write(resource_type)
    section.style.new_line()
    section.style.new_line()
    section.write(description)
    section.style.new_line()
    if intro_link is not None:
        section.write('For more information about %s refer to the '
                      ':ref:`Resources Introduction Guide<%s>`.' % (
                          resource_type.lower(), intro_link))
        section.style.new_line()


class DocumentModifiedShape(object):
    def __init__(self, shape_name, new_type, new_description,
                 new_example_value):
        self._shape_name = shape_name
        self._new_type = new_type
        self._new_description = new_description
        self._new_example_value = new_example_value

    def replace_documentation_for_matching_shape(self, event_name, section,
                                                 **kwargs):
        if self._shape_name == section.context.get('shape'):
            self._replace_documentation(event_name, section)
        for section_name in section.available_sections:
            sub_section = section.get_section(section_name)
            if self._shape_name == sub_section.context.get('shape'):
                self._replace_documentation(event_name, sub_section)
            else:
                self.replace_documentation_for_matching_shape(
                    event_name, sub_section)

    def _replace_documentation(self, event_name, section):
        if event_name.startswith('docs.request-example') or \
                event_name.startswith('docs.response-example'):
            section.remove_all_sections()
            section.clear_text()
            section.write(self._new_example_value)

        if event_name.startswith('docs.request-params') or \
                event_name.startswith('docs.response-params'):
            for section_name in section.available_sections:
                # Delete any extra members as a new shape is being
                # used.
                if section_name not in ['param-name', 'param-documentation',
                                        'end-structure', 'param-type',
                                        'end-param']:
                    section.delete_section(section_name)

            # Update the documentation
            description_section = section.get_section('param-documentation')
            description_section.clear_text()
            description_section.write(self._new_description)

            # Update the param type
            type_section = section.get_section('param-type')
            if type_section.getvalue().decode('utf-8').startswith(':type'):
                type_section.clear_text()
                type_section.write(':type %s: %s' % (
                    section.name, self._new_type))
            else:
                type_section.clear_text()
                type_section.style.italics('(%s) -- ' % self._new_type)
