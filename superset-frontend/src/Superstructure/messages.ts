/* eslint-disable theme-colors/no-literal-colors */
import {
  DODOPIZZA_ANALYTICS_URL,
  DODOPIZZA_KNOWLEDGEBASE_URL,
} from './constants';

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
  'Если у Вас возникли вопросы, то можно обратиться в команду поддержки';

const RULES_RU = {
  title: 'Добро пожаловать в Superset dashboard plugin',
  subTitle: 'Новый инструмент от команды DE',
  extra: IF_QUESTIONS_RU,
  messages: [
    'Слева можно выбрать интересующий дашборд.',
    'Данный инструмент встроен в DODO IS и показывает дашборды из standalone сервиса по ссылке: https://analytics.dodois.io/',
    'Примененные конфигурации: CERTIFIED BY => DODOPIZZA',
  ],
  buttons: [
    {
      txt: 'Правила работы с аналитикой',
      link: DODOPIZZA_KNOWLEDGEBASE_URL,
    },
    {
      txt: 'Перейти в аналитику  (standalone)',
      link: DODOPIZZA_ANALYTICS_URL,
    },
  ],
};

const RULES_DRINKIT_RU = {
  title: 'Добро пожаловать в Superset dashboard plugin',
  subTitle: 'Новый инструмент от команды DE для DRINKIT',
  extra: IF_QUESTIONS_RU,
  messages: [
    'Слева можно выбрать интересующий дашборд.',
    'Данный инструмент встроен в DODO IS и показывает дашборды из standalone сервиса по ссылке: https://analytics.dodois.io/',
    'Примененные конфигурации: CERTIFIED BY => DRINKIT',
  ],
  buttons: [
    {
      txt: 'Посмотреть инструкцию по работе с дашбордами',
      link: 'https://dodopizza.info/support/articles/f8170159-480d-4f82-9564-192ced3159b9/ru',
    },
    {
      txt: 'Посмотреть все доступные дашборды',
      link: DODOPIZZA_ANALYTICS_URL,
    },
  ],
};

const RULES_DONER42_RU = {
  title: 'Добро пожаловать в Superset dashboard plugin',
  subTitle: 'Новый инструмент от команды DE для DONER42',
  extra: IF_QUESTIONS_RU,
  messages: [
    'Слева можно выбрать интересующий дашборд.',
    'Данный инструмент встроен в DODO IS и показывает дашборды из standalone сервиса по ссылке: https://analytics.dodois.io/',
    'Примененные конфигурации: CERTIFIED BY => DONER42',
  ],
  buttons: [
    {
      txt: 'Посмотреть инструкцию по работе с дашбордами',
      link: 'https://dodopizza.info/support/articles/f8170159-480d-4f82-9564-192ced3159b9/ru',
    },
    {
      txt: 'Посмотреть все доступные дашборды',
      link: DODOPIZZA_ANALYTICS_URL,
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

export {
  IF_QUESTIONS_RU,
  RULES_RU,
  RULES_DRINKIT_RU,
  RULES_DONER42_RU,
  GLOBAL_WARNING_DEFAULT_HEADER,
  GLOBAL_WARNING_DEFAULT_BODY,
  LIMIT_WARNING_HEADER,
  LIMIT_WARNING_BODY,
  UNAVAILABLE,
  CSV_TEMP_PROBLEM_RU,
};
