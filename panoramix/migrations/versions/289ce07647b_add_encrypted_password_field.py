"""Add encrypted password field

Revision ID: 289ce07647b
Revises: 2929af7925ed
Create Date: 2015-11-21 11:18:00.650587

"""

# revision identifiers, used by Alembic.
revision = '289ce07647b'
down_revision = '2929af7925ed'

from alembic import op
import sqlalchemy as sa
from sqlalchemy_utils.types.encrypted import EncryptedType


def upgrade():
    op.add_column(
        'dbs',
        sa.Column(
            'password',
            EncryptedType(sa.String(1024)),
        nullable=True))


def downgrade():
    op.drop_column('dbs', 'password')
