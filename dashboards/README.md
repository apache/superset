Save dashboard zip files here for sharing

from the UI, you can export a dashboard
that brings the datasets, charts, and dashboard
then you can import directly from the CLI (via a log in to docker)
this assumes you have placed the dashboard.zip in a mount volume or similar

```bash
docker compose exec superset_app bash
superset import_dashboards -p /path/to/your/dashboard.zip -u '<user>'
```

Note the documentation suggests import_datasources but this does not work
https://superset.apache.org/docs/configuration/importing-exporting-datasources/#importing-datasources
