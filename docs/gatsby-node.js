/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

exports.createPages = ({ actions }) => {
  const { createRedirect } = actions; //actions is collection of many actions - https://www.gatsbyjs.org/docs/actions
  createRedirect({
    fromPath: '/installation.html',
    toPath: '/docs/installation/installing-superset-using-docker-compose',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#getting-started',
    toPath: '/docs/installation/installing-superset-using-docker-compose',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#cloud-native',
    toPath: '/docs/installation/installing-superset-using-docker-compose',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#start-with-docker',
    toPath: '/docs/installation/installing-superset-using-docker-compose',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#os-dependencies',
    toPath: '/docs/installation/installing-superset-from-scratch#installing-superset-from-scratch',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#python-virtualenv',
    toPath: '/docs/installation/installing-superset-from-scratch#installing-superset-from-scratch',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#python-s-setup-tools-and-pip',
    toPath: '/docs/installation/installing-superset-from-scratch#installing-superset-from-scratch',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#superset-installation-and-initialization',
    toPath: '/docs/installation/installing-superset-from-scratch#installing-superset-from-scratch',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#a-proper-wsgi-http-server',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#flask-appbuilder-permissions',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#configuration-behind-a-load-balancer',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#configuration',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#database-dependencies',
    toPath: '/docs/databases/installing-database-drivers',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#hana',
    toPath: '/docs/databases/hana',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#aws-athena',
    toPath: '/docs/databases/athena',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#google-bigquery',
    toPath: '/docs/databases/bigquery',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#elasticsearch',
    toPath: '/docs/databases/elasticsearch',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#snowflake',
    toPath: '/docs/databases/snowflake',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#teradata',
    toPath: '/docs/databases/teradata',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#apache-drill',
    toPath: '/docs/databases/drill',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#caching',
    toPath: '/docs/installation/cache',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#deeper-sqlalchemy-integration',
    toPath: '/docs/databases/extra-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#schemas-postgres-redshift',
    toPath: '/docs/databases/extra-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#external-password-store-for-sqlalchemy-connections',
    toPath: '/docs/databases/extra-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#ssl-access-to-databases',
    toPath: '/docs/databases/extra-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#druid',
    toPath: '/docs/databases/druid',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#presto',
    toPath: '/docs/databases/presto',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#exasol',
    toPath: '/docs/databases/exasol',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#cors',
    toPath: '/docs/installation/networking-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#domain-sharding',
    toPath: '/docs/installation/networking-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#middleware',
    toPath: '/docs/installation/networking-settings',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#event-logging',
    toPath: '/docs/installation/event-logging',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#upgrading',
    toPath: '/docs/installation/upgrading-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#celery-tasks',
    toPath: '/docs/installation/async-queries-celery',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#email-reports',
    toPath: '/docs/installation/email-reports',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#sql-lab',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#celery-flower',
    toPath: '/docs/installation/async-queries-celery',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#building-from-source',
    toPath: '/docs/contributing/contribution-guidelines',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#blueprints',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#statsd-logging',
    toPath: '/docs/installation/event-logging',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#install-superset-with-helm-in-kubernetes',
    toPath: '/docs/installation/installing-superset-from-scratch',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#custom-oauth2-configuration',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#feature-flags',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/installation.html#sip-15',
    toPath: '/docs/installation/configuring-superset',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/tutorials.html',
    toPath: '/docs/intro',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/admintutorial.html',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/admintutorial.html#connecting-to-a-new-database',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/admintutorial.html#adding-a-new-table',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/admintutorial.html#exploring-your-data',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/admintutorial.html#creating-a-slice-and-dashboard',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#enabling-upload-a-csv-functionality',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#obtaining-and-loading-the-data',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#table-visualization',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#dashboard-basics',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#pivot-table',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#line-chart',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#markup',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#filter-box',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#native-filters',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#publishing-your-dashboard',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#taking-your-dashboard-further',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#annotations',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#advanced-analytics',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#setting-up-the-base-chart',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#rolling-mean',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#time-comparison',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/usertutorial.html#resampling-the-data',
    toPath: '/docs/creating-charts-dashboards/exploring-data',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#provided-roles',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#admin',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#alpha',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#gamma',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#sql-lab',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#public',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#managing-gamma-per-data-source-access',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#customizing',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#permissions',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/security.html#restricting-access-to-a-subset-of-data-sources',
    toPath: '/docs/security',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html#feature-overview',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html#extra-features',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html#templating-with-jinja',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html#available-macros',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html#extending-macros',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/sqllab.html#query-cost-estimation',
    toPath: '/docs/installation/sql-templating',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/gallery.html',
    toPath: '/docs/intro',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/druid.html',
    toPath: '/docs/databases/druid',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/druid.html#aggregations',
    toPath: '/docs/databases/druid',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/druid.html#post-aggregations',
    toPath: '/docs/databases/druid',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/druid.html#unsupported-features',
    toPath: '/docs/databases/druid',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/misc.html',
    toPath: '/docs/miscellaneous/country-map-tools',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/visualization.html',
    toPath: '/docs/miscellaneous/country-map-tools',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/visualization.html#country-map-tools',
    toPath: '/docs/miscellaneous/country-map-tools',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/visualization.html#list-of-countries',
    toPath: '/docs/miscellaneous/country-map-tools',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/visualization.html#need-to-add-a-new-country',
    toPath: '/docs/miscellaneous/country-map-tools',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/videos.html',
    toPath: '/resources',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/import_export_datasources.html#exporting-datasources-to-yaml',
    toPath: '/docs/miscellaneous/importing-exporting-datasources',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/import_export_datasources.html#exporting-the-complete-supported-yaml-schema',
    toPath: '/docs/miscellaneous/importing-exporting-datasources',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/import_export_datasources.html#importing-datasources-from-yaml',
    toPath: '/docs/miscellaneous/importing-exporting-datasources',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#can-i-query-join-multiple-tables-at-one-time',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-big-can-my-data-source-be',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-do-i-create-my-own-visualization',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#can-i-upload-and-visualize-csv-data',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#why-are-my-queries-timing-out',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#why-is-the-map-not-visible-in-the-mapbox-visualization',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-to-add-dynamic-filters-to-a-dashboard',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-to-limit-the-timed-refresh-on-a-dashboard',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#why-does-flask-fab-or-superset-freezed-hung-not-responding-when-started-my-home-directory-is-nfs-mounted',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#what-if-the-table-schema-changed',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-do-i-go-about-developing-a-new-visualization-type',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#what-database-engine-can-i-use-as-a-backend-for-superset',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-can-i-configure-oauth-authentication-and-authorization',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#how-can-i-set-a-default-filter-on-my-dashboard',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: 'faq.html#how-do-i-get-superset-to-refresh-the-schema-of-my-table',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#is-there-a-way-to-force-the-use-specific-colors',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/faq.html#does-superset-work-with-insert-database-engine-here',
    toPath: '/docs/frequently-asked-questions',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/index.html',
    toPath: '/docs/intro',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/tutorial.html',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/tutorial.html#connecting-to-a-new-database',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/tutorial.html#adding-a-new-table',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/tutorial.html#exploring-your-data',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/tutorial.html#creating-a-slice-and-dashboard',
    toPath: '/docs/creating-charts-dashboards/first-dashboard',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/issue_code_reference.html#issue-1000',
    toPath: '/docs/miscellaneous/issue-codes#issue-1000',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/issue_code_reference.html#issue-1001',
    toPath: '/docs/miscellaneous/issue-codes#issue-1001',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/issue_code_reference.html#issue-1002',
    toPath: '/docs/miscellaneous/issue-codes#issue-1002',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/issue_code_reference.html#issue-1003',
    toPath: '/docs/miscellaneous/issue-codes#issue-1003',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/issue_code_reference.html#issue-1004',
    toPath: '/docs/miscellaneous/issue-codes#issue-1004',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/issue_code_reference.html#issue-1005',
    toPath: '/docs/miscellaneous/issue-codes#issue-1005',
    isPermanent: true,
  });
  createRedirect({
    fromPath: '/docs/installation/email-reports',
    toPath: '/docs/installation/alerts-reports',
    isPermanent: true,
  });
};
