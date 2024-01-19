import { IF_QUESTIONS_RU } from './messages';

const RELEASE_IS_STABLE = 'Релиз стабилен';
const RELEASE_IN_TESTING = 'Релиз тестируется';

const DONE_EMOJI = '✅';
const TESTING_EMOJI = '🧪';
const IN_PROGRESS_EMOJI = '⏳';
const NOT_DONE_EMOJI = '❌';
const EXTRA_EMOJI = '🔥';

console.groupCollapsed('Changelog messages');
console.log('RELEASE_IS_STABLE', RELEASE_IS_STABLE);
console.log('RELEASE_IN_TESTING', RELEASE_IN_TESTING);
console.log('DONE_EMOJI', DONE_EMOJI);
console.log('TESTING_EMOJI', TESTING_EMOJI);
console.log('IN_PROGRESS_EMOJI', IN_PROGRESS_EMOJI);
console.log('NOT_DONE_EMOJI', NOT_DONE_EMOJI);
console.log('EXTRA_EMOJI', EXTRA_EMOJI);
console.groupEnd();

const UPGRADE_2_0_RU = {
  title: 'Успешный переход на версию Superset 2.0',
  date: '17.03.2023',
  subTitle: RELEASE_IS_STABLE,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы в версии 2.0',
  releases: [
    {
      date: `${DONE_EMOJI} 17.03.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Исправлены проблемы с отображением кириллицы при экспорте графиков в CSV формате',
        'Улучшена общая стилистика (plugin | standalone)',
        'Улучшена работа с нативными фильтрами (plugin | standalone)',
        'Изменены названия CSV файлов при экспорте (plugin | standalone)',
        'Убрано ограничение DODOIS_FRIENDLY (plugin | standalone)',
        'Увеличено поле ввода SQL в модалке редакатирования датасета',
      ],
    },
  ],
  listTitleExtra: 'Возможные проблемы в версии 2.0',
  messagesExtra: [
    'Возможные проблемы с d3 форматированием',
    'Возможные проблемы с отображением некоторых графиков',
  ],
};

const NEW_FEATURES_APRIL_2023_RU = {
  title: 'Обновления [Апрель 2023]',
  date: '11.04.2023',
  subTitle: RELEASE_IS_STABLE,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы',
  releases: [
    {
      date: `${DONE_EMOJI} 11.04.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Для того, чтобы дашборд появился в DODOIS (Аналитика (Бета)) необходимо указать CERTIFIED BY и CERTIFICATION DETAILS в Superset Standalone',
        'Добавлен Change Log фич и фиксов',
        'Включена поддержка Cross-filters (standalone, plugin)',
        'Включена поддержка Filter-sets (standalone)',
        'Включен тип визуализации MapBox',
      ],
    },
  ],
  listTitleExtra: 'Возможные проблемы',
  messagesExtra: [
    'Если вашего дашборда нет в списке дашбордов, проверьте правильность заполнения CERTIFIED BY и CERTIFICATION DETAILS',
    'Пример верного формата: CERTIFIED BY -> DODOPIZZA, CERTIFICATION DETAILS -> OfficeManager/Analytics',
  ],
};

const NEW_FEATURES_MAY_2023_RU = {
  title: 'Обновления [Май 2023]',
  date: '03.05.2023',
  subTitle: RELEASE_IS_STABLE,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы',
  releases: [
    {
      date: `${DONE_EMOJI} 03.05.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Добавили правила по работе с полями CERTIFIED BY и CERTIFICATION DETAILS в Superset Standalone, в модальном окне изменения дашборда',
        'Зарелизили в Дринкит Superset Dashboard plugin',
        'Реализовали возможность управления списком дашбордов из Superset: дринкит пицца и донер 42 теперь могут управлять, какие дашборды им показать во вкладке Аналитика',
        'Добавлена кнопка и модальное окно Changelog в Superset Standalone',
        'Добавлена кнопка Show/Hide values во всех графиках Time-series для пользовательского управления показа значений на графике',
        'Добавили цветовую индикацию, если метрика растет или падает в Big Number with Trendline',
        'Исправили проблемы с фильтрами периода',
        'Добавили разные стилизованные Welcome Screens для бизнесов',
      ],
    },
  ],
  listTitleExtra: 'Что планируем брать в работу?',
  messagesExtra: [
    `${DONE_EMOJI} Доработкой функциональности для Changelog (удобное отображение нового обновления)`,
    `${DONE_EMOJI} Начинаем груммить введение инструмента для организации списка дашбордов и списка графиков в Standalone Superset`,
    `${DONE_EMOJI} Обрабатываем разделение по бизнесам в Superset Dashboard Plugin (визуальное, функциональное)`,
  ],
};

const NEW_FEATURES_JUNE_2023_RU = {
  title: 'Обновления [Июнь 2023]',
  date: '30.06.2023',
  subTitle: RELEASE_IS_STABLE,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы',
  releases: [
    {
      date: `${DONE_EMOJI} 30.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        `${EXTRA_EMOJI} Добавили 2 вида форматирования: "С пробелом" и "С пробелом округл."`,
        'Обновили недостающие переводы в разных частях системы',
      ],
    },
    {
      date: `${DONE_EMOJI} 29.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        '80% Доделали переводы на русский язык в плагине во Вкладке Аналитика в DODOIS',
        'Исправили переводы на русский язык в Standalone на меню в графике',
      ],
    },
    {
      date: `${DONE_EMOJI} 28.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        `${EXTRA_EMOJI} На странице списка графиков добавили информационную подсказку, в каких дашбордах используется данный график`,
      ],
    },
    {
      date: `${DONE_EMOJI} 27.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        `Добавили форматирование чисел через пробел`,
        `${EXTRA_EMOJI} На странице редактирования графика добавили информационную подсказку, в каких дашбордах используется данный график`,
      ],
    },
    {
      date: `${DONE_EMOJI} 22.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Добавили переводы на русский язык в разных частях системы',
        'Улучшили вид Changelog',
        'Начали перевод Superset Dashboard Plugin в DODOIS на русский язык',
      ],
    },
    {
      date: `${DONE_EMOJI} 16.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        `${EXTRA_EMOJI} Добавили возможность показывать алерты на главной странице в плагине Superset в DODOIS`,
        'Добавили возможность создавать алерты в Standalone',
      ],
    },
    {
      date: `${DONE_EMOJI} 12.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Добавили переводы для Русского языка при выборке фильтров в Дашборде',
        'Добавили переводы для Русского языка в настройке фильтров Дашборда',
        'Добавили новые валюты в форматирование чисел: Bulgarian lev, UAE Dirham',
        'Добавили пользовательское сообщение о том, что вход в суперсет невозможен без email',
        'Добавили новые валюты в форматирование чисел: Naira, Romanian Leu, Somoni, Dong, Serbian Dinar, Armenian Dram, Lari, Rupiah, Azerbaijan Manat',
        'Исправили разные проблемы пользователей в разных типах графиков',
      ],
    },
    {
      date: `${DONE_EMOJI} 02.06.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Обновили логотип в Superset standalone',
        'Изменили форматирование десятичных (вместо точек - запятые)',
        'Изменили форматирование чисел (вместо запятых - пробелы)',
        'Добавили новые валюты в форматирование чисел: Euro, Zloty, Som, Uzbekistan Sum',
      ],
    },
  ],
  listTitleExtra: 'Что планируем брать в работу?',
  messagesExtra: [
    `${DONE_EMOJI} Добавить все необходимые валюты в форматирование`,
    `${DONE_EMOJI} Улучшить и локализовать форматирование чисел`,
    `${DONE_EMOJI} Форматирование чисел через пробел без округления`,
    `${DONE_EMOJI} Форматирование чисел через пробел с округлением ${EXTRA_EMOJI}`,
    `${DONE_EMOJI} Использовать локализацию из DODOIS во вкладке Аналитика ${EXTRA_EMOJI}`,
    `${NOT_DONE_EMOJI} Доработать Pivot Table v2: возможность сортировки столбцов`,
    `${DONE_EMOJI} Упростить выбор дат в фильтрах`,
    `${DONE_EMOJI} Переименовать "Аналитика (Бета)" в "Аналитика"`,
    `${DONE_EMOJI} Перевести на русский язык фильтрацию по датам`,
    `${DONE_EMOJI} Улучшить переводы на русский язык по всему Superset`,
    `${DONE_EMOJI} Показать, в каких дашбордах используется определенный график`,
    `${DONE_EMOJI} Улучшить уведомление пользователей о важных событиях в Superset Standalone и Superset dashboard plugin ${EXTRA_EMOJI}`,
  ],
};

const NEW_FEATURES_JULY_2023_RU = {
  title: 'Обновления [Июль 2023]',
  date: '06.07.2023',
  subTitle: RELEASE_IS_STABLE,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы',
  releases: [
    {
      date: `${TESTING_EMOJI} 06.07.2023`,
      status: RELEASE_IS_STABLE,
      messages: [
        'Добавить условное форматирование без градиента в Table и Pivot Table V2',
        'Обновили недостающие переводы в разных частях системы',
      ],
    },
  ],
  listTitleExtra: 'Что планируем брать в работу?',
  messagesExtra: [
    `${DONE_EMOJI} Добавить условное форматирование без градиента в Table и Pivot Table V2`,
    `${IN_PROGRESS_EMOJI} Расширить палитру цветового условного форматирования`,
    `${IN_PROGRESS_EMOJI}Добавить экспорт таблицы в xls`,
    'Добавить фильтр в таблице "где используется этот чарт"',
    `${IN_PROGRESS_EMOJI} Big Number: Цветовая индикация в зависимости от попадания значения в цель`,
    'Убрать ненужное в фильтре времени',
    'Грумминг папок с дашборадами в Superset',
  ],
};

const NEW_FEATURES_AUGUST_2023_RU = {
  title: 'Обновления [Август 2023]',
  date: '17.08.2023',
  subTitle: RELEASE_IN_TESTING,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы',
  releases: [
    {
      date: `${TESTING_EMOJI} 17.08.2023`,
      status: RELEASE_IN_TESTING,
      messages: [
        'Добавить экспорт таблицы в xls',
        'Обновили экспорт таблицы в csv',
        'Исправили ошибки при экспорте Mixed Time series в csv',
        'Расширили палитру цветового условного форматирования Big Number, Big Number With Trendline',
        'Big Number: Цветовая индикация в зависимости от попадания значения в цель (Conditional Formatting)',
      ],
    },
  ],
  listTitleExtra: 'Что планируем брать в работу?',
  messagesExtra: [
    `${IN_PROGRESS_EMOJI} Грумминг папок с дашборадами в Superset`,
    `${IN_PROGRESS_EMOJI}Добавить фильтр в таблице "где используется этот чарт"`,
    `${DONE_EMOJI} Добавить условное форматирование без градиента в Table и Pivot Table V2`,
    `${DONE_EMOJI} Расширить палитру цветового условного форматирования`,
    `${DONE_EMOJI}Добавить экспорт таблицы в xls`,
    `${DONE_EMOJI} Big Number: Цветовая индикация в зависимости от попадания значения в цель`,
    `${DONE_EMOJI} Убрать ненужное в фильтре времени`,
  ],
};

const NEW_FEATURES_NOVEMBER_2023_RU = {
  title: 'Обновления [Ноябрь 2023]',
  date: '30.11.2023',
  subTitle: RELEASE_IN_TESTING,
  extra: IF_QUESTIONS_RU,
  listTitle: 'Новая функциональность / исправлены проблемы',
  releases: [
    {
      date: `${TESTING_EMOJI} 30.11.2023`,
      status: RELEASE_IN_TESTING,
      messages: [
        'Сделать возможность называть метрики в датасете на двух языках (англ., рус.)',
        'Сделать возможность называть кастомные метрики на двух языках (англ., рус.)',
        'Сделать возможность называть дашборд на двух языках (англ., рус.)',
        'Сделать возможность называть график на двух языках (англ., рус.)',
        'Сделать возможность называть табы в графике на двух языках (англ., рус.)',
        'Увеличить лимит при создании / изменении дашбордов',
        'В выгрузке xlsx/csv выгружать названия колонок исходя из языка интерфейса',
      ],
    },
  ],
  listTitleExtra: 'Что планируем брать в работу?',
  messagesExtra: [`${IN_PROGRESS_EMOJI} Переезд на версию Superset 3.0`],
};

export {
  UPGRADE_2_0_RU,
  NEW_FEATURES_APRIL_2023_RU,
  NEW_FEATURES_MAY_2023_RU,
  NEW_FEATURES_JUNE_2023_RU,
  NEW_FEATURES_JULY_2023_RU,
  NEW_FEATURES_AUGUST_2023_RU,
  NEW_FEATURES_NOVEMBER_2023_RU,
};
