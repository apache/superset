// DODO was here
import { formatSelectOptions } from '@superset-ui/chart-controls';
import { addLocaleData, GenericDataType, t } from '@superset-ui/core';
import i18n from './i18n';

addLocaleData(i18n);

export const PAGE_SIZE_OPTIONS = formatSelectOptions<number>([
  [0, t('page_size.all')],
  10,
  20,
  50,
  100,
  200,
]);

// DODO added 45525377
export const TABLE_CONFIG_FORM_LAYOUT = {
  [GenericDataType.String]: [
    [
      'columnWidth',
      { name: 'horizontalAlign', override: { defaultValue: 'left' } },
    ],
    ['truncateLongCells'],
    ['pinColumn'],
  ],
  [GenericDataType.Numeric]: [
    {
      tab: t('Display'),
      children: [
        [
          'columnWidth',
          { name: 'horizontalAlign', override: { defaultValue: 'right' } },
        ],
        ['showCellBars'],
        ['alignPositiveNegative'],
        ['colorPositiveNegative'],
        ['pinColumn'],
      ],
    },
    {
      tab: t('Number formatting'),
      children: [
        ['d3NumberFormat'],
        ['d3SmallNumberFormat'],
        ['currencyFormat'],
      ],
    },
  ],
  [GenericDataType.Temporal]: [
    [
      'columnWidth',
      { name: 'horizontalAlign', override: { defaultValue: 'left' } },
    ],
    ['d3TimeFormat'],
    ['pinColumn'],
  ],
  [GenericDataType.Boolean]: [
    [
      'columnWidth',
      { name: 'horizontalAlign', override: { defaultValue: 'left' } },
    ],
    ['pinColumn'],
  ],
};
