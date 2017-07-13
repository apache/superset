# -*- coding: utf-8 -*-
"""

Jinja2 extension that adds support for caching template fragments.

Usage:
    {% cache [timeout [,[key1, [key2, ...]]]] %}
    ...
    {% endcache %}

    By default the value of "path to template file" + "block start line" is used as cache key.
    Also one or multiple key names can be set manually
    that can be used to avoid the same block evaluating in different templates.

    Set timeout to "del" to delete cached value:
    {% cache 'del' %}...

Example:
    Considering we have render_form_field and render_submit macroses.
    {% cache 60*5 %}
    <div>
        <form>
        {% render_form_field form.username %}
        {% render_submit %}
        </form>
    </div>
    {% endcache %}

"""

from jinja2 import nodes
from jinja2.ext import Extension
from flaskext.cache import JINJA_CACHE_ATTR_NAME

class CacheExtension(Extension):
    tags = set(['cache'])

    def parse(self, parser):
        lineno = parser.stream.next().lineno
        #cache key name is "template file path" + "line no"
        default_cache_key_name = u"%s%s" % (parser.filename, lineno)
        default_cache_key_name.encode('utf-8')

        cache_key_names = [nodes.Const(default_cache_key_name)]
        #parse timeout
        if parser.stream.current.type != 'block_end':
            timeout = parser.parse_expression()
            while parser.stream.skip_if('comma'):
                keyname = parser.parse_expression()
                if isinstance(keyname, nodes.Name):
                    keyname = nodes.Const(keyname.name)
                cache_key_names.append(keyname)
        else:
            timeout = nodes.Const(None)

        args = [nodes.List(cache_key_names), timeout]

        body = parser.parse_statements(['name:endcache'], drop_needle=True)

        return nodes.CallBlock(self.call_method('_cache', args),
            [], [], body).set_lineno(lineno)

    def _cache(self, keys_list, timeout, caller):
        try:
            cache = getattr(self.environment, JINJA_CACHE_ATTR_NAME)
        except AttributeError, e:
            raise e

        if timeout == "del":
            cache.delete_many(*keys_list)
            return caller()

        rv = cache.get(keys_list[0])

        if rv is None:
            rv = caller()

            for key in keys_list:
                cache.set(key, rv, timeout)

        return rv
