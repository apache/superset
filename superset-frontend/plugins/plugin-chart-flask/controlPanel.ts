import { t, validateNonEmpty } from '@superset-ui/core';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['groupby'],
        ['adhoc_filters'],
        ['limit'],
      ],
    },
    {
      label: 'Propriedades',
      controlSetRows: [
        [
          {
            name: 'chart_type',
            config: {
              type: 'SelectControl',
              label: 'Tipo de gráfico',
              default: 'pie',
              choices: [
                ['pie', 'Pie'],
                ['state_map', 'State Map'],
                ['scatter_map', 'Scatter Map'],
              ],
            },
          },
        ],
        [
          {
            name: 'theme',
            config: {
              type: 'SelectControl',
              label: 'Modo',
              default: 'claro',
              choices: [
                ['', 'Padrão'],
                ['dark', 'Escuro'],
              ],
            },
          },
        ],
        [
          {
            name: 'theme_palette',
            config: {
              type: 'TextControl',
              label: 'Paleta de cores',
              default: '',
            },
          },
        ],
        [
          {
            name: 'props_list',
            config: {
              type: 'TextControl',
              label: 'Propriedades',
              default: '',
            },
          },
        ],
      ],
    },
  ],
};
