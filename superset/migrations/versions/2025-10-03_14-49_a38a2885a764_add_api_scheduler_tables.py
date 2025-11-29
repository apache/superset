# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Add API Scheduler tables

Revision ID: a38a2885a764
Revises: 363a9b1e8992
Create Date: 2025-10-03 14:49:18.737646

"""

# revision identifiers, used by Alembic.
revision = 'a38a2885a764'
down_revision = '363a9b1e8992'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# NOT: Enum tanımlarını KALDIRDIK - VARCHAR kullanacağız


def upgrade():
    # =========================================================================
    # API SCHEDULER TABLES (Ana özellik)
    # =========================================================================
    op.create_table('api_scheduler_configuration',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('target_table', sa.String(length=100), nullable=False),
        sa.Column('api_url', sa.String(length=500), nullable=False),
        sa.Column('api_method', sa.String(length=10), nullable=True),
        sa.Column('api_headers', sa.Text(), nullable=True),
        sa.Column('api_key', sa.String(length=500), nullable=True),
        sa.Column('schedule_interval', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_table('api_scheduler_execution_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config_id', sa.Integer(), nullable=False),
        sa.Column('executed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('records_inserted', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['config_id'], ['api_scheduler_configuration.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_api_scheduler_execution_log_executed_at'), 'api_scheduler_execution_log', ['executed_at'], unique=False)
    op.create_table('api_scheduler_field_mapping',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config_id', sa.Integer(), nullable=False),
        sa.Column('api_field_path', sa.String(length=200), nullable=False),
        sa.Column('db_column_name', sa.String(length=100), nullable=False),
        sa.Column('db_column_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['config_id'], ['api_scheduler_configuration.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # =========================================================================
    # SCHEMA UPDATES (Diğer tablolar)
    # =========================================================================
    op.alter_column('ab_view_menu', 'name',
               existing_type=sa.VARCHAR(length=255),
               type_=sa.String(length=250),
               existing_nullable=False)
    op.alter_column('annotation', 'layer_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.create_unique_constraint(None, 'css_templates', ['uuid'])
    op.alter_column('dashboard_roles', 'dashboard_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('dbs', 'allow_file_upload',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('dynamic_plugin', 'name',
               existing_type=sa.VARCHAR(length=50),
               type_=sa.Text(),
               existing_nullable=False)
    op.alter_column('dynamic_plugin', 'key',
               existing_type=sa.VARCHAR(length=50),
               type_=sa.Text(),
               existing_nullable=False)
    op.alter_column('dynamic_plugin', 'bundle_url',
               existing_type=sa.VARCHAR(length=1000),
               type_=sa.Text(),
               existing_nullable=False)
    op.create_unique_constraint(None, 'dynamic_plugin', ['bundle_url'])
    op.alter_column('embedded_dashboards', 'uuid',
               existing_type=postgresql.UUID(),
               nullable=False)
    op.create_foreign_key(None, 'embedded_dashboards', 'ab_user', ['changed_by_fk'], ['id'])
    op.create_foreign_key(None, 'embedded_dashboards', 'ab_user', ['created_by_fk'], ['id'])
    op.create_unique_constraint(None, 'favstar', ['uuid'])
    
    # Key-value indexes
    op.execute("DROP INDEX IF EXISTS ix_key_value_expires_on")
    op.execute("DROP INDEX IF EXISTS ix_key_value_uuid")
    op.create_unique_constraint(None, 'key_value', ['uuid'])
    
    # Logs index
    op.execute("DROP INDEX IF EXISTS ix_logs_user_id_dttm")
    
    # =========================================================================
    # QUERY.LIMITING_FACTOR - VARCHAR olarak tut, değerleri dönüştür
    # =========================================================================
    op.execute("""
        DO $$ 
        BEGIN
            -- Eğer enum tipindeyse VARCHAR'a çevir
            ALTER TABLE query 
            ALTER COLUMN limiting_factor TYPE VARCHAR(255) 
            USING limiting_factor::text;
        EXCEPTION WHEN others THEN
            NULL; -- Zaten VARCHAR ise hata yok
        END $$;
    """)
    
    # Değerleri normalize et (küçük harfe çevir ve standartlaştır)
    op.execute("""
        UPDATE query SET limiting_factor = 
            CASE 
                WHEN UPPER(limiting_factor) = 'QUERY' THEN 'QUERY'
                WHEN UPPER(limiting_factor) = 'DROPDOWN' THEN 'DROPDOWN'
                WHEN UPPER(limiting_factor) = 'QUERY_AND_DROPDOWN' THEN 'QUERY_AND_DROPDOWN'
                WHEN UPPER(limiting_factor) = 'NOT_LIMITED' THEN 'NOT_LIMITED'
                ELSE 'UNKNOWN'
            END
        WHERE limiting_factor IS NOT NULL;
    """)
    
    # Default değeri ayarla
    op.alter_column('query', 'limiting_factor',
                    server_default='NOT_LIMITED',
                    existing_type=sa.VARCHAR(255))
    
    # Query index
    op.execute("DROP INDEX IF EXISTS ix_sql_editor_id")
    op.create_index(op.f('ix_query_sql_editor_id'), 'query', ['sql_editor_id'], unique=False)
    
    op.alter_column('report_schedule', 'extra_json',
               existing_type=sa.TEXT(),
               nullable=True)
    op.execute("DROP INDEX IF EXISTS ix_creation_method")
    op.create_unique_constraint(None, 'report_schedule_user', ['user_id', 'report_schedule_id'])
    
    # =========================================================================
    # ROW_LEVEL_SECURITY_FILTERS.FILTER_TYPE - VARCHAR olarak tut, değerleri dönüştür
    # =========================================================================
    op.execute("""
        DO $$ 
        BEGIN
            ALTER TABLE row_level_security_filters 
            ALTER COLUMN filter_type TYPE VARCHAR(255) 
            USING filter_type::text;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    
    # Index'i kaldır
    op.execute("DROP INDEX IF EXISTS ix_row_level_security_filters_filter_type")
    
    # Değerleri Superset'in beklediği formata dönüştür
    op.execute("""
        UPDATE row_level_security_filters 
        SET filter_type = CASE 
            WHEN UPPER(filter_type) = 'REGULAR' THEN 'Regular'
            WHEN UPPER(filter_type) = 'BASE' THEN 'Base'
            WHEN UPPER(filter_type) = 'COLUMN_BASED' THEN 'Base'
            WHEN filter_type IS NULL THEN 'Regular'
            ELSE filter_type 
        END;
    """)
    
    # =========================================================================
    # SLICES, SQL_METRICS, SSH_TUNNELS
    # =========================================================================
    op.alter_column('slices', 'perm',
               existing_type=sa.VARCHAR(length=2000),
               type_=sa.String(length=1000),
               existing_nullable=True)
    op.alter_column('sql_metrics', 'currency',
               existing_type=postgresql.JSONB(astext_type=sa.Text()),
               type_=sa.JSON(),
               existing_nullable=True)
    op.alter_column('ssh_tunnels', 'database_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('ssh_tunnels', 'server_address',
               existing_type=sa.VARCHAR(length=256),
               type_=sa.Text(),
               existing_nullable=True)
    op.execute("DROP INDEX IF EXISTS ix_ssh_tunnels_database_id")
    op.execute("DROP INDEX IF EXISTS ix_ssh_tunnels_uuid")
    op.create_unique_constraint(None, 'ssh_tunnels', ['database_id'])
    op.create_unique_constraint(None, 'ssh_tunnels', ['uuid'])
    op.create_foreign_key(None, 'ssh_tunnels', 'ab_user', ['created_by_fk'], ['id'])
    op.create_foreign_key(None, 'ssh_tunnels', 'ab_user', ['changed_by_fk'], ['id'])
    
    # =========================================================================
    # TAB_STATE.LATEST_QUERY_ID
    # =========================================================================
    # Foreign key'i kaldır
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE tab_state DROP CONSTRAINT IF EXISTS tab_state_latest_query_id_fkey;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    
    # Integer'a çevir
    op.alter_column('tab_state', 'latest_query_id',
               existing_type=sa.VARCHAR(length=11),
               type_=sa.Integer(),
               existing_nullable=True,
               postgresql_using="CASE WHEN latest_query_id = '' OR latest_query_id IS NULL THEN NULL ELSE latest_query_id::integer END")
    
    # Foreign key'i tekrar oluştur
    op.create_foreign_key(
        'tab_state_latest_query_id_fkey',
        'tab_state',
        'query',
        ['latest_query_id'],
        ['id']
    )
    
    op.alter_column('tab_state', 'autorun',
               existing_type=sa.BOOLEAN(),
               nullable=True)
    op.alter_column('tab_state', 'hide_left_bar',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.execute("DROP INDEX IF EXISTS ix_tab_state_id")
    op.execute("DROP INDEX IF EXISTS ix_table_schema_id")
    op.alter_column('tables', 'params',
               existing_type=sa.TEXT(),
               type_=sa.String(length=1000),
               existing_nullable=True)
    
    # Tables unique constraint
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE tables DROP CONSTRAINT IF EXISTS _customer_location_uc;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    op.create_unique_constraint(None, 'tables', ['database_id', 'catalog', 'schema', 'table_name'])
    
    # =========================================================================
    # TAG.TYPE - VARCHAR olarak tut, değerleri dönüştür
    # =========================================================================
    op.execute("""
        DO $$ 
        BEGIN
            ALTER TABLE tag 
            ALTER COLUMN type TYPE VARCHAR(255) 
            USING type::text;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    
    # Değerleri normalize et
    op.execute("""
        UPDATE tag SET type = 
            CASE 
                WHEN LOWER(type) = 'custom' THEN 'custom'
                WHEN LOWER(type) = 'type' THEN 'type'
                WHEN LOWER(type) = 'owner' THEN 'owner'
                WHEN LOWER(type) = 'favorited_by' THEN 'favorited_by'
                ELSE 'custom'
            END
        WHERE type IS NOT NULL;
    """)
    
    # Default değeri ayarla
    op.alter_column('tag', 'type',
                    server_default='custom',
                    existing_type=sa.VARCHAR(255))
    
    # =========================================================================
    # TAGGED_OBJECT.OBJECT_TYPE - VARCHAR olarak tut, değerleri dönüştür
    # =========================================================================
    op.execute("""
        DO $$ 
        BEGIN
            ALTER TABLE tagged_object 
            ALTER COLUMN object_type TYPE VARCHAR(255) 
            USING object_type::text;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    
    # Değerleri normalize et
    op.execute("""
        UPDATE tagged_object SET object_type = 
            CASE 
                WHEN LOWER(object_type) = 'query' THEN 'query'
                WHEN LOWER(object_type) = 'chart' THEN 'chart'
                WHEN LOWER(object_type) = 'dashboard' THEN 'dashboard'
                WHEN LOWER(object_type) = 'dataset' THEN 'dataset'
                WHEN LOWER(object_type) = 'saved_query' THEN 'saved_query'
                ELSE 'query'
            END
        WHERE object_type IS NOT NULL;
    """)
    
    # Default değeri ayarla
    op.alter_column('tagged_object', 'object_type',
                    server_default='query',
                    existing_type=sa.VARCHAR(255))
    
    op.execute("DROP INDEX IF EXISTS ix_tagged_object_object_id")
    
    # Foreign keys (conditional)
    op.execute("""
        DO $$
        BEGIN
            -- saved_query FK
            ALTER TABLE tagged_object 
            ADD CONSTRAINT tagged_object_saved_query_fk 
            FOREIGN KEY (object_id) REFERENCES saved_query(id);
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    
    op.alter_column('user_favorite_tag', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('user_favorite_tag', 'tag_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade():
    op.alter_column('user_favorite_tag', 'tag_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('user_favorite_tag', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    
    op.execute("DROP INDEX IF EXISTS ix_tagged_object_object_id")
    op.create_index('ix_tagged_object_object_id', 'tagged_object', ['object_id'], unique=False)
    
    # tagged_object.object_type - değişiklik yok, VARCHAR kalıyor
    op.alter_column('tagged_object', 'object_type',
               server_default=None,
               existing_type=sa.VARCHAR(255))
    
    # tag.type - değişiklik yok, VARCHAR kalıyor
    op.alter_column('tag', 'type',
               server_default=None,
               existing_type=sa.VARCHAR(255))
    
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_database_id_catalog_schema_table_name_key;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    op.create_unique_constraint('_customer_location_uc', 'tables', ['database_id', 'schema', 'table_name'])
    op.alter_column('tables', 'params',
               existing_type=sa.String(length=1000),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.create_index('ix_table_schema_id', 'table_schema', ['id'], unique=True)
    op.create_index('ix_tab_state_id', 'tab_state', ['id'], unique=True)
    op.alter_column('tab_state', 'hide_left_bar',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('false'))
    op.alter_column('tab_state', 'autorun',
               existing_type=sa.BOOLEAN(),
               nullable=False)
    
    # tab_state.latest_query_id -> VARCHAR geri dönüş
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE tab_state DROP CONSTRAINT IF EXISTS tab_state_latest_query_id_fkey;
        EXCEPTION WHEN others THEN
            NULL;
        END $$;
    """)
    op.alter_column('tab_state', 'latest_query_id',
           existing_type=sa.Integer(),
           type_=sa.VARCHAR(length=11),
           existing_nullable=True,
           postgresql_using='latest_query_id::text')
    
    op.execute("DROP INDEX IF EXISTS ix_ssh_tunnels_uuid")
    op.execute("DROP INDEX IF EXISTS ix_ssh_tunnels_database_id")
    op.create_index('ix_ssh_tunnels_uuid', 'ssh_tunnels', ['uuid'], unique=True)
    op.create_index('ix_ssh_tunnels_database_id', 'ssh_tunnels', ['database_id'], unique=True)
    op.alter_column('ssh_tunnels', 'server_address',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=256),
               existing_nullable=True)
    op.alter_column('ssh_tunnels', 'database_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('sql_metrics', 'currency',
               existing_type=sa.JSON(),
               type_=postgresql.JSONB(astext_type=sa.Text()),
               existing_nullable=True)
    op.alter_column('slices', 'perm',
               existing_type=sa.String(length=1000),
               type_=sa.VARCHAR(length=2000),
               existing_nullable=True)
    
    # row_level_security_filters.filter_type - index'i geri getir
    op.create_index('ix_row_level_security_filters_filter_type', 'row_level_security_filters', ['filter_type'], unique=False)
    
    op.create_index('ix_creation_method', 'report_schedule', ['creation_method'], unique=False)
    op.alter_column('report_schedule', 'extra_json',
               existing_type=sa.TEXT(),
               nullable=False)
    op.drop_index(op.f('ix_query_sql_editor_id'), table_name='query')
    op.create_index('ix_sql_editor_id', 'query', ['sql_editor_id'], unique=False)
    
    # query.limiting_factor - default'u kaldır
    op.alter_column('query', 'limiting_factor',
               server_default=None,
               existing_type=sa.VARCHAR(255))
    
    op.create_index('ix_logs_user_id_dttm', 'logs', ['user_id', 'dttm'], unique=False)
    op.create_index('ix_key_value_uuid', 'key_value', ['uuid'], unique=True)
    op.create_index('ix_key_value_expires_on', 'key_value', ['expires_on'], unique=False)
    op.alter_column('embedded_dashboards', 'uuid',
               existing_type=postgresql.UUID(),
               nullable=True)
    op.alter_column('dynamic_plugin', 'bundle_url',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=1000),
               existing_nullable=False)
    op.alter_column('dynamic_plugin', 'key',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
    op.alter_column('dynamic_plugin', 'name',
               existing_type=sa.Text(),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
    op.alter_column('dbs', 'allow_file_upload',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('true'))
    op.alter_column('dashboard_roles', 'dashboard_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('annotation', 'layer_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('ab_view_menu', 'name',
               existing_type=sa.String(length=250),
               type_=sa.VARCHAR(length=255),
               existing_nullable=False)
    
    # API Scheduler tablolarını sil
    op.drop_table('api_scheduler_field_mapping')
    op.drop_index(op.f('ix_api_scheduler_execution_log_executed_at'), table_name='api_scheduler_execution_log')
    op.drop_table('api_scheduler_execution_log')
    op.drop_table('api_scheduler_configuration')