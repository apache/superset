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
"""Command to seed tenants table with development data"""

import json
import logging
from pathlib import Path
from typing import Any

import click
from flask.cli import with_appcontext

from superset import db
from superset.multitenancy.factories.tenant_factory import TenantFactory
from superset.multitenancy.models.tenant import Tenant
from superset.multitenancy.repositories.tenant_repository import TenantRepository

logger = logging.getLogger(__name__)


@click.command()
@click.option(
    "--config",
    "-c",
    type=click.Path(exists=True, path_type=Path),
    help="Path to JSON file with tenant configurations",
)
@click.option(
    "--slug",
    "-s",
    help="Slug of a single tenant to create (requires other options)",
)
@click.option(
    "--name",
    "-n",
    help="Name of tenant (required with --slug)",
)
@click.option(
    "--oauth-issuer",
    help="OAuth issuer URL (required with --slug)",
)
@click.option(
    "--oauth-provider-type",
    default="generic",
    help="OAuth provider type (e.g., 'generic', 'google', 'github', 'okta'). Default: 'generic'",
)
@click.option(
    "--client-id",
    help="OAuth client ID (required with --slug)",
)
@click.option(
    "--client-secret",
    help="OAuth client secret (required with --slug)",
)
@click.option(
    "--db-uri",
    help="Database SQLAlchemy URI (required with --slug)",
)
@click.option(
    "--default-schema",
    help="Default schema name (optional)",
)
@click.option(
    "--admin",
    is_flag=True,
    help="Mark tenant as admin tenant",
)
@click.option(
    "--overwrite",
    is_flag=True,
    help="Overwrite existing tenants with same slug",
)
@with_appcontext
def seed_tenants(
    config: Path | None,
    slug: str | None,
    name: str | None,
    oauth_issuer: str | None,
    oauth_provider_type: str,
    client_id: str | None,
    client_secret: str | None,
    db_uri: str | None,
    default_schema: str | None,
    admin: bool,
    overwrite: bool,
) -> None:
    """
    Seed the tenants table with development data.

    You can either:
    1. Provide a JSON config file with multiple tenants
    2. Provide individual tenant options via command line

    Example JSON config file:
    {
        "tenants": [
            {
                "slug": "acme",
                "name": "Acme Corp",
                "oauth_issuer": "https://acme.okta.com/oauth2/default",
                "oauth_provider_type": "generic",
                "client_id": "acme-client-id",
                "client_secret": "acme-secret",
                "db_sqlalchemy_uri": "postgresql://user:pass@localhost:5432/acmedb",
                "default_schema": "acme_schema",
                "is_admin_tenant": false
            }
        ]
    }
    """
    if config:
        # Load from JSON file
        with open(config, encoding="utf-8") as f:
            data = json.load(f)
            tenants_config = data.get("tenants", [])
    elif slug:
        # Create from command line options
        if not all([name, oauth_issuer, client_id, client_secret, db_uri]):
            raise click.UsageError(
                "When using --slug, you must also provide --name, --oauth-issuer, "
                "--client-id, --client-secret, and --db-uri"
            )
        tenants_config = [
            {
                "slug": slug,
                "name": name,
                "oauth_issuer": oauth_issuer,
                "oauth_provider_type": oauth_provider_type,
                "client_id": client_id,
                "client_secret": client_secret,
                "db_sqlalchemy_uri": db_uri,
                "default_schema": default_schema,
                "is_admin_tenant": admin,
            }
        ]
    else:
        raise click.UsageError("Either --config or --slug must be provided")

    created_count = 0
    updated_count = 0
    skipped_count = 0

    for tenant_config in tenants_config:
        slug = tenant_config["slug"]
        existing = TenantRepository.get_by_slug(slug)

        if existing:
            if overwrite:
                # Update existing tenant
                for key, value in tenant_config.items():
                    if hasattr(existing, key) and key not in ["id", "uuid", "created_on", "changed_on"]:
                        setattr(existing, key, value)
                TenantRepository.update(existing)
                updated_count += 1
                click.echo(f"✓ Updated tenant: {slug}")
            else:
                skipped_count += 1
                click.echo(f"⊘ Skipped existing tenant: {slug} (use --overwrite to update)")
                continue
        else:
            # Create new tenant
            tenant = TenantFactory.create_from_config(tenant_config)
            TenantRepository.create(tenant)
            created_count += 1
            click.echo(f"✓ Created tenant: {slug}")

    db.session.commit()

    click.echo(f"\nSummary: {created_count} created, {updated_count} updated, {skipped_count} skipped")


# Register the command
def register_command(app: Any) -> None:
    """Register the seed_tenants command with Flask app"""
    app.cli.add_command(seed_tenants)

