const GO_TO_ANALYTICS_BTN = 'Перейти в аналитику  (standalone)';
const RULES_BTN = 'Правила работы с аналитикой';

const RULES_TITLE = 'Добро пожаловать в Superset dashboard plugin';

const RULES_DESSCRIPTION = `Слева можно выбрать интересующий дашборд. Данный инструмент встроен в DODO IS и показывает дашборды из standalone сервиса по ссылке: https://analytics.dodois.io/`;
const RULES_ATTENTION = `Если у Вас возникли вопросы, то можно обратиться в техподдержку, либо в команду Data Engineering`;

const GLOBAL_WARNING_DEFAULT_HEADER = 'Unexpected error happend =(';
const GLOBAL_WARNING_DEFAULT_BODY = 'Случилась непредвиденная ошибка в Superset dashboard plugin. Обратитесь в команду тех поддержки';

const LIMIT_WARNING_HEADER = 'Измените параметры фильтров';
const LIMIT_WARNING_BODY = 'Визуальный элемент не может быть отрисован, так как количество данных выборки превысило лимит. Количество строк выборки не должно превышать ';

const UNAVAILABLE_HEADER = 'Maintanance message';
const UNAVAILABLE_BODY = 'Superset Dashboard Plugin is currently not available. It is either broken or major updates are happening at this time. The tech team is currently working on resolving this problem. Please be patient';

const UNAVAILABLE_BODY_RU = 'Superset Dashboard Plugin в настоящее время недоступен. Он либо сломан, либо происходят важные обновления. Техническая команда работает над решением этой проблемы. Пожалуйста, будьте терпеливы';

export {
  GO_TO_ANALYTICS_BTN,
  RULES_BTN,
  RULES_TITLE,
  RULES_DESSCRIPTION,
  RULES_ATTENTION,
  GLOBAL_WARNING_DEFAULT_HEADER,
  GLOBAL_WARNING_DEFAULT_BODY,
  LIMIT_WARNING_HEADER,
  LIMIT_WARNING_BODY,
  UNAVAILABLE_HEADER,
  UNAVAILABLE_BODY,
  UNAVAILABLE_BODY_RU
};
