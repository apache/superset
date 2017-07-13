# Copyright (c) 2012-2013 Mitch Garnaat http://garnaat.org/
# Copyright 2012-2014 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
import re
import logging

__version__ = '1.5.75'


class NullHandler(logging.Handler):
    def emit(self, record):
        pass

# Configure default logger to do nothing
log = logging.getLogger('botocore')
log.addHandler(NullHandler())


_first_cap_regex = re.compile('(.)([A-Z][a-z]+)')
_number_cap_regex = re.compile('([a-z])([0-9]+)')
_end_cap_regex = re.compile('([a-z0-9])([A-Z])')
# The regex below handles the special case where some acryonym
# name is pluralized, e.g GatewayARNs, ListWebACLs, SomeCNAMEs.
_special_case_transform = re.compile('[A-Z]{3,}s$')
# Prepopulate the cache with special cases that don't match
# our regular transformation.
_xform_cache = {
    ('CreateCachediSCSIVolume', '_'): 'create_cached_iscsi_volume',
    ('CreateCachediSCSIVolume', '-'): 'create-cached-iscsi-volume',
    ('DescribeCachediSCSIVolumes', '_'): 'describe_cached_iscsi_volumes',
    ('DescribeCachediSCSIVolumes', '-'): 'describe-cached-iscsi-volumes',
    ('DescribeStorediSCSIVolumes', '_'): 'describe_stored_iscsi_volumes',
    ('DescribeStorediSCSIVolumes', '-'): 'describe-stored-iscsi-volumes',
    ('CreateStorediSCSIVolume', '_'): 'create_stored_iscsi_volume',
    ('CreateStorediSCSIVolume', '-'): 'create-stored-iscsi-volume',
    ('ListHITsForQualificationType', '_'): 'list_hits_for_qualification_type',
    ('ListHITsForQualificationType', '-'): 'list-hits-for-qualification-type',
}
# The items in this dict represent partial renames to apply globally to all
# services which might have a matching argument or operation. This way a
# common mis-translation can be fixed without having to call out each
# individual case.
_partial_renames = {
    'ipv-6': 'ipv6',
    'ipv_6': 'ipv6',
}
ScalarTypes = ('string', 'integer', 'boolean', 'timestamp', 'float', 'double')

BOTOCORE_ROOT = os.path.dirname(os.path.abspath(__file__))

# Used to specify anonymous (unsigned) request signature
UNSIGNED = object()


def xform_name(name, sep='_', _xform_cache=_xform_cache,
               partial_renames=_partial_renames):
    """Convert camel case to a "pythonic" name.

    If the name contains the ``sep`` character, then it is
    returned unchanged.

    """
    if sep in name:
        # If the sep is in the name, assume that it's already
        # transformed and return the string unchanged.
        return name
    key = (name, sep)
    if key not in _xform_cache:
        if _special_case_transform.search(name) is not None:
            is_special = _special_case_transform.search(name)
            matched = is_special.group()
            # Replace something like ARNs, ACLs with _arns, _acls.
            name = name[:-len(matched)] + sep + matched.lower()
        s1 = _first_cap_regex.sub(r'\1' + sep + r'\2', name)
        s2 = _number_cap_regex.sub(r'\1' + sep + r'\2', s1)
        transformed = _end_cap_regex.sub(r'\1' + sep + r'\2', s2).lower()

        # Do partial renames
        for old, new in partial_renames.items():
            if old in transformed:
                transformed = transformed.replace(old, new)
        _xform_cache[key] = transformed
    return _xform_cache[key]
