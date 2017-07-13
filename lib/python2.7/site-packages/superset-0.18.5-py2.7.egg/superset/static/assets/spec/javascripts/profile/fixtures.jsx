export const user = {
  username: 'alpha',
  roles: {
    Alpha: [
      [
        'can_this_form_post',
        'ResetMyPasswordView',
      ],
      [
        'can_this_form_get',
        'ResetMyPasswordView',
      ],
      [
        'can_this_form_post',
        'UserInfoEditView',
      ],
      [
        'can_this_form_get',
        'UserInfoEditView',
      ],
    ],
    sql_lab: [
      [
        'menu_access',
        'SQL Lab',
      ],
      [
        'can_sql_json',
        'Superset',
      ],
      [
        'can_search_queries',
        'Superset',
      ],
      [
        'can_csv',
        'Superset',
      ],
    ],
  },
  firstName: 'alpha',
  lastName: 'alpha',
  createdOn: '2016-11-11T12:34:17',
  userId: 5,
  email: 'alpha@alpha.com',
  isActive: true,
  permissions: {
    datasource_access: ['table1', 'table2'],
    database_access: ['db1', 'db2', 'db3'],
  },
};
export const userNoPerms = Object.assign({}, user, { permissions: {} });
