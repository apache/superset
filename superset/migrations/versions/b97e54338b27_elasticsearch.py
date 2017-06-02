"""elasticsearch

Revision ID: b97e54338b27
Revises: a65458420354
Create Date: 2017-06-11 22:03:07.505841

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b97e54338b27'
down_revision = 'a65458420354'


def upgrade():
    op.create_table(
        'elastic_clusters',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cluster_name', sa.String(length=250), nullable=True),
        sa.Column('hosts_json', sa.Text(), nullable=True),
        sa.Column('metadata_last_refreshed', sa.DateTime(), nullable=True),
        sa.Column('cache_timeout', sa.Integer(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cluster_name')
    )
    op.create_table(
        'elastic_datasources',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('default_endpoint', sa.Text(), nullable=True),
        sa.Column('is_featured', sa.Boolean(), nullable=True),
        sa.Column('filter_select_enabled', sa.Boolean(), nullable=True),
        sa.Column('offset', sa.Integer(), nullable=True),
        sa.Column('cache_timeout', sa.Integer(), nullable=True),
        sa.Column('params', sa.String(length=1000), nullable=True),
        sa.Column('perm', sa.String(length=1000), nullable=True),
        sa.Column('datasource_name', sa.String(length=255), nullable=True),
        sa.Column('is_hidden', sa.Boolean(), nullable=True),
        sa.Column('fetch_values_from', sa.String(length=100), nullable=True),
        sa.Column('cluster_name', sa.String(length=250), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['cluster_name'], ['elastic_clusters.cluster_name'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('datasource_name')
    )
    op.create_table(
        'elastic_columns',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('column_name', sa.String(length=255), nullable=True),
        sa.Column('verbose_name', sa.String(length=1024), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('type', sa.String(length=32), nullable=True),
        sa.Column('groupby', sa.Boolean(), nullable=True),
        sa.Column('count_distinct', sa.Boolean(), nullable=True),
        sa.Column('sum', sa.Boolean(), nullable=True),
        sa.Column('avg', sa.Boolean(), nullable=True),
        sa.Column('max', sa.Boolean(), nullable=True),
        sa.Column('min', sa.Boolean(), nullable=True),
        sa.Column('filterable', sa.Boolean(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('datasource_name', sa.String(length=255), nullable=True),
        sa.Column('json', sa.Text(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['datasource_name'], ['elastic_datasources.datasource_name'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'elastic_metrics',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('metric_name', sa.String(length=512), nullable=True),
        sa.Column('verbose_name', sa.String(length=1024), nullable=True),
        sa.Column('metric_type', sa.String(length=32), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_restricted', sa.Boolean(), nullable=True),
        sa.Column('d3format', sa.String(length=128), nullable=True),
        sa.Column('datasource_name', sa.String(length=255), nullable=True),
        sa.Column('json', sa.Text(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['datasource_name'], ['elastic_datasources.datasource_name'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('elastic_metrics')
    op.drop_table('elastic_columns')
    op.drop_table('elastic_datasources')
    op.drop_table('elastic_clusters')
