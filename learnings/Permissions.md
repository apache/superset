# permissions

list -> read

## Initial page with no error

1. can fave slices on Superset
1. can fave dashboards on Superset
1. can recent activity on Superset

## List of dashboards

1. can list on DashboardModelViewAsync

## See a dashboard

1. can dashboard on Superset => for view a dashbaord
1. can explore JSON on Superset => for viewing slice inside a chart
1. can list on CssTemplateAsyncModelView => for template

## Perm Gyaan

1. Async is used for list view of model
1. cam list for showing in a list
1. can show for show buton in lits
1. can edit for edit button in list

## SEE Permissons 

   ```sql
        select ab_permission.name, ab_view_menu.name, ab_role.name from ab_permission_view JOIN ab_permission ON ab_permission_view.permission_id = ab_permission.id JOIN ab_permission_view_role on ab_permission_view.id = ab_permission_view_role.permission_view_id JOIN ab_role ON ab_role.id = ab_permission_view_role.role_id JOIN ab_view_menu ON ab_view_menu.id = ab_permission_view.view_menu_id where ab_role.name = 'Dashboard_Viewer';
    ```

    ```sql 
    select ab_permission.name, ab_view_menu.name, ab_role.name from ab_permission_view JOIN ab_permission ON ab_permission_view.permission_id = ab_permission.id JOIN ab_permission_view_role ON ab_permission_view.id = ab_permission_view_role.permission_view_id JOIN ab_role ON ab_role.id = ab_permission_view_role.role_id JOIN ab_view_menu ON ab_view_menu.id = ab_permission_view.view_menu_id where ab_role.id = 1;

    ```

  