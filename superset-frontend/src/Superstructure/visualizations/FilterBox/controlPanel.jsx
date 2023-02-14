// DODO-changed
import React from 'react';
import { t } from '@superset-ui/core';
import { sections } from '@superset-ui/chart-controls';
import { PLUGIN_SELECTOR } from 'src/Superstructure/constants';

const selector = process.env.business ? PLUGIN_SELECTOR : 'app';
const appContainer = document.getElementById(selector);
const attributes = appContainer ? appContainer.getAttribute('data-bootstrap') : '{}'

const bootstrapData = JSON.parse(attributes);
const druidIsActive = !!bootstrapData?.common?.conf?.DRUID_IS_ACTIVE;
const druidSection = druidIsActive
  ? [
    [
      {
        name: 'show_druid_time_granularity',
        config: {
          type: 'CheckboxControl',
          label: t('Show Druid granularity dropdown'),
          default: false,
          description: t('Check to include Druid granularity dropdown'),
        },
      },
    ],
    [
      {
        name: 'show_druid_time_origin',
        config: {
          type: 'CheckboxControl',
          label: t('Show Druid time origin'),
          default: false,
          description: t('Check to include time origin dropdown'),
        },
      },
    ],
  ]
  : [];

export default {
  controlPanelSections: [
    sections.legacyTimeseriesTime,
    {
      label: t('Filters configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'filter_configs',
            config: {
              type: 'CollectionControl',
              label: 'Filters',
              description: t('Filter configuration for the filter box'),
              validators: [],
              controlName: 'FilterBoxItemControl',
              mapStateToProps: ({ datasource }) => ({ datasource }),
            },
          },
        ],
        [<hr />],
        [
          {
            name: 'date_filter',
            config: {
              type: 'CheckboxControl',
              label: t('Date filter'),
              default: true,
              description: t('Whether to include a time filter'),
            },
          },
        ],
        [
          {
            name: 'instant_filtering',
            config: {
              type: 'CheckboxControl',
              label: t('Instant filtering'),
              renderTrigger: true,
              default: false,
              description: t(
                'Check to apply filters instantly as they change instead of displaying [Apply] button',
              ),
            },
          },
        ],
        [
          {
            name: 'show_sqla_time_granularity',
            config: {
              type: 'CheckboxControl',
              label: druidIsActive
                ? t('Show SQL time grain dropdown')
                : t('Show time grain dropdown'),
              default: false,
              description: druidIsActive
                ? t('Check to include SQL time grain dropdown')
                : t('Check to include time grain dropdown'),
            },
          },
        ],
        [
          {
            name: 'show_sqla_time_column',
            config: {
              type: 'CheckboxControl',
              label: druidIsActive
                ? t('Show SQL time column')
                : t('Show time column'),
              default: false,
              description: t('Check to include time column dropdown'),
            },
          },
        ],
        ...druidSection,
        ['adhoc_filters'],
      ],
    },
  ],
  controlOverrides: {
    adhoc_filters: {
      label: t('Limit selector values'),
      description: t(
        'These filters apply to the values available in the dropdowns',
      ),
    },
  },
};
