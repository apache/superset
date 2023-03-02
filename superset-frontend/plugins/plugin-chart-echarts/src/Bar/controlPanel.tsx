// DODO added
import React from 'react';
import { t, validateNonEmpty } from '@superset-ui/core';
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metrics'],
        ['adhoc_filters'],
        ['groupby'],
        ['columns'],
        ['row_limit'],
        ['timeseries_limit_metric'],
        [
          {
            name: 'order_desc',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Descending'),
              default: true,
              description: t('Whether to sort descending or ascending'),
            },
          },
        ],
        [
          {
            name: 'contribution',
            config: {
              type: 'CheckboxControl',
              label: t('Contribution'),
              default: false,
              description: t('Compute the contribution to the total'),
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        [
          {
            name: 'showValuesTotal',
            config: {
              type: 'CheckboxControl',
              label: t('Show values total'),
              renderTrigger: true,
              // TODO: move to a variable
              default: false,
              description: t('Show total value for the chart without hovering'),
            },
          },
        ],
        [
          {
            name: 'showValuesSeparately',
            config: {
              type: 'CheckboxControl',
              label: t('Show values separately'),
              renderTrigger: true,
              // TODO: move to a variable
              default: false,
              description: t('Show values for the chart without hovering'),
            },
          },
        ],
        [
          {
            name: 'stack',
            config: {
              type: 'CheckboxControl',
              label: t('Stack series'),
              renderTrigger: true,
              // TODO: move to a variable
              default: false,
              description: t('Stack series on top of each other'),
            },
          },
        ],
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Legend'),
              renderTrigger: true,
              // TODO: move to a variable
              default: false,
              description: t('Whether to display a legend for the chart'),
            },
          },
        ],
        [
          {
            name: 'order_bars',
            config: {
              type: 'CheckboxControl',
              label: t('Sort Bars'),
              default: false,
              renderTrigger: true,
              description: t('Sort bars by x labels.'),
            },
          },
        ],
        ['y_axis_format'],
        [<h1 className="section-header">{t('Show zoom controls')}</h1>],
        [
          {
            name: 'zoomableY',
            config: {
              type: 'CheckboxControl',
              label: t('Data Zoom Y'),
              default: false,
              renderTrigger: true,
              description: t('Enable data zooming controls (Y)'),
            },
          },
        ],
        [
          {
            name: 'zoomableX',
            config: {
              type: 'CheckboxControl',
              label: t('Data Zoom X'),
              default: false,
              renderTrigger: true,
              description: t('Enable data zooming controls (X)'),
            },
          },
        ],
      ],
    },
    // {
    //   label: t('X Axis'),
    //   expanded: true,
    //   // controlSetRows: [[xAxisLabel], [bottomMargin], [xTicksLayout], [reduceXTicks]],
    //   controlSetRows: [],
    // },
  ],
  controlOverrides: {
    groupby: {
      label: t('Series'),
      validators: [validateNonEmpty],
    },
    columns: {
      label: t('Breakdowns'),
      description: t('Defines how each series is broken down'),
    },
  },
};

export default config;
