import React from 'react';
import { t } from '@superset-ui/translation';

export const druidTimeSeries = {
  label: t('Time'),
  expanded: true,
  description: t('Time related form attributes'),
  controlSetRows: [
    ['granularity', 'druid_time_origin'],
    ['time_range'],
  ],
};

export const datasourceAndVizType = {
  label: t('Datasource & Chart Type'),
  expanded: true,
  controlSetRows: [
    ['datasource'],
    ['viz_type'],
    ['slice_id', 'cache_timeout', 'url_params'],
  ],
};

export const colorScheme = {
  label: t('Color Scheme'),
  controlSetRows: [
    ['color_scheme'],
  ],
};

export const sqlaTimeSeries = {
  label: t('Time'),
  description: t('Time related form attributes'),
  expanded: true,
  controlSetRows: [
    ['granularity_sqla', 'time_grain_sqla'],
    ['time_range'],
  ],
};

export const filters = {
  label: t('Filters'),
  expanded: true,
  controlSetRows: [
    ['filters'],
  ],
};

export const annotations = {
  label: t('Annotations and Layers'),
  expanded: true,
  controlSetRows: [
    ['annotation_layers'],
  ],
};

export const NVD3TimeSeries = [
  {
    label: t('Query'),
    expanded: true,
    controlSetRows: [
      ['metrics'],
      ['adhoc_filters'],
      ['groupby'],
      ['limit', 'timeseries_limit_metric'],
      ['order_desc', 'contribution'],
      ['row_limit', null],
    ],
  },
  {
    label: t('Advanced Analytics'),
    description: t('This section contains options ' +
    'that allow for advanced analytical post processing ' +
    'of query results'),
    controlSetRows: [
      [<h1 className="section-header">{t('Moving Average')}</h1>],
      ['rolling_type', 'rolling_periods', 'min_periods'],
      [<h1 className="section-header">{t('Time Comparison')}</h1>],
      ['time_compare', 'comparison_type'],
      [<h1 className="section-header">{t('Python Functions')}</h1>],
      [<h2 className="section-header">pandas.resample</h2>],
      ['resample_how', 'resample_rule', 'resample_fillmethod'],
    ],
  },
];
