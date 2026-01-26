// @ts-nocheck
/**
 * Auto-generated CommonJS sidebar from sidebar.ts
 * Do not edit directly - run 'yarn generate:api-docs' to regenerate
 */

const sidebar = {
  "apisidebar": [
    {
      "type": "doc",
      "id": "api/superset"
    },
    {
      "type": "category",
      "label": "Advanced Data Type",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/return-an-advanced-data-type-response",
          "label": "Return an AdvancedDataTypeResponse",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/return-a-list-of-available-advanced-data-types",
          "label": "Return a list of available advanced data types",
          "className": "api-method get"
        }
      ],
      "key": "api-category-advanced-data-type"
    },
    {
      "type": "category",
      "label": "Annotation Layers",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/delete-multiple-annotation-layers-in-a-bulk-operation",
          "label": "Delete multiple annotation layers in a bulk operation",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-annotation-layers-annotation-layer",
          "label": "Get a list of annotation layers (annotation-layer)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-an-annotation-layer-annotation-layer",
          "label": "Create an annotation layer (annotation-layer)",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-annotation-layer-info",
          "label": "Get metadata information about this API resource (annotation-layer--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-annotation-layer-related-column-name",
          "label": "Get related fields data (annotation-layer-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-annotation-layer-annotation-layer-pk",
          "label": "Delete annotation layer (annotation-layer-pk)",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-an-annotation-layer-annotation-layer-pk",
          "label": "Get an annotation layer (annotation-layer-pk)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-an-annotation-layer-annotation-layer-pk",
          "label": "Update an annotation layer (annotation-layer-pk)",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/bulk-delete-annotation-layers",
          "label": "Bulk delete annotation layers",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-annotation-layers-annotation-layer-pk-annotation",
          "label": "Get a list of annotation layers (annotation-layer-pk-annotation)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-an-annotation-layer-annotation-layer-pk-annotation",
          "label": "Create an annotation layer (annotation-layer-pk-annotation)",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/delete-annotation-layer-annotation-layer-pk-annotation-annotation-id",
          "label": "Delete annotation layer (annotation-layer-pk-annotation-annotation-id)",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-an-annotation-layer-annotation-layer-pk-annotation-annotation-id",
          "label": "Get an annotation layer (annotation-layer-pk-annotation-annotation-id)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-an-annotation-layer-annotation-layer-pk-annotation-annotation-id",
          "label": "Update an annotation layer (annotation-layer-pk-annotation-annotation-id)",
          "className": "api-method put"
        }
      ],
      "key": "api-category-annotation-layers"
    },
    {
      "type": "category",
      "label": "Import/export",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/export-all-assets",
          "label": "Export all assets",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/import-multiple-assets",
          "label": "Import multiple assets",
          "className": "api-method post"
        }
      ],
      "key": "api-category-import/export"
    },
    {
      "type": "category",
      "label": "AsyncEventsRestApi",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/read-off-of-the-redis-events-stream",
          "label": "Read off of the Redis events stream",
          "className": "api-method get"
        }
      ],
      "key": "api-category-asynceventsrestapi"
    },
    {
      "type": "category",
      "label": "Available Domains",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-all-available-domains",
          "label": "Get all available domains",
          "className": "api-method get"
        }
      ],
      "key": "api-category-available-domains"
    },
    {
      "type": "category",
      "label": "CacheRestApi",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/invalidate-cache-records-and-remove-the-database-records",
          "label": "Invalidate cache records and remove the database records",
          "className": "api-method post"
        }
      ],
      "key": "api-category-cacherestapi"
    },
    {
      "type": "category",
      "label": "Charts",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-charts",
          "label": "Bulk delete charts",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-charts",
          "label": "Get a list of charts",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-new-chart",
          "label": "Create a new chart",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-chart-info",
          "label": "Get metadata information about this API resource (chart--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/return-payload-data-response-for-the-given-query-chart-data",
          "label": "Return payload data response for the given query (chart-data)",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/return-payload-data-response-for-the-given-query-chart-data-cache-key",
          "label": "Return payload data response for the given query (chart-data-cache-key)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/download-multiple-charts-as-yaml-files",
          "label": "Download multiple charts as YAML files",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/check-favorited-charts-for-current-user",
          "label": "Check favorited charts for current user",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/import-chart-s-with-associated-datasets-and-databases",
          "label": "Import chart(s) with associated datasets and databases",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-chart-related-column-name",
          "label": "Get related fields data (chart-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/warm-up-the-cache-for-the-chart",
          "label": "Warm up the cache for the chart",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/delete-a-chart",
          "label": "Delete a chart",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-chart-detail-information",
          "label": "Get a chart detail information",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-chart",
          "label": "Update a chart",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/compute-and-cache-a-screenshot-chart-pk-cache-screenshot",
          "label": "Compute and cache a screenshot (chart-pk-cache-screenshot)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/return-payload-data-response-for-a-chart",
          "label": "Return payload data response for a chart",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/remove-the-chart-from-the-user-favorite-list",
          "label": "Remove the chart from the user favorite list",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/mark-the-chart-as-favorite-for-the-current-user",
          "label": "Mark the chart as favorite for the current user",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-a-computed-screenshot-from-cache-chart-pk-screenshot-digest",
          "label": "Get a computed screenshot from cache (chart-pk-screenshot-digest)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-chart-thumbnail",
          "label": "Get chart thumbnail",
          "className": "api-method get"
        }
      ],
      "key": "api-category-charts"
    },
    {
      "type": "category",
      "label": "CSS Templates",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-css-templates",
          "label": "Bulk delete CSS templates",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-css-templates",
          "label": "Get a list of CSS templates",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-css-template",
          "label": "Create a CSS template",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-css-template-info",
          "label": "Get metadata information about this API resource (css-template--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-css-template-related-column-name",
          "label": "Get related fields data (css-template-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-a-css-template",
          "label": "Delete a CSS template",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-css-template",
          "label": "Get a CSS template",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-css-template",
          "label": "Update a CSS template",
          "className": "api-method put"
        }
      ],
      "key": "api-category-css-templates"
    },
    {
      "type": "category",
      "label": "Dashboards",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-dashboards",
          "label": "Bulk delete dashboards",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-dashboards",
          "label": "Get a list of dashboards",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-new-dashboard",
          "label": "Create a new dashboard",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-dashboard-info",
          "label": "Get metadata information about this API resource (dashboard--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/download-multiple-dashboards-as-yaml-files",
          "label": "Download multiple dashboards as YAML files",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/check-favorited-dashboards-for-current-user",
          "label": "Check favorited dashboards for current user",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/import-dashboard-s-with-associated-charts-datasets-databases",
          "label": "Import dashboard(s) with associated charts/datasets/databases",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-dashboard-related-column-name",
          "label": "Get related fields data (dashboard-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-dashboard-detail-information",
          "label": "Get a dashboard detail information",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-dashboards-chart-definitions",
          "label": "Get a dashboard's chart definitions.",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-copy-of-an-existing-dashboard",
          "label": "Create a copy of an existing dashboard",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-dashboards-datasets",
          "label": "Get dashboard's datasets",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-a-dashboards-embedded-configuration",
          "label": "Delete a dashboard's embedded configuration",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-the-dashboards-embedded-configuration",
          "label": "Get the dashboard's embedded configuration",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/set-a-dashboards-embedded-configuration",
          "label": "Set a dashboard's embedded configuration",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/update-dashboard-by-id-or-slug-embedded",
          "label": "Update dashboard by id_or_slug embedded",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/get-dashboards-tabs",
          "label": "Get dashboard's tabs",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-a-dashboard",
          "label": "Delete a dashboard",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/update-a-dashboard",
          "label": "Update a dashboard",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/compute-and-cache-a-screenshot-dashboard-pk-cache-dashboard-screenshot",
          "label": "Compute and cache a screenshot (dashboard-pk-cache-dashboard-screenshot)",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/update-colors-configuration-for-a-dashboard",
          "label": "Update colors configuration for a dashboard.",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/remove-the-dashboard-from-the-user-favorite-list",
          "label": "Remove the dashboard from the user favorite list",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/mark-the-dashboard-as-favorite-for-the-current-user",
          "label": "Mark the dashboard as favorite for the current user",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/update-native-filters-configuration-for-a-dashboard",
          "label": "Update native filters configuration for a dashboard.",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/get-a-computed-screenshot-from-cache-dashboard-pk-screenshot-digest",
          "label": "Get a computed screenshot from cache (dashboard-pk-screenshot-digest)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-dashboards-thumbnail",
          "label": "Get dashboard's thumbnail",
          "className": "api-method get"
        }
      ],
      "key": "api-category-dashboards"
    },
    {
      "type": "category",
      "label": "Dashboard Permanent Link",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-dashboards-permanent-link-state",
          "label": "Get dashboard's permanent link state",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-new-dashboards-permanent-link",
          "label": "Create a new dashboard's permanent link",
          "className": "api-method post"
        }
      ],
      "key": "api-category-dashboard-permanent-link"
    },
    {
      "type": "category",
      "label": "Dashboard Filter State",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/create-a-dashboards-filter-state",
          "label": "Create a dashboard's filter state",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/delete-a-dashboards-filter-state-value",
          "label": "Delete a dashboard's filter state value",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-dashboards-filter-state-value",
          "label": "Get a dashboard's filter state value",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-dashboards-filter-state-value",
          "label": "Update a dashboard's filter state value",
          "className": "api-method put"
        }
      ],
      "key": "api-category-dashboard-filter-state"
    },
    {
      "type": "category",
      "label": "Database",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-a-list-of-databases",
          "label": "Get a list of databases",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-new-database",
          "label": "Create a new database",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-database-info",
          "label": "Get metadata information about this API resource (database--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-names-of-databases-currently-available",
          "label": "Get names of databases currently available",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/download-database-s-and-associated-dataset-s-as-a-zip-file",
          "label": "Download database(s) and associated dataset(s) as a zip file",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/import-database-s-with-associated-datasets",
          "label": "Import database(s) with associated datasets",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/receive-personal-access-tokens-from-o-auth-2",
          "label": "Receive personal access tokens from OAuth2",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-database-related-column-name",
          "label": "Get related fields data (database-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/test-a-database-connection",
          "label": "Test a database connection",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/upload-a-file-and-returns-file-metadata",
          "label": "Upload a file and returns file metadata",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/validate-database-connection-parameters",
          "label": "Validate database connection parameters",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/delete-a-database",
          "label": "Delete a database",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-database",
          "label": "Get a database",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/change-a-database",
          "label": "Change a database",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/get-all-catalogs-from-a-database",
          "label": "Get all catalogs from a database",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-database-connection-info",
          "label": "Get a database connection info",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-function-names-supported-by-a-database",
          "label": "Get function names supported by a database",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-charts-and-dashboards-count-associated-to-a-database",
          "label": "Get charts and dashboards count associated to a database",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-all-schemas-from-a-database",
          "label": "Get all schemas from a database",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/the-list-of-the-database-schemas-where-to-upload-information",
          "label": "The list of the database schemas where to upload information",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-database-select-star-for-table-database-pk-select-star-table-name",
          "label": "Get database select star for table (database-pk-select-star-table-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-database-select-star-for-table-database-pk-select-star-table-name-schema-name",
          "label": "Get database select star for table (database-pk-select-star-table-name-schema-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-a-ssh-tunnel",
          "label": "Delete a SSH tunnel",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/re-sync-all-permissions-for-a-database-connection",
          "label": "Re-sync all permissions for a database connection",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-database-table-metadata",
          "label": "Get database table metadata",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-table-extra-metadata-database-pk-table-extra-table-name-schema-name",
          "label": "Get table extra metadata (database-pk-table-extra-table-name-schema-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-table-metadata",
          "label": "Get table metadata",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-table-extra-metadata-database-pk-table-metadata-extra",
          "label": "Get table extra metadata (database-pk-table-metadata-extra)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-tables-for-given-database",
          "label": "Get a list of tables for given database",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/upload-a-file-to-a-database-table",
          "label": "Upload a file to a database table",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/validate-arbitrary-sql",
          "label": "Validate arbitrary SQL",
          "className": "api-method post"
        }
      ],
      "key": "api-category-database"
    },
    {
      "type": "category",
      "label": "Datasets",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-datasets",
          "label": "Bulk delete datasets",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-datasets",
          "label": "Get a list of datasets",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-new-dataset",
          "label": "Create a new dataset",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-dataset-info",
          "label": "Get metadata information about this API resource (dataset--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-distinct-values-from-field-data-dataset-distinct-column-name",
          "label": "Get distinct values from field data (dataset-distinct-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/duplicate-a-dataset",
          "label": "Duplicate a dataset",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/download-multiple-datasets-as-yaml-files",
          "label": "Download multiple datasets as YAML files",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/retrieve-a-table-by-name-or-create-it-if-it-does-not-exist",
          "label": "Retrieve a table by name, or create it if it does not exist",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/import-dataset-s-with-associated-databases",
          "label": "Import dataset(s) with associated databases",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-dataset-related-column-name",
          "label": "Get related fields data (dataset-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/warm-up-the-cache-for-each-chart-powered-by-the-given-table",
          "label": "Warm up the cache for each chart powered by the given table",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/delete-a-dataset",
          "label": "Delete a dataset",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-dataset",
          "label": "Get a dataset",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-dataset",
          "label": "Update a dataset",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/delete-a-dataset-column",
          "label": "Delete a dataset column",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/delete-a-dataset-metric",
          "label": "Delete a dataset metric",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/refresh-and-update-columns-of-a-dataset",
          "label": "Refresh and update columns of a dataset",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/get-charts-and-dashboards-count-associated-to-a-dataset",
          "label": "Get charts and dashboards count associated to a dataset",
          "className": "api-method get"
        }
      ],
      "key": "api-category-datasets"
    },
    {
      "type": "category",
      "label": "Datasources",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-possible-values-for-a-datasource-column",
          "label": "Get possible values for a datasource column",
          "className": "api-method get"
        }
      ],
      "key": "api-category-datasources"
    },
    {
      "type": "category",
      "label": "Embedded Dashboard",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-a-report-schedule-log-embedded-dashboard-uuid",
          "label": "Get a report schedule log (embedded-dashboard-uuid)",
          "className": "api-method get"
        }
      ],
      "key": "api-category-embedded-dashboard"
    },
    {
      "type": "category",
      "label": "Explore",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/assemble-explore-related-information-in-a-single-endpoint",
          "label": "Assemble Explore related information in a single endpoint",
          "className": "api-method get"
        }
      ],
      "key": "api-category-explore"
    },
    {
      "type": "category",
      "label": "Explore Form Data",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/create-a-new-form-data",
          "label": "Create a new form_data",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/delete-a-form-data",
          "label": "Delete a form_data",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-form-data",
          "label": "Get a form_data",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-an-existing-form-data",
          "label": "Update an existing form_data",
          "className": "api-method put"
        }
      ],
      "key": "api-category-explore-form-data"
    },
    {
      "type": "category",
      "label": "Explore Permanent Link",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/create-a-new-permanent-link-explore-permalink",
          "label": "Create a new permanent link (explore-permalink)",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-charts-permanent-link-state",
          "label": "Get chart's permanent link state",
          "className": "api-method get"
        }
      ],
      "key": "api-category-explore-permanent-link"
    },
    {
      "type": "category",
      "label": "LogRestApi",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-a-list-of-logs",
          "label": "Get a list of logs",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-log",
          "label": "Create log",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-recent-activity-data-for-a-user",
          "label": "Get recent activity data for a user",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-log-detail-information",
          "label": "Get a log detail information",
          "className": "api-method get"
        }
      ],
      "key": "api-category-logrestapi"
    },
    {
      "type": "category",
      "label": "Current User",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-the-user-object",
          "label": "Get the user object",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-the-user-roles",
          "label": "Get the user roles",
          "className": "api-method get"
        }
      ],
      "key": "api-category-current-user"
    },
    {
      "type": "category",
      "label": "Menu",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-menu",
          "label": "Get menu",
          "className": "api-method get"
        }
      ],
      "key": "api-category-menu"
    },
    {
      "type": "category",
      "label": "Queries",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-a-list-of-queries",
          "label": "Get a list of queries",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-distinct-values-from-field-data-query-distinct-column-name",
          "label": "Get distinct values from field data (query-distinct-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-query-related-column-name",
          "label": "Get related fields data (query-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/manually-stop-a-query-with-client-id",
          "label": "Manually stop a query with client_id",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-queries-that-changed-after-last-updated-ms",
          "label": "Get a list of queries that changed after last_updated_ms",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-query-detail-information",
          "label": "Get query detail information",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/bulk-delete-saved-queries",
          "label": "Bulk delete saved queries",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-saved-queries",
          "label": "Get a list of saved queries",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-saved-query",
          "label": "Create a saved query",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-saved-query-info",
          "label": "Get metadata information about this API resource (saved-query--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-distinct-values-from-field-data-saved-query-distinct-column-name",
          "label": "Get distinct values from field data (saved-query-distinct-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/download-multiple-saved-queries-as-yaml-files",
          "label": "Download multiple saved queries as YAML files",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/import-saved-queries-with-associated-databases",
          "label": "Import saved queries with associated databases",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-saved-query-related-column-name",
          "label": "Get related fields data (saved-query-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-a-saved-query",
          "label": "Delete a saved query",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-saved-query",
          "label": "Get a saved query",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-saved-query",
          "label": "Update a saved query",
          "className": "api-method put"
        }
      ],
      "key": "api-category-queries"
    },
    {
      "type": "category",
      "label": "Report Schedules",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-report-schedules",
          "label": "Bulk delete report schedules",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-report-schedules",
          "label": "Get a list of report schedules",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-report-schedule",
          "label": "Create a report schedule",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-report-info",
          "label": "Get metadata information about this API resource (report--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-report-related-column-name",
          "label": "Get related fields data (report-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-slack-channels",
          "label": "Get slack channels",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-a-report-schedule",
          "label": "Delete a report schedule",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-report-schedule",
          "label": "Get a report schedule",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-report-schedule",
          "label": "Update a report schedule",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-report-schedule-logs",
          "label": "Get a list of report schedule logs",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-report-schedule-log-report-pk-log-log-id",
          "label": "Get a report schedule log (report-pk-log-log-id)",
          "className": "api-method get"
        }
      ],
      "key": "api-category-report-schedules"
    },
    {
      "type": "category",
      "label": "Row Level Security",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-rls-rules",
          "label": "Bulk delete RLS rules",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-rls",
          "label": "Get a list of RLS",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-new-rls-rule",
          "label": "Create a new RLS rule",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-this-api-resource-rowlevelsecurity-info",
          "label": "Get metadata information about this API resource (rowlevelsecurity--info)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-rowlevelsecurity-related-column-name",
          "label": "Get related fields data (rowlevelsecurity-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-an-rls",
          "label": "Delete an RLS",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-an-rls",
          "label": "Get an RLS",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-an-rls-rule",
          "label": "Update an RLS rule",
          "className": "api-method put"
        }
      ],
      "key": "api-category-row-level-security"
    },
    {
      "type": "category",
      "label": "Security",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-the-csrf-token",
          "label": "Get the CSRF token",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-a-guest-token",
          "label": "Get a guest token",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/create-security-login",
          "label": "Create security login",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/create-security-refresh",
          "label": "Create security refresh",
          "className": "api-method post"
        }
      ],
      "key": "api-category-security"
    },
    {
      "type": "category",
      "label": "Security Permissions on Resources (View Menus)",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-security-permissions-resources",
          "label": "Get security permissions resources",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-security-permissions-resources",
          "label": "Create security permissions resources",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-security-permissions-resources-info",
          "label": "Get security permissions resources  info",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-security-permissions-resources-by-pk",
          "label": "Delete security permissions resources by pk",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-security-permissions-resources-by-pk",
          "label": "Get security permissions resources by pk",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-security-permissions-resources-by-pk",
          "label": "Update security permissions resources by pk",
          "className": "api-method put"
        }
      ],
      "key": "api-category-security-permissions-on-resources-(view-menus)"
    },
    {
      "type": "category",
      "label": "Security Permissions",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-security-permissions",
          "label": "Get security permissions",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-security-permissions-info",
          "label": "Get security permissions  info",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-security-permissions-by-pk",
          "label": "Get security permissions by pk",
          "className": "api-method get"
        }
      ],
      "key": "api-category-security-permissions"
    },
    {
      "type": "category",
      "label": "Security Resources (View Menus)",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-security-resources",
          "label": "Get security resources",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-security-resources",
          "label": "Create security resources",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-security-resources-info",
          "label": "Get security resources  info",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-security-resources-by-pk",
          "label": "Delete security resources by pk",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-security-resources-by-pk",
          "label": "Get security resources by pk",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-security-resources-by-pk",
          "label": "Update security resources by pk",
          "className": "api-method put"
        }
      ],
      "key": "api-category-security-resources-(view-menus)"
    },
    {
      "type": "category",
      "label": "Security Roles",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-security-roles",
          "label": "Get security roles",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-security-roles",
          "label": "Create security roles",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-security-roles-info",
          "label": "Get security roles  info",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/list-roles",
          "label": "List roles",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-security-roles-by-pk",
          "label": "Delete security roles by pk",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-security-roles-by-pk",
          "label": "Get security roles by pk",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-security-roles-by-pk",
          "label": "Update security roles by pk",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/create-security-roles-by-role-id-permissions",
          "label": "Create security roles by role_id permissions",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-security-roles-by-role-id-permissions",
          "label": "Get security roles by role_id permissions",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-security-roles-by-role-id-users",
          "label": "Update security roles by role_id users",
          "className": "api-method put"
        }
      ],
      "key": "api-category-security-roles"
    },
    {
      "type": "category",
      "label": "Security Users",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-security-users",
          "label": "Get security users",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-security-users",
          "label": "Create security users",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-security-users-info",
          "label": "Get security users  info",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/delete-security-users-by-pk",
          "label": "Delete security users by pk",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-security-users-by-pk",
          "label": "Get security users by pk",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-security-users-by-pk",
          "label": "Update security users by pk",
          "className": "api-method put"
        }
      ],
      "key": "api-category-security-users"
    },
    {
      "type": "category",
      "label": "SQL Lab",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-the-bootstrap-data-for-sql-lab-page",
          "label": "Get the bootstrap data for SqlLab page",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/estimate-the-sql-query-execution-cost",
          "label": "Estimate the SQL query execution cost",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/execute-a-sql-query",
          "label": "Execute a SQL query",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/export-the-sql-query-results-to-a-csv",
          "label": "Export the SQL query results to a CSV",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/format-sql-code",
          "label": "Format SQL code",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-the-result-of-a-sql-query-execution",
          "label": "Get the result of a SQL query execution",
          "className": "api-method get"
        }
      ],
      "key": "api-category-sql-lab"
    },
    {
      "type": "category",
      "label": "SQL Lab Permanent Link",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/create-a-new-permanent-link-sqllab-permalink",
          "label": "Create a new permanent link (sqllab-permalink)",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-permanent-link-state-for-sql-lab-editor",
          "label": "Get permanent link state for SQLLab editor.",
          "className": "api-method get"
        }
      ],
      "key": "api-category-sql-lab-permanent-link"
    },
    {
      "type": "category",
      "label": "Tags",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/bulk-delete-tags",
          "label": "Bulk delete tags",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-list-of-tags",
          "label": "Get a list of tags",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/create-a-tag",
          "label": "Create a tag",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-metadata-information-about-tag-api-endpoints",
          "label": "Get metadata information about tag API endpoints",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/bulk-create-tags-and-tagged-objects",
          "label": "Bulk create tags and tagged objects",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/get-tag-favorite-status",
          "label": "Get tag favorite status",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-all-objects-associated-with-a-tag",
          "label": "Get all objects associated with a tag",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/get-related-fields-data-tag-related-column-name",
          "label": "Get related fields data (tag-related-column-name)",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/add-tags-to-an-object",
          "label": "Add tags to an object",
          "className": "api-method post"
        },
        {
          "type": "doc",
          "id": "api/delete-a-tagged-object",
          "label": "Delete a tagged object",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/delete-a-tag",
          "label": "Delete a tag",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/get-a-tag-detail-information",
          "label": "Get a tag detail information",
          "className": "api-method get"
        },
        {
          "type": "doc",
          "id": "api/update-a-tag",
          "label": "Update a tag",
          "className": "api-method put"
        },
        {
          "type": "doc",
          "id": "api/delete-tag-by-pk-favorites",
          "label": "Delete tag by pk favorites",
          "className": "api-method delete"
        },
        {
          "type": "doc",
          "id": "api/create-tag-by-pk-favorites",
          "label": "Create tag by pk favorites",
          "className": "api-method post"
        }
      ],
      "key": "api-category-tags"
    },
    {
      "type": "category",
      "label": "User",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-the-user-avatar",
          "label": "Get the user avatar",
          "className": "api-method get"
        }
      ],
      "key": "api-category-user"
    },
    {
      "type": "category",
      "label": "OpenApi",
      "collapsible": true,
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "api/get-api-by-version-openapi",
          "label": "Get api by version  openapi",
          "className": "api-method get"
        }
      ],
      "key": "api-category-openapi"
    }
  ]
};

module.exports = sidebar.apisidebar;
