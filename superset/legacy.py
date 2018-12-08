# pylint: disable=C,R,W
"""Code related with dealing with legacy / change management"""
import re

from superset import frontend_config

FORM_DATA_KEY_WHITELIST = list(frontend_config.get('controls').keys()) + ['slice_id']


def cast_filter_data(form_data):
    """Used by cast_form_data to parse the filters"""
    flts = []
    having_flts = []
    fd = form_data
    filter_pattern = re.compile(r"""((?:[^,"']|"[^"]*"|'[^']*')+)""")
    for i in range(0, 10):
        for prefix in ['flt', 'having']:
            col_str = '{}_col_{}'.format(prefix, i)
            op_str = '{}_op_{}'.format(prefix, i)
            val_str = '{}_eq_{}'.format(prefix, i)
            if col_str in fd and op_str in fd and val_str in fd \
               and len(fd[val_str]) > 0:
                f = {}
                f['col'] = fd[col_str]
                f['op'] = fd[op_str]
                if prefix == 'flt':
                    # transfer old strings in filter value to list
                    splitted = filter_pattern.split(fd[val_str])[1::2]
                    values = [types.replace("'", '').strip() for types in splitted]
                    f['val'] = values
                    flts.append(f)
                if prefix == 'having':
                    f['val'] = fd[val_str]
                    having_flts.append(f)
            if col_str in fd:
                del fd[col_str]
            if op_str in fd:
                del fd[op_str]
            if val_str in fd:
                del fd[val_str]
    fd['filters'] = flts
    fd['having_filters'] = having_flts
    return fd


def cast_form_data(form_data):
    """Translates old to new form_data"""
    d = {}
    fields = frontend_config.get('controls', {})
    for k, v in form_data.items():
        field_config = fields.get(k, {})
        ft = field_config.get('type')
        if ft == 'CheckboxControl':
            # bug in some urls with dups on bools
            if isinstance(v, list):
                v = 'y' in v
            else:
                v = True if v in ('true', 'y') or v is True else False
        elif v and ft == 'TextControl' and field_config.get('isInt'):
            v = int(v) if v != '' else None
        elif v and ft == 'TextControl' and field_config.get('isFloat'):
            v = float(v) if v != '' else None
        elif v and ft == 'SelectControl':
            if field_config.get('multi'):
                if type(form_data).__name__ == 'ImmutableMultiDict':
                    v = form_data.getlist(k)
                elif not isinstance(v, list):
                    v = [v]
        if d.get('slice_id'):
            d['slice_id'] = int(d['slice_id'])

        d[k] = v
    if 'filters' not in d:
        d = cast_filter_data(d)
    for k in list(d.keys()):
        if k not in FORM_DATA_KEY_WHITELIST:
            del d[k]
    return d


def update_time_range(form_data):
    """Move since and until to time_range."""
    if 'since' in form_data or 'until' in form_data:
        form_data['time_range'] = '{} : {}'.format(
            form_data.pop('since', '') or '',
            form_data.pop('until', '') or '',
        )
