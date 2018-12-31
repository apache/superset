import { t } from '@superset-ui/translation';

export default {
  label: t('Leaflet Map'),
  showOnExplore: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['geojson'],
        ['polygon'],
        ['adhoc_columns'],
        ['rich_tooltip'],
        ['all_columns_x'],
        ['all_columns_y'],
        ['latitude'],
        ['adhoc_filters'],
        ['row_limit', 'include_time'],
      ],
    },
    {
      label: t('Polygon/Marker'),
      expanded: true,
      controlSetRows: [
        ['stroke_color_picker'],
        ['cell_size']

      ],
    },
    {
      label: t('Map Options'),
      expanded: true,
      controlSetRows: [
        ['viewport_longitude', 'viewport_latitude'],
        ['viewport_zoom', 'mapbox_style'],
        ['min_radius','max_radius'],
        ['chart_interactivity'],
        ['labels_outside'],
        ['ranges'],
      ],
    },
  ],
  controlOverrides: {
    labels_outside:{
      label: t('Use Esri Leaflet'),
      default: false,
      renderTrigger: false,
      description: t('Use Esri Leaflet Library to render tiles for ArcGIS Server'),
    },
    rich_tooltip:{
      label: t('Show tooltip'),
      renderTrigger: false,
      default: true,
      description: t('Enable or Disable tooltip  on mouse hover on Map,Configure Tooltip Columns'),
    },
    chart_interactivity:{
      label: t('Enable click'),
      renderTrigger: false,
      default: true,
      description: t('Enable or Disable map click event'),
    },
    all_columns_x:{
      label: 'Tooltip Columns',
      multi: true,
      default:[],
      description: t('Tooltip Data Columns'),
    },
    all_columns_y:{
      label: 'Direction',
      multi: false,
      default: null,
      description: t('Direction'),
    },
    latitude:{
      label: 'Marker Value Field',
      multi: false,
      default: null,
      validators: [],
      description: t('Marker Value Field used for display information in markers as a text'),
    },
    cell_size:{
      default: .75,
      validators: [],
      isInt: false,
      renderTrigger: false,
      label: t('Fill Opacity'),
      description: t('The Polygon fill color Opacity 0-1'),
    },
    stroke_color_picker:{
      label: t('Border Color'),
      description: t('Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
      renderTrigger: false,
    },
    geojson:{
      label: t('Id Column'),
      description: t('Id column for GeoJson Column'),
    },
    polygon:{
      label: t('GeoJson Column '),
    },
    mapbox_style:{
      renderTrigger: false,
      label: t('Map Layer'),
      choices: [
        ['Point', 'Marker'],
        ['Polygon','Polygon'],
        ['Polygon-Convex', 'Polygon Convex'],
        ['Polygon-Concave', 'Polygon Concave'],
      ],
      default: 'Polygon',
      description: t('Map Layer style'),
    },
    viewport_longitude:{
      default: 72.83333,
      isFloat: false,
    },
    viewport_latitude:{
      default: 18.96667,
      isFloat: false,
    },
    viewport_zoom:{
      label: t('Default Zoom Level'),
      description: t('Default Zoom Level'),
      default: 12,
      isInt: true,
    },
    min_radius:{
      label: t('Minimum Zoom Level'),
      description: t('Minimum Zoom Level'),
      renderTrigger: false,
      isInt: true,
      default: 8,
    },
    max_radius:{
      label: t('Maximum Zoom Level'),
      description: t('Maximum Zoom Level'),
      renderTrigger: false,
      default: 18,
      isInt: true,
    },
    ranges:{
      label: t('Map Server URL'),
      description: t('Map Server URL'),
      renderTrigger: false,
      default: 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
    },
    row_limit:{
      default: 50,
    }

  },
};