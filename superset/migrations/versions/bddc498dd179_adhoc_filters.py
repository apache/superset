"""adhoc filters

Revision ID: bddc498dd179
Revises: afb7730f6a9c
Create Date: 2018-06-13 14:54:47.086507

"""

# revision identifiers, used by Alembic.
revision = 'bddc498dd179'
down_revision = '80a67c5192fa'


from collections import defaultdict
import json
import uuid

from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, Text

from superset import db
from superset import utils


Base = declarative_base()


class Slice(Base):
    __tablename__ = 'slices'

    id = Column(Integer, primary_key=True)
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    mapping = {'having': 'having_filters', 'where': 'filters'}

    for slc in session.query(Slice).all():
        try:
            params = json.loads(slc.params)

            if not 'adhoc_filters' in params:
                params['adhoc_filters'] = []

                for clause, filters in mapping.items():
                    if clause in params and params[clause] != '':
                        params['adhoc_filters'].append({
                            'clause': clause.upper(),
                            'expressionType': 'SQL',
                            'filterOptionName': str(uuid.uuid4()),
                            'sqlExpression': params[clause],
                        })

                    if filters in params:
                        for filt in params[filters]:
                            params['adhoc_filters'].append({
                                'clause': clause.upper(),
                                'comparator': filt['val'],
                                'expressionType': 'SIMPLE',
                                'filterOptionName': str(uuid.uuid4()),
                                'operator': filt['op'],
                                'subject': filt['col'],
                            })

            for key in ('filters', 'having', 'having_filters', 'where'):
                if key in params:
                    del params[key]

            slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        try:
            params = json.loads(slc.params)
            utils.split_adhoc_filters_into_base_filters(params)

            if 'adhoc_filters' in params:
                del params['adhoc_filters']

            slc.params = json.dumps(params, sort_keys=True)
        except Exception:
            pass

    session.commit()
    session.close()
