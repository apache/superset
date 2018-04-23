"""Update padding scheme for encrypted password field

Revision ID: cfa44e8decfd
Revises: 5ccf602336a0
Create Date: 2018-04-23 16:33:15.577354

"""

# revision identifiers, used by Alembic.
revision = 'cfa44e8decfd'
down_revision = '5ccf602336a0'

from alembic import op
import sqlalchemy as sa
from sqlalchemy_utils.types.encrypted.encrypted_type import EncryptedType

from superset import app


old_schema = sa.Table(
    'dbs',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('password',
              EncryptedType(sa.String(1024), app.config.get('SECRET_KEY')),
              nullable=True)
)

new_schema = sa.Table(
    'dbs',
    sa.MetaData(),
    sa.Column('id', sa.Integer, primary_key=True),
    sa.Column('password',
              EncryptedType(sa.String(1024), app.config.get('SECRET_KEY'), padding='pkcs5'),
              nullable=True)
)


def upgrade():
    connection = op.get_bind()

    # re-encrypt all passwords using PKCS5 padding
    for db in connection.execute(old_schema.select()):
        connection.execute(
            new_schema.update().where(
                new_schema.c.id == db.id
            ).values(
                password=db.password
            )
        )


def downgrade():
    connection = op.get_bind()

    for db in connection.execute(new_schema.select()):
        connection.execute(
            old_schema.update().where(
                old_schema.c.id == db.id
            ).values(
                password=db.password
            )
        )
