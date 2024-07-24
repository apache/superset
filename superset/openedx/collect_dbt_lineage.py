"""
Parse all Superset datasets for SQL, find links back to dbt assets.

This is used in aspects-dbt to update the exposures. Significant parts of this
are from the dbt_superset_lineage package at:
https://github.com/slidoapp/dbt-superset-lineage/
"""

# Necessary to access Superset
from create_assets import app

import json
import logging
import os
import re

import click
import ruamel.yaml
from superset.extensions import db
from superset.models.dashboard import Dashboard


logger = logging.getLogger("collect_dbt_lineage")

DBT_DATA_PATH = "/app/dbt_manifest/"
DBT_MANIFEST_PATH = os.path.join(DBT_DATA_PATH, "manifest.json")


def get_tables_from_dbt():
    """
    Take generated metadata from the last dbt run to find known models
    """
    with open(DBT_MANIFEST_PATH) as f:
        dbt_manifest = json.load(f)

    tables = {}
    for table_type in ["nodes", "sources"]:
        manifest_subset = dbt_manifest[table_type]

        for table_key_long in manifest_subset:
            table = manifest_subset[table_key_long]
            name = table["name"]
            schema = table["schema"]
            database = table["database"]
            source = table["unique_id"].split(".")[-2]
            table_key = schema + "." + name

            # fail if it breaks uniqueness constraint
            assert table_key not in tables, \
                f"Table {table_key} is a duplicate name (schema + table) across databases. " \
                "This would result in incorrect matching between Superset and dbt. " \

            tables[table_key] = {
                "name": name,
                "schema": schema,
                "database": database,
                "type": table_type[:-1],
                "ref":
                    f"ref('{name}')" if table_type == "nodes"
                    else f"source('{source}', '{name}')"
            }

    assert tables, "Manifest is empty!"

    return tables


def get_tables_from_sql(sql):
    """
    Find table names in sql.

    This is a hack around how sqlfluff and sqlparse both choke on Superset Jinja
    currently. We should invest in making one of those tools work if this proves
    useful. This likely doesn't catch everything or has false positives where
    Superset virtual datasets share names with dbt models.
    """
    sql = re.sub(r'(--.*)|(#.*)', '', sql)  # remove line comments
    sql = re.sub(r'\s+', ' ', sql).lower()  # make it one line
    sql = re.sub(r'(/\*(.|\n)*\*/)', '', sql)  # remove block comments

    regex = re.compile(r'\b(from|join)\b\s+(\"?(\w+)\"?(\.))?\"?(\w+)\"?\b')  # regex for tables
    tables_match = regex.findall(sql)
    tables = [table[2] + '.' + table[4] if table[2] != '' else table[4]  # full name if with schema
              for table in tables_match
              if table[4] != 'unnest']  # remove false positive
    tables = set(tables)  # remove duplicates

    return list(tables)


class YamlFormatted(ruamel.yaml.YAML):
    def __init__(self):
        super(YamlFormatted, self).__init__()
        self.default_flow_style = False
        self.allow_unicode = True
        self.encoding = 'utf-8'
        self.block_seq_indent = 2
        self.indent = 4


def get_slice_tables(slice, dbt_tables):
    """
    Find the tables used in a dataset.
    """
    name = slice.table.name
    schema = slice.table.schema
    dataset_key = f"{schema}.{name}"

    # only add datasets that are in dashboards, optionally limit to one database
    kind = "virtual" if slice.table.is_virtual else "table"
    if kind == "virtual":  # built on custom sql
        sql = slice.table.get_rendered_sql()
        tables = get_tables_from_sql(sql)
    else:
        tables = [dataset_key]

    logger.info(f"Found tables {tables}")
    dbt_refs = [
        dbt_tables[table]["ref"]
        for table in tables
        if table in dbt_tables
    ]

    return dbt_refs


def get_dashboard_dict(dashboard, dbt_tables):
    """
    Get dashboard metadata and all dataset dbt dependencies.
    """
    logger.info(f"Dashboard: {dashboard.slug}")

    dependencies = set()
    for slice in dashboard.slices:
        logger.info(slice)
        dependencies.update(
            get_slice_tables(slice, dbt_tables=dbt_tables)
        )

    return {
        "name": dashboard.slug,
        "label": dashboard.dashboard_title,
        "type": "dashboard",
        "description": dashboard.description or "",
        "url": dashboard.external_url or "",
        "depends_on": list(sorted(dependencies)),
        "owner": {"name": ""},
    }


def write_exposures_yaml(exposure_dashboards):
    exposures_yaml = ruamel.yaml.comments.CommentedSeq(exposure_dashboards)

    exposures_yaml_schema = {
        'version': 2,
        'exposures': exposures_yaml
    }

    outfile = os.path.join(DBT_DATA_PATH, "superset_exposures.yaml")
    logger.info(f"Writing exposures to {outfile}")
    exposures_yaml_file = YamlFormatted()
    with open(outfile, 'w+', encoding='utf-8') as f:
        exposures_yaml_file.dump(exposures_yaml_schema, f)


@click.command(
    help="""Creates a superset_exposures.yaml file in a shared data dir so that
    aspects_dbt can add it to the project in CI and allow dbt docs to show
    which models are being used in Superset."""
)
def collect_dbt_lineage():
    """
    Pull SQL from datasets, compare with dbt manifest.json to find used assets.
    """
    dbt_tables = get_tables_from_dbt()

    target_dashboards = os.environ.get('SUPERSET_EMBEDDABLE_DASHBOARDS')
    locale_suffixes = [
        f"-{loc}"
        for loc in {{SUPERSET_DASHBOARD_LOCALES}}
    ]

    dashboards = (db.session.query(Dashboard).all())

    if not dashboards:
        logger.warning(f"No dashboard found!")

    exposure_dashboards = []
    for dashboard in dashboards:
        localized = False
        for locale_suffix in locale_suffixes:
            if dashboard.slug.endswith(locale_suffix):
                print(f"{dashboard.slug} is localized, skipping")
                localized = True
                break

        if not localized:
            exposure_dashboards.append(get_dashboard_dict(dashboard, dbt_tables))

    write_exposures_yaml(exposure_dashboards)


if __name__ == "__main__":
    logger.info(f"Collecting dbt lineage, will write output to {DBT_DATA_PATH}.")
    collect_dbt_lineage()
