from __future__ import absolute_import

SOUTH_ERROR_MESSAGE = """
For South support, customize the SOUTH_MIGRATION_MODULES setting
to point to the correct migrations module:

    SOUTH_MIGRATION_MODULES = {
        'kombu_transport_django': 'kombu.transport.django.south_migrations',
    }
"""

try:
    from django.db import migrations  # noqa
except ImportError:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured(SOUTH_ERROR_MESSAGE)
