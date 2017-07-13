# Copyright (c) 2016 Claudiu Popa <pcmanticore@gmail.com>

# Licensed under the LGPL: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.en.html
# For details: https://github.com/PyCQA/astroid/blob/master/COPYING.LESSER


import astroid
from astroid import parse
from astroid import inference_tip
from astroid import register_module_extender
from astroid import MANAGER


def pkg_resources_transform():
    return parse('''
def require(*requirements):
    return pkg_resources.working_set.require(*requirements)

def run_script(requires, script_name):
    return pkg_resources.working_set.run_script(requires, script_name)

def iter_entry_points(group, name=None):
    return pkg_resources.working_set.iter_entry_points(group, name)

def resource_exists(package_or_requirement, resource_name):
    return get_provider(package_or_requirement).has_resource(resource_name)

def resource_isdir(package_or_requirement, resource_name):
    return get_provider(package_or_requirement).resource_isdir(
        resource_name)

def resource_filename(package_or_requirement, resource_name):
    return get_provider(package_or_requirement).get_resource_filename(
        self, resource_name)

def resource_stream(package_or_requirement, resource_name):
    return get_provider(package_or_requirement).get_resource_stream(
        self, resource_name)

def resource_string(package_or_requirement, resource_name):
    return get_provider(package_or_requirement).get_resource_string(
        self, resource_name)

def resource_listdir(package_or_requirement, resource_name):
    return get_provider(package_or_requirement).resource_listdir(
        resource_name)

def extraction_error():
    pass

def get_cache_path(archive_name, names=()):
    extract_path = self.extraction_path or get_default_cache()
    target_path = os.path.join(extract_path, archive_name+'-tmp', *names)
    return target_path

def postprocess(tempname, filename):
    pass

def set_extraction_path(path):
    pass

def cleanup_resources(force=False):
    pass

def get_distribution(dist):
    return Distribution(dist)

''')

register_module_extender(MANAGER, 'pkg_resources', pkg_resources_transform)
