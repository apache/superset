import {
  DODOPIZZA_ANALYTICS_URL,
  DODOPIZZA_KNOWLEDGEBASE_URL,
} from 'src/Superstructure/constants';

const GLOBAL_WARNING_DEFAULT_HEADER = 'Unexpected error happend =(';
const GLOBAL_WARNING_DEFAULT_BODY =
  'Случилась непредвиденная ошибка в Superset dashboard plugin. Обратитесь в команду тех поддержки';

const LIMIT_WARNING_HEADER = 'Измените параметры фильтров';
const LIMIT_WARNING_BODY =
  'Визуальный элемент не может быть отрисован, так как количество данных выборки превысило лимит. Количество строк выборки не должно превышать ';

const UNAVAILABLE = {
  header: 'Maintanance message',
  body: 'Superset Dashboard Plugin is currently not available. It is either broken or major updates are happening at this time. The tech team is currently working on resolving this problem. Please be patient',
  bodyRu:
    'Superset Dashboard Plugin в настоящее время недоступен. Он либо сломан, либо происходят важные обновления. Техническая команда работает над решением этой проблемы. Пожалуйста, будьте терпеливы',
};

const IF_QUESTIONS_RU =
  'Если у Вас возникли вопросы, то можно обратиться в команду Data Engineering';

const RULES_RU = {
  title: 'Добро пожаловать в Superset dashboard plugin',
  subTitle: 'Ожидаются проблемы со стабильной работой Superset.',
  extra: IF_QUESTIONS_RU,
  messages: [
    'Слева можно выбрать интересующий дашборд.',
    'Данный инструмент встроен в DODO IS и показывает дашборды из standalone сервиса по ссылке: https://analytics.dodois.io/',
  ],
  buttons: [
    {
      txt: 'Правила работы с аналитикой',
      link: DODOPIZZA_KNOWLEDGEBASE_URL,
      class: 'btn-warning',
    },
    {
      txt: 'Перейти в аналитику  (standalone)',
      link: DODOPIZZA_ANALYTICS_URL,
      class: 'btn-info',
    },
  ],
};

const CSV_TEMP_PROBLEM_RU = {
  title: 'Внимание! Экспорт данных в CSV формате временно не работает.',
  date: 'Команда Data Engineering работает над устранением данной пробемы (08.02.2023)',
  subTitle: 'Текущее решение:',
  messages: [
    'Перейти в standalone сервис по ссылке: https://analytics.dodois.io/ или выше по кнопке "Перейти в аналитику (standalone)".',
    'Выбрать отчет и настроить в нем фильтры.',
    'У визуального элемента в правом верхнем углу нажать на три точки - выбрать "Export CSV"',
  ],
};

const UPGRADE_2_0_RU = {
  title: 'Переход на версию Superset 2.0',
  date: 'Команда Data Engineering работает над стабилизацией (07.03.2023)',
  subTitle: 'Ожидаются проблемы со стабильной работой Superset.',
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы в версии 2.0',
  messages: [
    'Исправлены проблемы с отображением кириллицы при экспорте графиков в CSV формате',
    'Исправлены проблемы со стилистикой дашбордов',
    'Улучшена работа с нативными фильтрами (урезан URL)',
  ],
  listTitleExtra: 'Возможные проблемы в версии 2.0',
  messagesExtra: [
    'Возможные проблемы с d3 форматированием',
    'Возможные проблемы с отображением некоторых графиков',
  ],
};

export {
  RULES_RU,
  GLOBAL_WARNING_DEFAULT_HEADER,
  GLOBAL_WARNING_DEFAULT_BODY,
  LIMIT_WARNING_HEADER,
  LIMIT_WARNING_BODY,
  UNAVAILABLE,
  CSV_TEMP_PROBLEM_RU,
  UPGRADE_2_0_RU,
};
