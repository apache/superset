import { getChartControlPanelRegistry } from '@superset-ui/chart';
import getControlsInventory from 'src/utils/chartControlsInventory';

const fakePluginControls = {
  controlPanelSections: [
    {
      label: 'Fake Control Panel Sections',
      expanded: true,
      controlSetRows: [
        ['url_params'],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: 'Value bounds',
              default: [null, null],
              description: 'Value bounds for the y axis',
            },
          },
        ],
        [
          {
            name: 'adhoc_filters',
            config: {
              type: 'AdhocFilterControl',
              label: 'Fake Filters',
              default: null,
            },
          },
        ],
      ],
    },
    {
      label: 'Fake Control Panel Sections 2',
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'column_collection',
            config: {
              type: 'CollectionControl',
              label: 'Fake Collection Control',
            },
          },
        ],
      ],
    },
  ],
};

describe('chartControlsInventory', () => {
  beforeEach(() => {
    getChartControlPanelRegistry().registerValue(
      'chart_controls_inventory_fake',
      fakePluginControls,
    );
  });

  it('returns a map of the controls', () => {
    expect(getControlsInventory('chart_controls_inventory_fake')).toEqual({
      url_params: {
        type: 'HiddenControl',
        label: 'URL Parameters',
        hidden: true,
        description: 'Extra parameters for use in jinja templated queries',
      },
      y_axis_bounds: {
        type: 'BoundsControl',
        label: 'Value bounds',
        default: [null, null],
        description: 'Value bounds for the y axis',
      },
      adhoc_filters: {
        type: 'AdhocFilterControl',
        label: 'Fake Filters',
        default: null,
      },
      column_collection: {
        type: 'CollectionControl',
        label: 'Fake Collection Control',
      },
    });
  });
});
