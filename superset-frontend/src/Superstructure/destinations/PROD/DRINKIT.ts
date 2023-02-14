const PROD_DRINKIT_COMMON_DASHBOARDS = {
  HRMetrics: {
    idOrSlug: 'HRMetrics',
    name: 'Метрики HR — услуги поддержки клиентов',
    route: 'HRMetrics',
    hidden: false,
  },
};

const PROD_DRINKIT_MAIN_MENU_HELPER = {
  Main: {
    idOrSlug: null,
    name: 'Главная',
    route: 'Main',
    hidden: false,
  },
};

const PROD_DRINKIT_AVAILABLE_EXTRA = ['analytics'];
const PROD_DRINKIT_AVAILABLE_ROLES = ['officemanager'];

const PROD_DRINKIT = {
  officemanager: {
    analytics: {
      Operational: {
        idOrSlug: '79',
        name: 'Операционный дашборд',
        route: 'Operational',
        hidden: false,
      },
      Staffing: {
        idOrSlug: 'Staffing',
        name: 'Укомплектованность. Россия',
        route: 'Staffing',
        hidden: false,
      },
      Fraud: {
        idOrSlug: '78',
        name: 'Фрод по додокоинам',
        route: 'Fraud',
        hidden: false,
      },
      IMFFinance: {
        idOrSlug: 34,
        name: 'IMF Finance',
        route: 'IMFFinance',
        hidden: false,
      },
      FinanceEurasia: {
        idOrSlug: 'FinanceEurasia',
        name: 'Финансы. Евразия',
        route: 'FinanceEurasia',
        hidden: false,
      },
    },
  },
};

export {
  PROD_DRINKIT,
  PROD_DRINKIT_COMMON_DASHBOARDS,
  PROD_DRINKIT_MAIN_MENU_HELPER,
  PROD_DRINKIT_AVAILABLE_EXTRA,
  PROD_DRINKIT_AVAILABLE_ROLES,
};
