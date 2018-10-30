import json

from superset import db
from .birth_names import load_birth_names
from .helpers import (
    merge_slice,
    misc_dash_slices,
    Slice,
)
from .world_bank import load_world_bank_health_n_pop


def load_multi_line():
    load_world_bank_health_n_pop()
    load_birth_names()
    ids = [
        row.id for row in
        db.session.query(Slice).filter(
            Slice.slice_name.in_(['Growth Rate', 'Trends']))
    ]

    slc = Slice(
        datasource_type='table',  # not true, but needed
        datasource_id=1,          # cannot be empty
        slice_name='Multi Line',
        viz_type='line_multi',
        params=json.dumps({
            'slice_name': 'Multi Line',
            'viz_type': 'line_multi',
            'line_charts': [ids[0]],
            'line_charts_2': [ids[1]],
            'since': '1960-01-01',
            'prefix_metric_with_slice_name': True,
        }),
    )

    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
