"""Migrate dashboard position_json data from V1 to V2

Revision ID: bebcf3fed1fe
Revises: fc480c87706c
Create Date: 2018-07-22 11:59:07.025119

"""

# revision identifiers, used by Alembic.
import collections
from functools import reduce
import json
import sys
import uuid

from alembic import op
from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

from superset import db

revision = 'bebcf3fed1fe'
down_revision = 'fc480c87706c'

Base = declarative_base()

BACKGROUND_TRANSPARENT = 'BACKGROUND_TRANSPARENT'
CHART_TYPE = 'DASHBOARD_CHART_TYPE'
COLUMN_TYPE = 'DASHBOARD_COLUMN_TYPE'
DASHBOARD_GRID_ID = 'DASHBOARD_GRID_ID'
DASHBOARD_GRID_TYPE = 'DASHBOARD_GRID_TYPE'
DASHBOARD_HEADER_ID = 'DASHBOARD_HEADER_ID'
DASHBOARD_HEADER_TYPE = 'DASHBOARD_HEADER_TYPE'
DASHBOARD_ROOT_ID = 'DASHBOARD_ROOT_ID'
DASHBOARD_ROOT_TYPE = 'DASHBOARD_ROOT_TYPE'
DASHBOARD_VERSION_KEY = 'DASHBOARD_VERSION_KEY'
MARKDOWN_TYPE = 'DASHBOARD_MARKDOWN_TYPE'
ROW_TYPE = 'DASHBOARD_ROW_TYPE'

GRID_COLUMN_COUNT = 12
GRID_MIN_COLUMN_COUNT = 1
GRID_MIN_ROW_UNITS = 5
GRID_RATIO = 4.0
NUMBER_OF_CHARTS_PER_ROW = 3
MAX_RECURSIVE_LEVEL = 6
ROW_HEIGHT = 8
TOTAL_COLUMNS = 48
DEFAULT_CHART_WIDTH = int(TOTAL_COLUMNS / NUMBER_OF_CHARTS_PER_ROW)
MAX_VALUE = sys.maxsize


class Slice(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    params = Column(Text)
    viz_type = Column(String(250))


dashboard_slices = Table(
    'dashboard_slices', Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('dashboard_id', Integer, ForeignKey('dashboards.id')),
    Column('slice_id', Integer, ForeignKey('slices.id')),
)


class Dashboard(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    dashboard_title = Column(String(500))
    position_json = Column(Text)
    slices = relationship(
        'Slice', secondary=dashboard_slices, backref='dashboards')


def is_v2_dash(positions):
    return (
        isinstance(positions, dict) and
        positions.get('DASHBOARD_VERSION_KEY') == 'v2'
    )


def get_boundary(positions):
    top = MAX_VALUE
    left = MAX_VALUE
    bottom = 0
    right = 0

    for position in positions:
        top = min(position['row'], top)
        left = min(position['col'], left)
        bottom = max(position['row'] + position['size_y'], bottom)
        right = max(position['col'] + position['size_x'], right)

    return {
        'top': top,
        'bottom': bottom,
        'left': left,
        'right': right,
    }


def generate_id():
    return uuid.uuid4().hex[:8]


def has_overlap(positions, xAxis=True):
    sorted_positions = \
        sorted(positions[:], key=lambda pos: pos['col']) \
        if xAxis else sorted(positions[:], key=lambda pos: pos['row'])

    result = False
    for idx, position in enumerate(sorted_positions):
        if idx < len(sorted_positions) - 1:
            if xAxis:
                result = position['col'] + position['size_x'] > \
                    sorted_positions[idx + 1]['col']
            else:
                result = position['row'] + position['size_y'] > \
                    sorted_positions[idx + 1]['row']
        if result:
            break

    return result


def get_empty_layout():
    return {
        DASHBOARD_VERSION_KEY: 'v2',
        DASHBOARD_ROOT_ID: {
            'type': DASHBOARD_ROOT_TYPE,
            'id': DASHBOARD_ROOT_ID,
            'children': [DASHBOARD_GRID_ID],
        },
        DASHBOARD_GRID_ID: {
            'type': DASHBOARD_GRID_TYPE,
            'id': DASHBOARD_GRID_ID,
            'children': [],
        },
    }


def get_header_component(title):
    return {
        'id': DASHBOARD_HEADER_ID,
        'type': DASHBOARD_HEADER_TYPE,
        'meta': {
            'text': title,
        },
    }


def get_row_container():
    return {
        'type': ROW_TYPE,
        'id': 'DASHBOARD_ROW_TYPE-{}'.format(generate_id()),
        'children': [],
        'meta': {
            'background': BACKGROUND_TRANSPARENT,
        },
    }


def get_col_container():
    return {
        'type': COLUMN_TYPE,
        'id': 'DASHBOARD_COLUMN_TYPE-{}'.format(generate_id()),
        'children': [],
        'meta': {
            'background': BACKGROUND_TRANSPARENT,
        },
    }


def get_chart_holder(position):
    size_x = position['size_x']
    size_y = position['size_y']
    slice_id = position['slice_id']
    slice_name = position.get('slice_name')
    code = position.get('code')

    width = max(
        GRID_MIN_COLUMN_COUNT,
        int(round(size_x / GRID_RATIO)),
    )
    height = max(
        GRID_MIN_ROW_UNITS,
        int(round(((size_y / GRID_RATIO) * 100) / ROW_HEIGHT)),
    )
    if code is not None:
        markdown_content = ' '  # white-space markdown
        if len(code):
            markdown_content = code
        elif slice_name.strip():
            markdown_content = '##### {}'.format(slice_name)

        return {
            'type': MARKDOWN_TYPE,
            'id': 'DASHBOARD_MARKDOWN_TYPE-{}'.format(generate_id()),
            'children': [],
            'meta': {
                'width': width,
                'height': height,
                'code': markdown_content,
            },
        }

    return {
        'type': CHART_TYPE,
        'id': 'DASHBOARD_CHART_TYPE-{}'.format(generate_id()),
        'children': [],
        'meta': {
            'width': width,
            'height': height,
            'chartId': int(slice_id),
        },
    }


def get_children_max(children, attr, root):
    return max([root[childId]['meta'][attr] for childId in children])


def get_children_sum(children, attr, root):
    return reduce(
        (lambda sum, childId: sum + root[childId]['meta'][attr]),
        children,
        0,
    )


# find column that: width > 2 and
# each row has at least 1 chart can reduce width
def get_wide_column_ids(children, root):
    return list(
        filter(
            lambda childId: can_reduce_column_width(root[childId], root),
            children,
        ),
    )


def is_wide_leaf_component(component):
    return (
        component['type'] in [CHART_TYPE, MARKDOWN_TYPE] and
        component['meta']['width'] > GRID_MIN_COLUMN_COUNT
    )


def can_reduce_column_width(column_component, root):
    return (
        column_component['type'] == COLUMN_TYPE and
        column_component['meta']['width'] > GRID_MIN_COLUMN_COUNT and
        all([
            is_wide_leaf_component(root[childId]) or (
                root[childId]['type'] == ROW_TYPE and
                all([
                    is_wide_leaf_component(root[id]) for id in root[childId]['children']
                ])
            ) for childId in column_component['children']
        ])
    )


def reduce_row_width(row_component, root):
    wide_leaf_component_ids = list(
        filter(
            lambda childId: is_wide_leaf_component(root[childId]),
            row_component['children'],
        ),
    )

    widest_chart_id = None
    widest_width = 0
    for component_id in wide_leaf_component_ids:
        if root[component_id]['meta']['width'] > widest_width:
            widest_width = root[component_id]['meta']['width']
            widest_chart_id = component_id

    if widest_chart_id:
        root[widest_chart_id]['meta']['width'] -= 1

    return get_children_sum(row_component['children'], 'width', root)


def reduce_component_width(component):
    if is_wide_leaf_component(component):
        component['meta']['width'] -= 1
    return component['meta']['width']


def convert(positions, level, parent, root):
    if len(positions) == 0:
        return

    if len(positions) == 1 or level >= MAX_RECURSIVE_LEVEL:
        # special treatment for single chart dash:
        # always wrap chart inside a row
        if parent['type'] == DASHBOARD_GRID_TYPE:
            row_container = get_row_container()
            root[row_container['id']] = row_container
            parent['children'].append(row_container['id'])
            parent = row_container

        chart_holder = get_chart_holder(positions[0])
        root[chart_holder['id']] = chart_holder
        parent['children'].append(chart_holder['id'])
        return

    current_positions = positions[:]
    boundary = get_boundary(current_positions)
    top = boundary['top']
    bottom = boundary['bottom']
    left = boundary['left']
    right = boundary['right']

    # find row dividers
    layers = []
    current_row = top + 1
    while len(current_positions) and current_row <= bottom:
        upper = []
        lower = []

        is_row_divider = True
        for position in current_positions:
            row = position['row']
            size_y = position['size_y']
            if row + size_y <= current_row:
                lower.append(position)
                continue
            elif row >= current_row:
                upper.append(position)
                continue
            is_row_divider = False
            break

        if is_row_divider:
            current_positions = upper[:]
            layers.append(lower)
        current_row += 1

    # Each layer is a list of positions belong to same row section
    # they can be a list of charts, or arranged in columns, or mixed
    for layer in layers:
        if len(layer) == 0:
            continue

        if len(layer) == 1 and parent['type'] == COLUMN_TYPE:
            chart_holder = get_chart_holder(layer[0])
            root[chart_holder['id']] = chart_holder
            parent['children'].append(chart_holder['id'])
            continue

        # create a new row
        row_container = get_row_container()
        root[row_container['id']] = row_container
        parent['children'].append(row_container['id'])

        current_positions = layer[:]
        if not has_overlap(current_positions):
            # this is a list of charts in the same row
            sorted_by_col = sorted(
                current_positions,
                key=lambda pos: pos['col'],
            )
            for position in sorted_by_col:
                chart_holder = get_chart_holder(position)
                root[chart_holder['id']] = chart_holder
                row_container['children'].append(chart_holder['id'])
        else:
            # this row has columns, find col dividers
            current_col = left + 1
            while len(current_positions) and current_col <= right:
                upper = []
                lower = []

                is_col_divider = True
                for position in current_positions:
                    col = position['col']
                    size_x = position['size_x']
                    if col + size_x <= current_col:
                        lower.append(position)
                        continue
                    elif col >= current_col:
                        upper.append(position)
                        continue
                    is_col_divider = False
                    break

                if is_col_divider:
                    # is single chart in the column:
                    # add to parent container without create new column container
                    if len(lower) == 1:
                        chart_holder = get_chart_holder(lower[0])
                        root[chart_holder['id']] = chart_holder
                        row_container['children'].append(chart_holder['id'])
                    else:
                        # create new col container
                        col_container = get_col_container()
                        root[col_container['id']] = col_container

                        if not has_overlap(lower, False):
                            sorted_by_row = sorted(
                                lower,
                                key=lambda pos: pos['row'],
                            )
                            for position in sorted_by_row:
                                chart_holder = get_chart_holder(position)
                                root[chart_holder['id']] = chart_holder
                                col_container['children'].append(chart_holder['id'])
                        else:
                            convert(lower, level + 2, col_container, root)

                        # add col meta
                        if len(col_container['children']):
                            row_container['children'].append(col_container['id'])
                            col_container['meta']['width'] = get_children_max(
                                col_container['children'],
                                'width',
                                root,
                            )

                    current_positions = upper[:]
                current_col += 1

        # add row meta
        row_container['meta']['width'] = get_children_sum(
            row_container['children'],
            'width',
            root,
        )


def convert_to_layout(positions):
    root = get_empty_layout()

    convert(positions, 0, root[DASHBOARD_GRID_ID], root)

    # remove row's width, height and col's height from its meta data
    # and make sure every row's width <= GRID_COLUMN_COUNT
    # Each item is a dashboard component:
    # row_container, or col_container, or chart_holder
    for item in root.values():
        if not isinstance(item, dict):
            continue

        if ROW_TYPE == item['type']:
            meta = item['meta']
            if meta.get('width', 0) > GRID_COLUMN_COUNT:
                current_width = meta['width']
                while (
                    current_width > GRID_COLUMN_COUNT and
                    len(list(filter(
                        lambda childId: is_wide_leaf_component(root[childId]),
                        item['children'],
                    )))
                ):
                    current_width = reduce_row_width(item, root)

                # because we round v1 chart size to nearest v2 grids count, result
                # in there might be overall row width > GRID_COLUMN_COUNT.
                # So here is an extra step to check row width, and reduce chart
                # or column width if needed and if possible.
                if current_width > GRID_COLUMN_COUNT:
                    has_wide_columns = True
                    while has_wide_columns:
                        col_ids = get_wide_column_ids(item['children'], root)
                        idx = 0
                        # need 2nd loop since same column may reduce multiple times
                        while idx < len(col_ids) and current_width > GRID_COLUMN_COUNT:
                            current_column = col_ids[idx]
                            for childId in root[current_column]['children']:
                                if root[childId]['type'] == ROW_TYPE:
                                    root[childId]['meta']['width'] = reduce_row_width(
                                        root[childId], root,
                                    )
                                else:
                                    root[childId]['meta']['width'] = \
                                        reduce_component_width(root[childId])

                            root[current_column]['meta']['width'] = get_children_max(
                                root[current_column]['children'],
                                'width',
                                root,
                            )
                            current_width = get_children_sum(
                                item['children'],
                                'width',
                                root,
                            )
                            idx += 1

                        has_wide_columns = (
                            len(get_wide_column_ids(item['children'], root)) and
                            current_width > GRID_COLUMN_COUNT
                        )

            meta.pop('width', None)

    return root


def merge_position(position, bottom_line, last_column_start):
    col = position['col']
    size_x = position['size_x']
    size_y = position['size_y']
    end_column = len(bottom_line) \
        if col + size_x > last_column_start \
        else col + size_x

    # finding index where index >= col and bottom_line value > bottom_line[col]
    taller_indexes = [i for i, value in enumerate(bottom_line)
                      if (i >= col and value > bottom_line[col])]

    current_row_value = bottom_line[col]
    # if no enough space to fit current position, will start from taller row value
    if len(taller_indexes) > 0 and (taller_indexes[0] - col + 1) < size_x:
        current_row_value = max(bottom_line[col:col + size_x])

    # add current row value with size_y of this position
    for i in range(col, end_column):
        bottom_line[i] = current_row_value + size_y


# In original position data, a lot of position's row attribute are problematic,
# for example, same positions are assigned to more than 1 chart.
# The convert function depends on row id, col id to split the whole dashboard into
# nested rows and columns. Bad row id will lead to many empty spaces, or a few charts
# are overlapped in the same row.
# This function read positions by row first.
# Then based on previous col id, width and height attribute,
# re-calculate next position's row id.
def scan_dashboard_positions_data(positions):
    positions_by_row_id = {}
    for position in positions:
        row = position['row']
        position['col'] = min(position['col'], TOTAL_COLUMNS)
        if not positions_by_row_id.get(row):
            positions_by_row_id[row] = []
        positions_by_row_id[row].append(position)

    bottom_line = [0] * (TOTAL_COLUMNS + 1)
    # col index always starts from 1, set a large number for [0] as placeholder
    bottom_line[0] = MAX_VALUE
    last_column_start = max([position['col'] for position in positions])

    # ordered_raw_positions are arrays of raw positions data sorted by row id
    ordered_raw_positions = []
    row_ids = sorted(positions_by_row_id.keys())
    for row_id in row_ids:
        ordered_raw_positions.append(positions_by_row_id[row_id])
    updated_positions = []

    while len(ordered_raw_positions):
        next_row = ordered_raw_positions.pop(0)
        next_col = 1
        while len(next_row):
            # special treatment for same (row, col) assigned to more than 1 chart:
            # add one additional row and display wider chart first
            available_columns_index = [i for i, e in enumerate(
                list(filter(lambda x: x['col'] == next_col, next_row)))]

            if len(available_columns_index):
                idx = available_columns_index[0]
                if len(available_columns_index) > 1:
                    idx = sorted(
                        available_columns_index,
                        key=lambda x: next_row[x]['size_x'],
                        reverse=True,
                    )[0]

                next_position = next_row.pop(idx)
                merge_position(next_position, bottom_line, last_column_start + 1)
                next_position['row'] = \
                    bottom_line[next_position['col']] - next_position['size_y']
                updated_positions.append(next_position)
                next_col += next_position['size_x']
            else:
                next_col = next_row[0]['col']

    return updated_positions


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for i, dashboard in enumerate(dashboards):
        print('scanning dashboard ({}/{}) >>>>'.format(i + 1, len(dashboards)))
        position_json = json.loads(dashboard.position_json or '[]')
        if not is_v2_dash(position_json):
            print('Converting dashboard... dash_id: {}'.format(dashboard.id))
            position_dict = {}
            positions = []
            slices = dashboard.slices

            if position_json:
                # scan and fix positions data: extra spaces, dup rows, .etc
                position_json = scan_dashboard_positions_data(position_json)
                position_dict = \
                    {str(position['slice_id']): position for position in position_json}

            last_row_id = max([pos['row'] + pos['size_y'] for pos in position_json]) \
                if position_json else 0
            new_slice_counter = 0
            for slice in slices:
                position = position_dict.get(str(slice.id))

                # some dashboard didn't have position_json
                # place 3 charts in a row
                if not position:
                    position = {
                        'col': (
                            new_slice_counter % NUMBER_OF_CHARTS_PER_ROW *
                            DEFAULT_CHART_WIDTH + 1
                        ),
                        'row': (
                            last_row_id +
                            int(new_slice_counter / NUMBER_OF_CHARTS_PER_ROW) *
                            DEFAULT_CHART_WIDTH
                        ),
                        'size_x': DEFAULT_CHART_WIDTH,
                        'size_y': DEFAULT_CHART_WIDTH,
                        'slice_id': str(slice.id),
                    }
                    new_slice_counter += 1

                # attach additional parameters to position dict,
                # prepare to replace markup and separator viz_type
                # to dashboard UI component
                form_data = json.loads(slice.params or '{}')
                viz_type = slice.viz_type
                if form_data and viz_type in ['markup', 'separator']:
                    position['code'] = form_data.get('code')
                    position['slice_name'] = slice.slice_name

                positions.append(position)

            v2_layout = convert_to_layout(positions)
            v2_layout[DASHBOARD_HEADER_ID] = get_header_component(
                dashboard.dashboard_title)

            sorted_by_key = collections.OrderedDict(sorted(v2_layout.items()))
            dashboard.position_json = json.dumps(sorted_by_key, indent=2)
            session.merge(dashboard)
            session.commit()
        else:
            print('Skip converted dash_id: {}'.format(dashboard.id))

    session.close()


def downgrade():
    print('downgrade is done')
