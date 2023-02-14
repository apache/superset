const DEV_DONER42_COMMON_DASHBOARDS = {
  DemoDashboard: {
    idOrSlug: 16,
    name: 'Demo Dashboard',
    route: 'DemoDashboard',
    hidden: false,
  },
};

const DEV_DONER42_MAIN_MENU_HELPER = {
  Main: {
    idOrSlug: null,
    name: 'Главная',
    route: 'Main',
    hidden: false,
  },
};

const DEV_DONER42_AVAILABLE_EXTRA = ['analytics'];
const DEV_DONER42_AVAILABLE_ROLES = ['officemanager'];

const DEV_DONER42 = {
  officemanager: {
    analytics: {
      Small: {
        idOrSlug: 19,
        name: 'Рандомный дашборд',
        route: 'Small',
        hidden: false,
      },
      Test: {
        idOrSlug: 14,
        name: 'Тестовый дашборд',
        route: 'Test',
        hidden: false,
      },
    },
  },
};

export {
  DEV_DONER42,
  DEV_DONER42_COMMON_DASHBOARDS,
  DEV_DONER42_MAIN_MENU_HELPER,
  DEV_DONER42_AVAILABLE_EXTRA,
  DEV_DONER42_AVAILABLE_ROLES,
};
