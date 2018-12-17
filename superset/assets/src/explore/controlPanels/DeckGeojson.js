import { t } from '@superset-ui/translation';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['geojson', null],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        // TODO ['autozoom', null],
      ],
    },
    {
      label: t('GeoJson Settings'),
      controlSetRows: [
        ['fill_color_picker', 'stroke_color_picker'],
        ['filled', 'stroked'],
        ['extruded', null],
        ['point_radius_scale', null],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        ['js_columns'],
        ['js_data_mutator'],
        ['js_tooltip'],
        ['js_onclick_href'],
      ],
    },
  ],
};
