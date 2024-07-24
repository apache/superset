"""Import a list of assets from a yaml file and create them in the superset assets folder."""
import os
from superset.app import create_app

app = create_app()
app.app_context().push()

import logging
import uuid
import yaml
from copy import deepcopy
from pathlib import Path

from superset import security_manager
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.connectors.sqla.models import SqlaTable
from superset.utils.database import get_or_create_db
from superset.models.embedded_dashboard import EmbeddedDashboard

from pythonpath.create_assets_utils import load_configs_from_directory
from pythonpath.localization import get_translation
from pythonpath.create_row_level_security import create_rls_filters


logger = logging.getLogger("create_assets")
BASE_DIR = "/app/assets/superset"
ASSET_FOLDER_MAPPING = {
    "dashboard_title": "dashboards",
    "slice_name": "charts",
    "database_name": "databases",
    "table_name": "datasets",
}

DASHBOARD_LOCALES = {{SUPERSET_DASHBOARD_LOCALES}}
EMBEDDABLE_DASHBOARDS = {{SUPERSET_EMBEDDABLE_DASHBOARDS}}
DATABASES = {{SUPERSET_DATABASES}}

for folder in ASSET_FOLDER_MAPPING.values():
    os.makedirs(f"{BASE_DIR}/{folder}", exist_ok=True)

FILE_NAME_ATTRIBUTE = "_file_name"

ASSETS_FILE_PATH = "/app/pythonpath/assets.yaml"
ASSETS_PATH = "/app/openedx-assets/assets"


def main():
    create_assets()


def create_assets():
    """Create assets from a yaml file."""
    roles = {}

    for root, dirs, files in os.walk(ASSETS_PATH):
        for file in files:
            if not file.endswith(".yaml"):
                continue

            path = os.path.join(root, file)
            with open(path, "r") as file:
                asset = yaml.safe_load(file)
                process_asset(asset, roles)

    with open(ASSETS_FILE_PATH, "r") as file:
        extra_assets = yaml.safe_load_all(file)

        if extra_assets:
            # For each asset, create a file in the right folder
            for asset in extra_assets:
                process_asset(asset, roles)

    import_assets()
    update_dashboard_roles(roles)
    update_embeddable_uuids()
    update_datasets()
    create_rls_filters()


def process_asset(asset, roles):
    if FILE_NAME_ATTRIBUTE not in asset:
        raise Exception(f"Asset {asset} has no {FILE_NAME_ATTRIBUTE}")
    file_name = asset.pop(FILE_NAME_ATTRIBUTE)

    # Find the right folder to create the asset in
    for asset_name, folder in ASSET_FOLDER_MAPPING.items():
        if asset_name in asset:
            write_asset_to_file(asset, asset_name, folder, file_name, roles)
            return


def get_localized_uuid(base_uuid, language):
    """
    Generate an idempotent uuid for a localized asset.
    """
    base_uuid = uuid.UUID(base_uuid)
    base_namespace = uuid.uuid5(base_uuid, "superset")
    normalized_language = language.lower().replace("-", "_")
    return str(uuid.uuid5(base_namespace, normalized_language))


def write_asset_to_file(asset, asset_name, folder, file_name, roles):
    """Write an asset to a file and generated translated assets"""
    if folder == "databases":
        # Update the sqlalchery_uri from the asset override pre-generated values
        asset["sqlalchemy_uri"] = DATABASES.get(asset["database_name"])
    if folder in ["charts", "dashboards", "datasets"]:
        for locale in DASHBOARD_LOCALES:
            updated_asset = generate_translated_asset(
                asset, asset_name, folder, locale, roles
            )

            # Clean up old localized dashboards
            if folder == "dashboards":
                dashboard_slug = updated_asset["slug"]
                dashboard = db.session.query(Dashboard).filter_by(slug=dashboard_slug).first()
                if dashboard:
                    db.session.delete(dashboard)
            path = f"{BASE_DIR}/{folder}/{file_name.split('.')[0]}-{locale}.yaml"
            with open(path, "w") as file:
                yaml.dump(updated_asset, file)

    ## WARNING: Dashboard are assigned a Dummy role which prevents users to
    #           access the original dashboards.
    dashboard_roles = asset.pop("_roles", None)
    if dashboard_roles:
        roles[asset["uuid"]] = [security_manager.find_role("Admin")]

    # Clean up old un-localized dashboard
    dashboard_slug = asset.get("slug")
    if dashboard_slug:
        dashboard = db.session.query(Dashboard).filter_by(slug=dashboard_slug).first()
        if dashboard:
            db.session.delete(dashboard)

    path = f"{BASE_DIR}/{folder}/{file_name}"
    with open(path, "w") as file:
        yaml.dump(asset, file)

    db.session.commit()


def generate_translated_asset(asset, asset_name, folder, language, roles):
    """Generate a translated asset with their elements updated"""
    copy = deepcopy(asset)
    copy["uuid"] = str(get_localized_uuid(copy["uuid"], language))
    copy[asset_name] = get_translation(copy[asset_name], language)

    if folder == "dashboards":
        copy["slug"] = f"{copy['slug']}-{language}"
        copy["description"] = get_translation(copy["description"], language)

        dashboard_roles = copy.pop("_roles", [])
        translated_dashboard_roles = []

        for role in dashboard_roles:
            translated_dashboard_roles.append(f"{role} - {language}")

        roles[copy["uuid"]] = [
            security_manager.find_role(role) for role in translated_dashboard_roles
        ]

        generate_translated_dashboard_elements(copy, language)
        generate_translated_dashboard_filters(copy, language)

    if folder == "datasets" and copy.get("sql"):
        # Only virtual datasets can be translated
        for column in copy.get("columns", []):
            column["verbose_name"] = get_translation(column["verbose_name"], language)

        for metric in copy.get("metrics", []):
            metric["verbose_name"] = get_translation(metric["verbose_name"], language)

        copy["table_name"] = f"{copy['table_name']}_{language}"

    if folder == "charts":
        copy["dataset_uuid"] = get_localized_uuid(copy["dataset_uuid"], language)

    return copy


def generate_translated_dashboard_elements(copy, language):
    """Generate translated elements for a dashboard"""
    position = copy.get("position", {})

    SUPPORTED_TYPES = {"TAB": "text", "HEADER": "text", "MARKDOWN": "code"}

    for element in position.values():
        if not isinstance(element, dict):
            continue

        meta = element.get("meta", {})
        original_uuid = meta.get("uuid", None)

        translation, element_id = None, None

        if original_uuid:
            element_id = get_localized_uuid(original_uuid, language)
            translation = get_translation(meta["sliceName"], language)

            meta["sliceName"] = translation
            meta["uuid"] = element_id

        elif element.get("type") in SUPPORTED_TYPES.keys():
            text_key = SUPPORTED_TYPES.get(element["type"])
            if not meta or not meta.get(text_key):
                continue

            translation = get_translation(meta[text_key], language)
            meta[text_key] = translation


def generate_translated_dashboard_filters(copy, language):
    """Generate translated filters for a dashboard"""
    metadata = copy.get("metadata", {})

    for filter in metadata.get("native_filter_configuration", []):
        for k in ("name", "description"):
            if k in filter:
                filter[k] = get_translation(filter[k], language)


def import_assets():
    """Import the assets folder in superset"""
    load_configs_from_directory(
        root=Path(BASE_DIR),
        overwrite=True,
        force_data=False,
    )

    # Query contexts use slice IDs instead of UUIDs, which breaks for us
    # especially in translated datasets. We do need them for the
    # performance_metric script however, so we keep them in the assets.
    # This just blanks them in the database after import, which forces a
    # query to get the assets instead of using the query context.
    owners = get_owners()
    for o in db.session.query(Slice).all():
        if o.query_context:
            o.query_context = None
        if owners:
            o.owners = owners
    db.session.commit()


def update_dashboard_roles(roles):
    """Update the roles of the dashboards"""
    owners = get_owners()

    for dashboard_uuid, role_ids in roles.items():
        dashboard = db.session.query(Dashboard).filter_by(uuid=dashboard_uuid).one()
        dashboard.roles = role_ids
        if owners:
            dashboard.owners = owners
        db.session.commit()

def get_owners():
    owners_username = {{SUPERSET_OWNERS}}
    owners = []
    for owner in owners_username:
        user = security_manager.find_user(username=owner)
        if user:
            owners.append(user)
    return owners

def update_embeddable_uuids():
    """Update the uuids of the embeddable dashboards"""
    for dashboard_slug, embeddable_uuid in EMBEDDABLE_DASHBOARDS.items():
        create_embeddable_dashboard_by_slug(dashboard_slug, embeddable_uuid)

    for locale in DASHBOARD_LOCALES:
        for dashboard_slug, embeddable_uuid in EMBEDDABLE_DASHBOARDS.items():
            slug = f"{dashboard_slug}-{locale}"
            current_uuid = get_localized_uuid(embeddable_uuid, locale)
            create_embeddable_dashboard_by_slug(slug, current_uuid)


def create_embeddable_dashboard_by_slug(dashboard_slug, embeddable_uuid):
    """Create an embeddable dashboard by slug"""
    logger.info(f"Creating embeddable dashboard {dashboard_slug}, {embeddable_uuid}")
    dashboard = db.session.query(Dashboard).filter_by(slug=dashboard_slug).first()
    if dashboard is None:
        logger.info(f"WARNING: Dashboard {dashboard_slug} not found")
        return

    embedded_dashboard = db.session.query(EmbeddedDashboard).filter_by(dashboard_id=dashboard.id).first()
    if embedded_dashboard is None:
        embedded_dashboard = EmbeddedDashboard()
        embedded_dashboard.dashboard_id = dashboard.id
    embedded_dashboard.uuid = embeddable_uuid

    db.session.add(embedded_dashboard)
    db.session.commit()

def update_datasets():
    """Update the datasets"""
    logger.info("Refreshing datasets")
    if {{SUPERSET_REFRESH_DATASETS}}:
        datasets = (
            db.session.query(SqlaTable).all()
        )
        for dataset in datasets:
            logger.info(f"Refreshing dataset {dataset.table_name}")
            dataset.fetch_metadata(commit=True)


if __name__ == "__main__":
    main()
