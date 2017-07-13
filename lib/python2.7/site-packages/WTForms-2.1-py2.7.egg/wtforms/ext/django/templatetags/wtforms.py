"""
Template tags for easy WTForms access in Django templates.
"""
from __future__ import unicode_literals

import re

from django import template
from django.conf import settings
from django.template import Variable

from ....compat import iteritems

register = template.Library()


class FormFieldNode(template.Node):
    def __init__(self, field_var, html_attrs):
        self.field_var = field_var
        self.html_attrs = html_attrs

    def render(self, context):
        try:
            if '.' in self.field_var:
                base, field_name = self.field_var.rsplit('.', 1)
                field = getattr(Variable(base).resolve(context), field_name)
            else:
                field = context[self.field_var]
        except (template.VariableDoesNotExist, KeyError, AttributeError):
            return settings.TEMPLATE_STRING_IF_INVALID

        h_attrs = {}
        for k, v in iteritems(self.html_attrs):
            try:
                h_attrs[k] = v.resolve(context)
            except template.VariableDoesNotExist:
                h_attrs[k] = settings.TEMPLATE_STRING_IF_INVALID

        return field(**h_attrs)


@register.tag(name='form_field')
def do_form_field(parser, token):
    """
    Render a WTForms form field allowing optional HTML attributes.
    Invocation looks like this:
      {% form_field form.username class="big_text" onclick="alert('hello')" %}
    where form.username is the path to the field value we want.  Any number
    of key="value" arguments are supported. Unquoted values are resolved as
    template variables.
    """
    parts = token.contents.split(' ', 2)
    if len(parts) < 2:
        error_text = '%r tag must have the form field name as the first value, followed by optional key="value" attributes.'
        raise template.TemplateSyntaxError(error_text % parts[0])

    html_attrs = {}
    if len(parts) == 3:
        raw_args = list(args_split(parts[2]))
        if (len(raw_args) % 2) != 0:
            raise template.TemplateSyntaxError('%r tag received the incorrect number of key=value arguments.' % parts[0])
        for x in range(0, len(raw_args), 2):
            html_attrs[str(raw_args[x])] = Variable(raw_args[x + 1])

    return FormFieldNode(parts[1], html_attrs)


args_split_re = re.compile(r'''("(?:[^"\\]*(?:\\.[^"\\]*)*)"|'(?:[^'\\]*(?:\\.[^'\\]*)*)'|[^\s=]+)''')


def args_split(text):
    """ Split space-separated key=value arguments.  Keeps quoted strings intact. """
    for bit in args_split_re.finditer(text):
        bit = bit.group(0)
        if bit[0] == '"' and bit[-1] == '"':
            yield '"' + bit[1:-1].replace('\\"', '"').replace('\\\\', '\\') + '"'
        elif bit[0] == "'" and bit[-1] == "'":
            yield "'" + bit[1:-1].replace("\\'", "'").replace("\\\\", "\\") + "'"
        else:
            yield bit
