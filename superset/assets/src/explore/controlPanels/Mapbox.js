import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['all_columns_x', 'all_columns_y'],
        ['clustering_radius'],
        ['row_limit'],
        ['adhoc_filters'],
        ['groupby'],
      ],
    },
    {
      label: t('Points'),
      controlSetRows: [
        ['point_radius'],
        ['point_radius_unit'],
      ],
    },
    {
      label: t('Labelling'),
      controlSetRows: [
        ['mapbox_label'],
        ['pandas_aggfunc'],
      ],
    },
    {
      label: t('Visual Tweaks'),
      controlSetRows: [
        ['render_while_dragging'],
        ['mapbox_style'],
        ['global_opacity'],
        ['mapbox_color'],
      ],
    },
    {
      label: t('Viewport'),
      expanded: true,
      controlSetRows: [
        ['viewport_longitude', 'viewport_latitude'],
        ['viewport_zoom', null],
      ],
    },
  ],
  controlOverrides: {
    all_columns_x: {
      label: t('Longitude'),
      description: t('Column containing longitude data'),
    },
    all_columns_y: {
      label: t('Latitude'),
      description: t('Column containing latitude data'),
    },
    pandas_aggfunc: {
      label: t('Cluster label aggregator'),
      description: t('Aggregate function applied to the list of points ' +
        'in each cluster to produce the cluster label.'),
    },
    rich_tooltip: {
      label: t('Tooltip'),
      description: t('Show a tooltip when hovering over points and clusters ' +
        'describing the label'),
    },
    groupby: {
      description: t('One or many controls to group by. If grouping, latitude ' +
        'and longitude columns must be present.'),
    },
  },
};
