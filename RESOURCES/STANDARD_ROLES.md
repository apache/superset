||Admin|Alpha|Gamma|SQL_LAB|
|---|---|---|---|---|
|Permission/role description|Admins have all possible rights, including granting or revoking rights from other users and altering other people’s slices and dashboards.| Alpha users have access to all data sources, but they cannot grant or revoke access from other users. They are also limited to altering the objects that they own. Alpha users can add and alter data sources.|Gamma users have limited access. They can only consume data coming from data sources they have been given access to through another complementary role. They only have access to view the slices and dashboards made from data sources that they have access to. Currently Gamma users are not able to alter or add data sources. We assume that they are mostly content consumers, though they can create slices and dashboards.|The sql_lab role grants access to SQL Lab. Note that while Admin users have access to all databases by default, both Alpha and Gamma users need to be given access on a per database basis.||
|can read on SavedQuery|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|can write on SavedQuery|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on CssTemplate|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on CssTemplate|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on ReportSchedule|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on ReportSchedule|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on Chart|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on Chart|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on Annotation|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on Annotation|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on Dataset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on Dataset|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can read on Log|:heavy_check_mark:|O|O|O|
|can write on Log|:heavy_check_mark:|O|O|O|
|can read on Dashboard|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on Dashboard|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on Database|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|can write on Database|:heavy_check_mark:|O|O|O|
|can read on Query|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form get on ResetPasswordView|:heavy_check_mark:|O|O|O|
|can this form post on ResetPasswordView|:heavy_check_mark:|O|O|O|
|can this form get on ResetMyPasswordView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form post on ResetMyPasswordView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form get on UserInfoEditView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form post on UserInfoEditView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on UserDBModelView|:heavy_check_mark:|O|O|O|
|can edit on UserDBModelView|:heavy_check_mark:|O|O|O|
|can delete on UserDBModelView|:heavy_check_mark:|O|O|O|
|can add on UserDBModelView|:heavy_check_mark:|O|O|O|
|can list on UserDBModelView|:heavy_check_mark:|O|O|O|
|can userinfo on UserDBModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|resetmypassword on UserDBModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|resetpasswords on UserDBModelView|:heavy_check_mark:|O|O|O|
|userinfoedit on UserDBModelView|:heavy_check_mark:|O|O|O|
|can show on RoleModelView|:heavy_check_mark:|O|O|O|
|can edit on RoleModelView|:heavy_check_mark:|O|O|O|
|can delete on RoleModelView|:heavy_check_mark:|O|O|O|
|can add on RoleModelView|:heavy_check_mark:|O|O|O|
|can list on RoleModelView|:heavy_check_mark:|O|O|O|
|copyrole on RoleModelView|:heavy_check_mark:|O|O|O|
|can get on OpenApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on SwaggerView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can get on MenuApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on AsyncEventsRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can invalidate on CacheRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can function names on Database|:heavy_check_mark:|O|O|O|
|can query form data on Api|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can query on Api|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can time range on Api|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form get on CsvToDatabaseView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form post on CsvToDatabaseView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form get on ExcelToDatabaseView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form post on ExcelToDatabaseView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can external metadata on Datasource|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can save on Datasource|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can get on Datasource|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can shortner on R|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can my queries on SqlLab|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can log on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can schemas access for csv upload on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can user slices on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can favstar on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can estimate query cost on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can import dashboards on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can search queries on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can sqllab viz on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|can schemas on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can sqllab history on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can copy dash on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can publish on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can csv on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|can datasources on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can fave dashboards by username on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can sql json on Superset|:heavy_check_mark:|O|O|:heavy_check_mark:|
|can slice on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can sync druid source on Superset|:heavy_check_mark:|O|O|O|
|can explore on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can fave slices on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can tables on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can slice json on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can approve on Superset|:heavy_check_mark:|O|O|O|
|can explore json on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can fetch datasource metadata on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can override role permissions on Superset|:heavy_check_mark:|O|O|O|
|can created dashboards on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can extra table metadata on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can csrf token on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can created slices on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can testconn on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can annotation json on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add slices on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can fave dashboards on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can save dash on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can sqllab on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|can recent activity on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can select star on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can warm up cache on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can sqllab table viz on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|can profile on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can validate sql json on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can available domains on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can queries on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can stop query on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can request access on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can filter on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can dashboard on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can results on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can post on TableSchemaView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can expanded on TableSchemaView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on TableSchemaView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can get on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can post on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete query on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can migrate query on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can activate on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can put on TabStateView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on SecurityRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Security|:heavy_check_mark:|O|O|O|
|menu access on List Users|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on List Roles|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Action Log|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Manage|:heavy_check_mark:|:heavy_check_mark:|O|O|
|menu access on Annotation Layers|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on CSS Templates|:heavy_check_mark:|:heavy_check_mark:|O|O|
|menu access on Import Dashboards|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Data|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Databases|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Datasets|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Upload a CSV|:heavy_check_mark:|:heavy_check_mark:|O|O|
|menu access on Upload Excel|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Charts|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Dashboards|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on SQL Lab|:heavy_check_mark:|O|O|:heavy_check_mark:|
|menu access on SQL Editor|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|menu access on Saved Queries|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|menu access on Query Search|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|
|all datasource access on all_datasource_access|:heavy_check_mark:|:heavy_check_mark:|O|O|
|all database access on all_database_access|:heavy_check_mark:|:heavy_check_mark:|O|O|
|all query access on all_query_access|:heavy_check_mark:|O|O|O|
|can edit on UserOAuthModelView|:heavy_check_mark:|O|O|O|
|can list on UserOAuthModelView|:heavy_check_mark:|O|O|O|
|can show on UserOAuthModelView|:heavy_check_mark:|O|O|O|
|can userinfo on UserOAuthModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on UserOAuthModelView|:heavy_check_mark:|O|O|O|
|can delete on UserOAuthModelView|:heavy_check_mark:|O|O|O|
|userinfoedit on UserOAuthModelView|:heavy_check_mark:|O|O|O|
|can write on DynamicPlugin|:heavy_check_mark:|O|O|O|
|can edit on DynamicPlugin|:heavy_check_mark:|O|O|O|
|can list on DynamicPlugin|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on DynamicPlugin|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can download on DynamicPlugin|:heavy_check_mark:|O|O|O|
|can add on DynamicPlugin|:heavy_check_mark:|O|O|O|
|can delete on DynamicPlugin|:heavy_check_mark:|O|O|O|
|can edit on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|can list on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|can show on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|can download on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|can add on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|can delete on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|muldelete on RowLevelSecurityFiltersModelView|:heavy_check_mark:|O|O|O|
|can external metadata by name on Datasource|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can get value on KV|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can store on KV|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can tagged objects on TagView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can suggestions on TagView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can get on TagView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can post on TagView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on TagView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can edit on DashboardEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on DashboardEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on DashboardEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on DashboardEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on DashboardEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|muldelete on DashboardEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can edit on SliceEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on SliceEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on SliceEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on SliceEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on SliceEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|muldelete on SliceEmailScheduleView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can edit on AlertModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on AlertModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on AlertModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on AlertModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on AlertModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on AlertLogModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on AlertLogModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on AlertObservationModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on AlertObservationModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can edit on AccessRequestsModelView|:heavy_check_mark:|O|O|O|
|can list on AccessRequestsModelView|:heavy_check_mark:|O|O|O|
|can show on AccessRequestsModelView|:heavy_check_mark:|O|O|O|
|can add on AccessRequestsModelView|:heavy_check_mark:|O|O|O|
|can delete on AccessRequestsModelView|:heavy_check_mark:|O|O|O|
|muldelete on AccessRequestsModelView|:heavy_check_mark:|O|O|O|
|can edit on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can list on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can delete on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|muldelete on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|yaml export on DruidDatasourceModelView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can edit on DruidClusterModelView|:heavy_check_mark:|O|O|O|
|can list on DruidClusterModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can show on DruidClusterModelView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on DruidClusterModelView|:heavy_check_mark:|O|O|O|
|can delete on DruidClusterModelView|:heavy_check_mark:|O|O|O|
|muldelete on DruidClusterModelView|:heavy_check_mark:|O|O|O|
|yaml export on DruidClusterModelView|:heavy_check_mark:|O|O|O|
|can list on DruidMetricInlineView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on DruidMetricInlineView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can delete on DruidMetricInlineView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can edit on DruidMetricInlineView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can list on DruidColumnInlineView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on DruidColumnInlineView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can delete on DruidColumnInlineView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can edit on DruidColumnInlineView|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can refresh datasources on Druid|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can scan new datasources on Druid|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Row Level Security|:heavy_check_mark:|O|O|O|
|menu access on Access requests|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Home|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Plugins|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Dashboard Email Schedules|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Chart Emails|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Alerts|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Alerts & Report|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Druid Datasources|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Druid Clusters|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Scan New Datasources|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Refresh Druid Metadata|:heavy_check_mark:|O|O|O|
|can share dashboard on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can share chart on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can list on FilterSets|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can add on FilterSets|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete on FilterSets|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can edit on FilterSets|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form get on ColumnarToDatabaseView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can this form post on ColumnarToDatabaseView|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can schemas access for file upload on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|menu access on Upload a Columnar file|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can export on Chart|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on DashboardFilterStateRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on DashboardFilterStateRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on DashboardPermalinkRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on DashboardPermalinkRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can delete embedded on Dashboard|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can set embedded on Dashboard|:heavy_check_mark:|O|O|O|
|can export on Dashboard|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can get embedded on Dashboard|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can export on Database|:heavy_check_mark:|O|O|O|
|can export on Dataset|:heavy_check_mark:|:heavy_check_mark:|O|O|
|can write on ExploreFormDataRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on ExploreFormDataRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can write on ExplorePermalinkRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on ExplorePermalinkRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can export on ImportExportRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can import on ImportExportRestApi|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can export on SavedQuery|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can dashboard permalink on Superset|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can grant guest token on SecurityRestApi|:heavy_check_mark:|O|O|O|
|can read on AdvancedDataType|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
|can read on EmbeddedDashboard|:heavy_check_mark:|:heavy_check_mark:|:heavy_check_mark:|O|
