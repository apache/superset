import sys
if not getattr(sys, 'bar', None):
    sys.just_once = []
# there used to be two numbers here because
# of a load_module_from_path bug
sys.just_once.append(42)
