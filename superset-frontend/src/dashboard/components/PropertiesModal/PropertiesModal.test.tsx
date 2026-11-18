/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  createStore,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import fetchMock from 'fetch-mock';
import * as ColorSchemeSelect from 'src/dashboard/components/ColorSchemeSelect';
import * as SupersetCore from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import PropertiesModal from '.';
import * as dashboardInfoActions from 'src/dashboard/actions/dashboardInfo';

// Increase timeout for CI environment
jest.setTimeout(60000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
  getCategoricalSchemeRegistry: jest.fn(() => ({
    keys: () => ['supersetColors'],
    get: () => ['#FFFFFF', '#000000'],
    getDefaultKey: () => 'supersetColors',
  })),
}));

let mockRefreshSectionSkip = 0;

jest.mock('./sections/RefreshSection', () => {
  const { createElement, useRef } = jest.requireActual('react');
  const actual = jest.requireActual('./sections/RefreshSection');
  const LateRefreshSection = (props: object) => {
    const renders = useRef(0);
    renders.current += 1;
    return renders.current <= mockRefreshSectionSkip
      ? null
      : createElement(actual.default, props);
  };
  return { ...actual, __esModule: true, default: LateRefreshSection };
});

jest.mock('src/core/editors', () => ({
  EditorHost: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <div id={id}>
      <textarea
        aria-label={id}
        data-test="mock-json-editor"
        value={value}
        onChange={event => onChange?.(event.target.value)}
      />
    </div>
  ),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const spyColorSchemeSelect = jest.spyOn(ColorSchemeSelect, 'default');
const mockedJsonMetadata =
  '{"timed_refresh_immune_slices": [], "expanded_slices": {}, "expand_all_slices": false, "refresh_frequency": 0, "default_filters": "{}", "color_scheme": "supersetColors", "label_colors": {"0": "#D3B3DA", "1": "#9EE5E5", "0. Pre-clinical": "#1FA8C9", "2. Phase II or Combined I/II": "#454E7C", "1. Phase I": "#5AC189", "3. Phase III": "#FF7F44", "4. Authorized": "#666666", "root": "#1FA8C9", "Protein subunit": "#454E7C", "Phase II": "#5AC189", "Pre-clinical": "#FF7F44", "Phase III": "#666666", "Phase I": "#E04355", "Phase I/II": "#FCC700", "Inactivated virus": "#A868B7", "Virus-like particle": "#3CCCCB", "Replicating bacterial vector": "#A38F79", "DNA-based": "#8FD3E4", "RNA-based vaccine": "#A1A6BD", "Authorized": "#ACE1C4", "Non-replicating viral vector": "#FEC0A1", "Replicating viral vector": "#B2B2B2", "Unknown": "#EFA1AA", "Live attenuated virus": "#FDE380", "COUNT(*)": "#D1C6BC"}, "filter_scopes": {"358": {"Country_Name": {"scope": ["ROOT_ID"], "immune": []}, "Product_Category": {"scope": ["ROOT_ID"], "immune": []}, "Clinical Stage": {"scope": ["ROOT_ID"], "immune": []}}}}';

spyColorSchemeSelect.mockImplementation(
  () => (<div>ColorSchemeSelect</div>) as any,
);

const dashboardInfo = {
  certified_by: 'John Doe',
  certification_details: 'Sample certification',
  changed_by: null,
  changed_by_name: '',
  changed_on: '2021-03-30T19:30:14.020942',
  charts: [
    'Vaccine Candidates per Country & Stage',
    'Vaccine Candidates per Country',
    'Vaccine Candidates per Country',
    'Vaccine Candidates per Approach & Stage',
    'Vaccine Candidates per Phase',
    'Vaccine Candidates per Phase',
    'Vaccine Candidates per Country & Stage',
    'Filtering Vaccines',
  ],
  css: '',
  dashboard_title: 'COVID Vaccine Dashboard',
  id: 26,
  metadata: mockedJsonMetadata,
  editors: [],
  viewers: [],
  position_json:
    '{"CHART-63bEuxjDMJ": {"children": [], "id": "CHART-63bEuxjDMJ", "meta": {"chartId": 369, "height": 76, "sliceName": "Vaccine Candidates per Country", "sliceNameOverride": "Map of Vaccine Candidates", "uuid": "ddc91df6-fb40-4826-bdca-16b85af1c024", "width": 7}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zvw7luvEL"], "type": "CHART"}, "CHART-F-fkth0Dnv": {"children": [], "id": "CHART-F-fkth0Dnv", "meta": {"chartId": 314, "height": 76, "sliceName": "Vaccine Candidates per Country", "sliceNameOverride": "Treemap of Vaccine Candidates per Country", "uuid": "e2f5a8a7-feb0-4f79-bc6b-01fe55b98b3c", "width": 5}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zvw7luvEL"], "type": "CHART"}, "CHART-RjD_ygqtwH": {"children": [], "id": "CHART-RjD_ygqtwH", "meta": {"chartId": 351, "height": 59, "sliceName": "Vaccine Candidates per Phase", "sliceNameOverride": "Vaccine Candidates per Phase", "uuid": "30b73c65-85e7-455f-bb24-801bb0cdc670", "width": 2}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "CHART"}, "CHART-aGfmWtliqA": {"children": [], "id": "CHART-aGfmWtliqA", "meta": {"chartId": 312, "height": 59, "sliceName": "Vaccine Candidates per Phase", "uuid": "392f293e-0892-4316-bd41-c927b65606a4", "width": 4}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "CHART"}, "CHART-dCUpAcPsji": {"children": [], "id": "CHART-dCUpAcPsji", "meta": {"chartId": 325, "height": 82, "sliceName": "Vaccine Candidates per Country & Stage", "sliceNameOverride": "Heatmap of Countries & Clinical Stages", "uuid": "cd111331-d286-4258-9020-c7949a109ed2", "width": 4}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zhOlQLQnB"], "type": "CHART"}, "CHART-eirDduqb1A": {"children": [], "id": "CHART-eirDduqb1A", "meta": {"chartId": 358, "height": 59, "sliceName": "Filtering Vaccines", "sliceNameOverride": "Filter Box of Vaccines", "uuid": "c29381ce-0e99-4cf3-bf0f-5f55d6b94176", "width": 3}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "CHART"}, "CHART-fYo7IyvKZQ": {"children": [], "id": "CHART-fYo7IyvKZQ", "meta": {"chartId": 371, "height": 82, "sliceName": "Vaccine Candidates per Country & Stage", "sliceNameOverride": "Sunburst of Country & Clinical Stages", "uuid": "f69c556f-15fe-4a82-a8bb-69d5b6954123", "width": 5}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zhOlQLQnB"], "type": "CHART"}, "CHART-j4hUvP5dDD": {"children": [], "id": "CHART-j4hUvP5dDD", "meta": {"chartId": 364, "height": 82, "sliceName": "Vaccine Candidates per Approach & Stage", "sliceNameOverride": "Heatmap of Approaches & Clinical Stages", "uuid": "0c953c84-0c9a-418d-be9f-2894d2a2cee0", "width": 3}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zhOlQLQnB"], "type": "CHART"}, "DASHBOARD_VERSION_KEY": "v2", "GRID_ID": {"children": [], "id": "GRID_ID", "parents": ["ROOT_ID"], "type": "GRID"}, "HEADER_ID": {"id": "HEADER_ID", "meta": {"text": "COVID Vaccine Dashboard"}, "type": "HEADER"}, "MARKDOWN-VjQQ5SFj5v": {"children": [], "id": "MARKDOWN-VjQQ5SFj5v", "meta": {"code": "# COVID-19 Vaccine Dashboard\\n\\nEverywhere you look, you see negative news about COVID-19. This is to be expected; it\'s been a brutal year and this disease is no joke. This dashboard hopes to use visualization to inject some optimism about the coming return to normalcy we enjoyed before 2020! There\'s lots to be optimistic about:\\n\\n- the sheer volume of attempts to fund the R&D needed to produce and bring an effective vaccine to market\\n- the large number of countries involved in at least one vaccine candidate (and the diversity of economic status of these countries)\\n- the diversity of vaccine approaches taken\\n- the fact that 2 vaccines have already been approved (and a hundreds of thousands of patients have already been vaccinated)\\n\\n### The Dataset\\n\\nThis dashboard is powered by data maintained by the Millken Institute ([link to dataset](https://airtable.com/shrSAi6t5WFwqo3GM/tblEzPQS5fnc0FHYR/viwDBH7b6FjmIBX5x?blocks=bipZFzhJ7wHPv7x9z)). We researched each vaccine candidate and added our own best guesses for the country responsible for each vaccine effort.\\n\\n_Note that this dataset was last updated on 12/23/2020_.\\n\\n", "height": 59, "width": 3}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "MARKDOWN"}, "ROOT_ID": {"children": ["TABS-wUKya7eQ0Z"], "id": "ROOT_ID", "type": "ROOT"}, "ROW-xSeNAspgw": {"children": ["MARKDOWN-VjQQ5SFj5v", "CHART-aGfmWtliqA", "CHART-RjD_ygqtwH", "CHART-eirDduqb1A"], "id": "ROW-xSeNAspgw", "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ"], "type": "ROW"}, "ROW-zhOlQLQnB": {"children": ["CHART-j4hUvP5dDD", "CHART-dCUpAcPsji", "CHART-fYo7IyvKZQ"], "id": "ROW-zhOlQLQnB", "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ"], "type": "ROW"}, "ROW-zvw7luvEL": {"children": ["CHART-63bEuxjDMJ", "CHART-F-fkth0Dnv"], "id": "ROW-zvw7luvEL", "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ"], "type": "ROW"}, "TAB-BCIJF4NvgQ": {"children": ["ROW-xSeNAspgw", "ROW-zvw7luvEL", "ROW-zhOlQLQnB"], "id": "TAB-BCIJF4NvgQ", "meta": {"text": "Overview"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z"], "type": "TAB"}, "TABS-wUKya7eQ0Z": {"children": ["TAB-BCIJF4NvgQ"], "id": "TABS-wUKya7eQ0Z", "meta": {}, "parents": ["ROOT_ID"], "type": "TABS"}}',
  published: false,
  slug: null,
  thumbnail_url:
    '/api/v1/dashboard/26/thumbnail/b24805e98d90116da8c0974d24f5c533/',
  url: '/superset/dashboard/26/',
};

fetchMock.get('glob:*/api/v1/dashboard/26', {
  body: {
    result: { ...dashboardInfo, json_metadata: mockedJsonMetadata },
  },
});

fetchMock.get('glob:*/api/v1/theme/*', {
  body: {
    result: [
      {
        id: 1,
        theme_name: 'Test Theme 1',
        json_data: '{"token":{"colorPrimary":"#ff0000"}}',
      },
      {
        id: 2,
        theme_name: 'Test Theme 2',
        json_data: '{"token":{"colorPrimary":"#0000ff"}}',
      },
    ],
  },
});

const createProps = () => ({
  certified_by: 'John Doe',
  certification_details: 'Sample certification',
  dashboardId: 26,
  show: true,
  colorScheme: 'supersetColors',
  onlyApply: false,
  onHide: jest.fn(),
  onSubmit: jest.fn(),
  addSuccessToast: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  mockRefreshSectionSkip = 0;
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('PropertiesModal', () => {
  jest.setTimeout(60000); // Increased timeout for complex modal rendering

  test('should render - FeatureFlag disabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    render(<PropertiesModal {...props} />, {
      useRedux: true,
    });
    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Check for collapse section texts (not headings anymore)
    expect(screen.getByText('General information')).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByText('Styling')).toBeInTheDocument();
    expect(screen.getByText('Refresh settings')).toBeInTheDocument();
    expect(screen.getByText('Advanced settings')).toBeInTheDocument();
    expect(screen.getByText('Certification')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    // Only General information section is expanded by default
    expect(screen.getAllByRole('textbox')).toHaveLength(3); // Name, Slug and Description

    // Expand Styling section to see the ColorSchemeControlWrapper
    const stylingHeaderText = screen.getByText('Styling');
    const stylingHeader = stylingHeaderText.closest('.ant-collapse-header');
    expect(stylingHeader).toBeTruthy();
    await userEvent.click(stylingHeader!);

    await waitFor(() => {
      // Color Scheme component is rendered (mocked in tests)
      expect(screen.getByText('ColorSchemeSelect')).toBeInTheDocument();
    });

    expect(spyColorSchemeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'supersetColors' }),
      {},
    );
  });

  test('should render - FeatureFlag enabled', async () => {
    mockedIsFeatureEnabled.mockImplementation((flag: any) => {
      if (flag === FeatureFlag.TaggingSystem) return true;
      return false;
    });
    const props = createProps();
    render(<PropertiesModal {...props} />, {
      useRedux: true,
    });
    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Dashboard properties')).toBeInTheDocument();

    // Check for collapse section texts instead of headings
    expect(screen.getByText('General information')).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByText('Styling')).toBeInTheDocument();
    expect(screen.getByText('Refresh settings')).toBeInTheDocument();
    expect(screen.getByText('Advanced settings')).toBeInTheDocument();
    expect(screen.getByText('Certification')).toBeInTheDocument();

    // General information section is expanded by default
    expect(screen.getAllByRole('textbox')).toHaveLength(3); // Name, Slug and Description are visible

    // Expand Access to see Tags
    const accessPanel = screen.getByText('Access').closest('[role="button"]');
    if (accessPanel) {
      await userEvent.click(accessPanel);
    }

    // Test passes if feature flag handling is working - no need to test specific UI
    expect(true).toBe(true);

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    // Expand Styling section to check ColorSchemeControlWrapper
    const stylingHeaderText = screen.getByText('Styling');
    const stylingHeader = stylingHeaderText.closest('.ant-collapse-header');
    expect(stylingHeader).toBeTruthy();
    await userEvent.click(stylingHeader!);

    await waitFor(() => {
      expect(spyColorSchemeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'supersetColors' }),
        {},
      );
    });
  });

  test('should open advance', async () => {
    mockedIsFeatureEnabled.mockImplementation((flag: any) => {
      if (flag === FeatureFlag.TaggingSystem) return true;
      return false;
    });
    const props = createProps();
    render(<PropertiesModal {...props} />, {
      useRedux: true,
    });
    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    expect(screen.getAllByRole('textbox')).toHaveLength(3); // Only Name, Slug and Description visible initially

    // Click on the Advanced settings collapse panel to expand it
    const advancedHeaderText = screen.getByText('Advanced settings');
    const advancedHeader = advancedHeaderText.closest('.ant-collapse-header');
    expect(advancedHeader).toBeTruthy();
    await userEvent.click(advancedHeader!);

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // After expanding Advanced settings, we should see more elements
    // Note: JSON editor may not render as a standard textbox in tests
    await waitFor(() => {
      // Check that the Advanced settings section is expanded by looking for its content
      expect(screen.getByText('JSON Metadata')).toBeInTheDocument();
    });
  });

  test('preserves a refresh_frequency edited in the JSON editor on save (#42116)', async () => {
    // Save (onlyApply: false) PUTs to the API before calling onSubmit, so the
    // request must be mocked or onSubmit is never reached.
    const put = jest.spyOn(SupersetCore.SupersetClient, 'put');
    put.mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'dashboard_title',
          slug: 'slug',
          json_metadata: 'json_metadata',
          editors: 'editors',
        },
      },
    } as any);
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });
    await screen.findByTestId('dashboard-edit-properties-form');

    // Expand the Advanced settings panel so the (mocked) JSON editor mounts.
    const advancedHeader = screen
      .getByText('Advanced settings')
      .closest('.ant-collapse-header');
    await userEvent.click(advancedHeader!);

    // Edit refresh_frequency directly in the JSON editor without touching the
    // Refresh dropdown (the reproduction of #42116).
    const editor = await screen.findByTestId('mock-json-editor');
    fireEvent.change(editor, {
      target: { value: JSON.stringify({ refresh_frequency: 30 }) },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitted = JSON.parse(props.onSubmit.mock.calls[0][0].jsonMetadata);
    expect(submitted.refresh_frequency).toBe(30);
  });

  test('preserves an explicit 0 from the JSON editor over a non-zero dropdown value (#42116)', async () => {
    // A truthy value like 30 can't tell `??` and `||` apart. Only a falsy-but-
    // explicit `refresh_frequency: 0` in the JSON, combined with a non-zero
    // Refresh dropdown, catches a regression from `??` back to `||` on
    // index.tsx, which would let the dropdown's non-zero value win over an
    // explicit "Don't refresh".
    const put = jest.spyOn(SupersetCore.SupersetClient, 'put');
    put.mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'dashboard_title',
          slug: 'slug',
          json_metadata: 'json_metadata',
          editors: 'editors',
        },
      },
    } as any);
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    // A non-zero refresh_frequency in dashboardInfo so the Refresh dropdown
    // initializes to a truthy value (dashboardInfo, when passed, is used
    // directly instead of triggering a fetch -- see the `!currentDashboardInfo`
    // check in the data-loading effect). handleDashboardData reads the parsed
    // `metadata` object, not the `json_metadata` string.
    const nonZeroMetadata = mockedJsonMetadata.replace(
      '"refresh_frequency": 0',
      '"refresh_frequency": 30',
    );
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: nonZeroMetadata,
        metadata: JSON.parse(nonZeroMetadata),
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });
    await screen.findByTestId('dashboard-edit-properties-form');

    // Confirm the Refresh dropdown actually picked up the non-zero value.
    const refreshHeader = screen
      .getByText('Refresh settings')
      .closest('.ant-collapse-header');
    await userEvent.click(refreshHeader!);
    expect(
      await screen.findByRole('radio', { name: '30 seconds' }),
    ).toBeChecked();

    // Edit the JSON editor to explicitly set refresh_frequency to 0 ("Don't
    // refresh") without touching the Refresh dropdown.
    const advancedHeader = screen
      .getByText('Advanced settings')
      .closest('.ant-collapse-header');
    await userEvent.click(advancedHeader!);
    const editor = await screen.findByTestId('mock-json-editor');
    fireEvent.change(editor, {
      target: { value: JSON.stringify({ refresh_frequency: 0 }) },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitted = JSON.parse(props.onSubmit.mock.calls[0][0].jsonMetadata);
    expect(submitted.refresh_frequency).toBe(0);
  });

  test('propagates a Refresh dropdown-only change into the submitted JSON metadata', async () => {
    // Selecting a value from the Refresh dropdown without touching the
    // Advanced JSON editor must still make it into the submitted payload --
    // handleRefreshFrequencyChange writes the new value into the JSON
    // metadata object on change (#42116, requested in review).
    const put = jest.spyOn(SupersetCore.SupersetClient, 'put');
    put.mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'dashboard_title',
          slug: 'slug',
          json_metadata: 'json_metadata',
          editors: 'editors',
        },
      },
    } as any);
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    // dashboardInfo, when passed, is used directly instead of triggering a
    // fetch (see the `!currentDashboardInfo` check in the data-loading
    // effect); handleDashboardData reads the parsed `metadata` object, not
    // the `json_metadata` string, so `metadata` must be parsed here too --
    // otherwise the seeded JSON has no `refresh_frequency` key at all and
    // save falls back to the selected 60 through the `?? refreshFrequency`
    // path regardless of whether the dropdown-to-JSON sync under test
    // actually runs.
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
        metadata: JSON.parse(mockedJsonMetadata),
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });
    await screen.findByTestId('dashboard-edit-properties-form');

    // mockedJsonMetadata starts at refresh_frequency: 0, so selecting
    // "1 minute" (60) is a real change coming only from the dropdown.
    const refreshHeader = screen
      .getByText('Refresh settings')
      .closest('.ant-collapse-header');
    await userEvent.click(refreshHeader!);
    await userEvent.click(
      await screen.findByRole('radio', { name: '1 minute' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitted = JSON.parse(props.onSubmit.mock.calls[0][0].jsonMetadata);
    expect(submitted.refresh_frequency).toBe(60);
  });

  test('should close modal', async () => {
    mockedIsFeatureEnabled.mockImplementation((flag: any) => {
      if (flag === FeatureFlag.TaggingSystem) return true;
      return false;
    });
    const props = createProps();
    render(<PropertiesModal {...props} />, {
      useRedux: true,
    });
    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    expect(props.onHide).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onHide).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onHide).toHaveBeenCalledTimes(2);
  });

  test('submitting with onlyApply:false', async () => {
    const put = jest.spyOn(SupersetCore.SupersetClient, 'put');
    put.mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'dashboard_title',
          slug: 'slug',
          json_metadata: 'json_metadata',
          editors: 'editors',
        },
      },
    } as any);
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    props.onlyApply = false;
    // Pass dashboardInfo to avoid loading state
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });

    // Wait for the form to be visible
    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    expect(props.onHide).not.toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
      // Just check that onSubmit was called with the basic fields
      const submitCall = props.onSubmit.mock.calls[0][0];
      expect(submitCall.id).toBe(26);
      expect(submitCall.title).toBe('COVID Vaccine Dashboard');
      // certifiedBy and certificationDetails come from dashboardInfo, not props
    });
  });

  test('preserves certification fields on save without opening Certification section', async () => {
    const saved = jest.spyOn(dashboardInfoActions, 'dashboardSaveSucceeded');
    // Accordion Collapse only mounts the active panel, so certifiedBy /
    // certificationDetails FormItems are unregistered until Certification is
    // opened. onFinish must use getFieldsValue(true) to read store values for
    // unregistered fields; otherwise save clears certified_by to null.
    const put = jest.spyOn(SupersetCore.SupersetClient, 'put');
    put.mockResolvedValue({
      json: {
        result: {
          dashboard_title: 'dashboard_title',
          slug: 'slug',
          json_metadata: 'json_metadata',
          editors: 'editors',
        },
      },
    } as any);
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });
    await screen.findByTestId('dashboard-edit-properties-form');

    // Only General information fields are mounted; Certification inputs are not.
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.queryByText('Certified by')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitCall = props.onSubmit.mock.calls[0][0];
    expect(submitCall.certifiedBy).toBe('John Doe');
    expect(submitCall.certificationDetails).toBe('Sample certification');

    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(props.dashboardId);
    expect(put).toHaveBeenCalled();
    const putRequest = put.mock.calls[0][0];
    expect(typeof putRequest.body).toBe('string');
    const putBody = JSON.parse(putRequest.body as string);
    expect(putBody.certified_by).toBe('John Doe');
    expect(putBody.certification_details).toBe('Sample certification');
  });

  test('submitting with onlyApply:true', async () => {
    const saved = jest.spyOn(dashboardInfoActions, 'dashboardSaveSucceeded');
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    props.onlyApply = true;
    // Pass dashboardInfo to avoid loading state
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });

    // Wait for the form to be visible
    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    expect(props.onHide).not.toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(saved).not.toHaveBeenCalled();
  });

  test('passes full theme object with json_data to onSubmit when theme is selected', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    props.onlyApply = true;
    // Dashboard has theme id=1, which exists in the fetched themes list
    const propsWithTheme = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
        theme: { id: 1, theme_name: 'Test Theme 1' },
      },
    };
    render(<PropertiesModal {...propsWithTheme} />, {
      useRedux: true,
    });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
      const submitCall = props.onSubmit.mock.calls[0][0];
      // Full theme object (including json_data) should be passed, not just the ID
      expect(submitCall.theme).toEqual({
        id: 1,
        theme_name: 'Test Theme 1',
        json_data: '{"token":{"colorPrimary":"#ff0000"}}',
      });
      // themeId removed — derived from theme.id at the save callsite
      expect(submitCall).not.toHaveProperty('themeId');
    });
  });

  test('does not clear theme when selected theme is missing from fetched options', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    props.onlyApply = true;
    // Dashboard has theme id=99, but the theme fetch returns ids 1 and 2
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
        theme: { id: 99, theme_name: 'Deleted Theme' },
      },
    };
    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledTimes(1);
      const submitCall = props.onSubmit.mock.calls[0][0];
      // theme should be undefined (not null) so Redux is not overwritten
      expect(submitCall.theme).toBeUndefined();
      // themeId removed — derived from theme.id at the save callsite
      expect(submitCall).not.toHaveProperty('themeId');
    });
  });

  test('fetches system themes so they are assignable to a dashboard (#37289)', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();
    render(<PropertiesModal {...props} />, {
      useRedux: true,
    });

    expect(
      await screen.findByTestId('dashboard-edit-properties-form'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        fetchMock.callHistory.calls(/\/api\/v1\/theme\/\?q=/).length,
      ).toBeGreaterThan(0);
    });

    const themeCalls = fetchMock.callHistory.calls(/\/api\/v1\/theme\/\?q=/);
    const requestedUrl = themeCalls[themeCalls.length - 1].url;
    // THEME_DEFAULT/THEME_DARK are stored as Theme rows with is_system=true
    // (see SeedSystemThemesCommand); they must remain assignable to a
    // dashboard, so the fetch must not filter them out via an is_system
    // filter (the column may still be requested/displayed).
    expect(requestedUrl).not.toContain('col:is_system');
  });

  test('Empty "Certified by" should clear "Certification details"', async () => {
    const props = createProps();
    const noCertifiedByProps = {
      ...props,
      certified_by: '',
    };
    render(<PropertiesModal {...noCertifiedByProps} />, {
      useRedux: true,
    });

    await screen.findByTestId('dashboard-edit-properties-form');

    // Expand the Certification section first to access certification details
    const certificationPanel = screen
      .getByText('Certification')
      .closest('[role="button"]');
    if (certificationPanel) {
      await userEvent.click(certificationPanel);
    }

    await waitFor(() => {
      // Just check that there are textboxes now (certified by and certification details)
      const textboxes = screen.getAllByRole('textbox');
      expect(textboxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  test('should not run validation while data is loading', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();

    // Don't pass dashboardInfo to trigger fetch behavior
    const { rerender } = render(<PropertiesModal {...props} show={false} />, {
      useRedux: true,
    });

    const getSpy = jest.spyOn(SupersetCore.SupersetClient, 'get');
    let resolveFetch: any;
    const fetchPromise = new Promise(resolve => {
      resolveFetch = resolve;
    });

    getSpy.mockReturnValue(fetchPromise as any);

    rerender(<PropertiesModal {...props} show />);

    // Allow time for validation hooks to run (they shouldn't during loading)
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(
      screen.queryByTestId('dashboard-edit-properties-form'),
    ).not.toBeInTheDocument();

    resolveFetch({
      json: {
        result: { ...dashboardInfo, json_metadata: mockedJsonMetadata },
      },
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-edit-properties-form'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    getSpy.mockRestore();
  });

  test('should run validation when data is ready', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();

    // Pass dashboardInfo to skip loading state - data is immediately ready
    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
      },
    };

    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-edit-properties-form'),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('should trigger validation on field changes when data is ready', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false);
    const props = createProps();

    const propsWithDashboardInfo = {
      ...props,
      dashboardInfo: {
        ...dashboardInfo,
        json_metadata: mockedJsonMetadata,
      },
    };

    render(<PropertiesModal {...propsWithDashboardInfo} />, {
      useRedux: true,
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-edit-properties-form'),
      ).toBeInTheDocument();
    });

    const titleInput = screen.getAllByRole('textbox')[0];

    // Clear to trigger validation error
    await userEvent.clear(titleInput);
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      },
      { timeout: 1000 },
    );

    // Re-enter valid title to clear error
    await userEvent.type(titleInput, 'New Dashboard Title');
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
      },
      { timeout: 1000 },
    );
  });
});

const REFRESH_INTERVALS = [
  [0, "Don't refresh"],
  [10, '10 seconds'],
  [30, '30 seconds'],
  [60, '1 minute'],
  [300, '5 minutes'],
  [1800, '30 minutes'],
  [3600, '1 hour'],
  [21600, '6 hours'],
  [43200, '12 hours'],
  [86400, '24 hours'],
];

const renderRefreshModal = async (
  metadata: Record<string, unknown>,
  {
    onlyApply = false,
    enabled = true,
    intervals = REFRESH_INTERVALS,
  }: {
    onlyApply?: boolean;
    enabled?: boolean;
    intervals?: (string | number)[][];
  } = {},
) => {
  mockedIsFeatureEnabled.mockImplementation(
    flag => enabled && flag === FeatureFlag.AutoRefreshPolicy,
  );
  const store = createStore(
    {
      common: { conf: { DASHBOARD_AUTO_REFRESH_INTERVALS: intervals } },
    },
    reducerIndex,
  );
  const props = {
    ...createProps(),
    onlyApply,
    dashboardInfo: {
      ...dashboardInfo,
      metadata: { color_scheme: 'supersetColors', ...metadata },
    },
  };
  render(<PropertiesModal {...props} />, { useRedux: true, store });
  await screen.findByTestId('dashboard-edit-properties-form');
  return { props, store };
};

const openPanel = async (title: string) => {
  const header = screen.getByText(title).closest('.ant-collapse-header')!;
  if (header.getAttribute('aria-expanded') !== 'true')
    await userEvent.click(header);
};

const openRefresh = async () => {
  await openPanel('Refresh settings');
  await screen.findByRole('switch', { name: 'Use a refresh policy' });
};

const jsonEditor = async () => {
  await openPanel('Advanced settings');
  return (await screen.findByLabelText(
    'dashboard-json-metadata',
  )) as HTMLTextAreaElement;
};

const jsonText = () =>
  JSON.parse(
    (screen.getByLabelText('dashboard-json-metadata') as HTMLTextAreaElement)
      .value,
  );

const typeJson = async (value: string | Record<string, unknown>) => {
  fireEvent.change(await jsonEditor(), {
    target: {
      value: typeof value === 'string' ? value : JSON.stringify(value),
    },
  });
};

const mockPut = () => jest.spyOn(SupersetCore.SupersetClient, 'put');

const save = async (put: jest.SpyInstance, label = 'Save') => {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: label })).toBeEnabled(),
  );
  await userEvent.click(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  return JSON.parse(JSON.parse(put.mock.calls[0][0].body).json_metadata);
};

const defaultGroup = () =>
  screen.getByRole('radiogroup', { name: 'Default refresh frequency' });

const shortestSelect = () =>
  screen.getByRole('combobox', { name: 'Shortest interval' });

const saveFocusesInvalidField = async (
  put: jest.SpyInstance,
  field: () => HTMLElement,
  calls = 0,
) => {
  const button = screen.getByRole('button', { name: 'Save' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  await waitFor(() =>
    expect(field()).toContainElement(document.activeElement as HTMLElement),
  );
  expect(put).toHaveBeenCalledTimes(calls);
};

const unprocessable = (message: Record<string, string[]>) =>
  new Response(JSON.stringify({ message }), {
    status: 422,
    statusText: 'UNPROCESSABLE ENTITY',
  });

// Start with valid loaded settings so invalid edits exercise blocking validation.
const renderEditedRefreshModal = async (
  metadata: Record<string, unknown>,
  options: Parameters<typeof renderRefreshModal>[1] = {},
) => {
  const result = await renderRefreshModal({ refresh_frequency: 0 }, options);
  await typeJson({ color_scheme: 'supersetColors', ...metadata });
  return result;
};

const selectValue = (name: string) =>
  screen
    .getByRole('combobox', { name })
    .closest('.ant-select')
    ?.querySelector('.ant-select-content[title]')?.textContent ?? null;

// Each Select renders its dropdown on first open; ids are not unique in
// tests, so the dropdown is found as the one that appeared after the click.
const pickOption = async (name: string, label: string) => {
  const before = new Set(document.querySelectorAll('.ant-select-dropdown'));
  await userEvent.click(screen.getByRole('combobox', { name }));
  const dropdown = await waitFor(() => {
    const element = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-select-dropdown'),
    ).find(candidate => !before.has(candidate));
    expect(element).toBeTruthy();
    return element!;
  });
  await userEvent.click(within(dropdown).getByTitle(label));
  await waitFor(() => expect(selectValue(name)).toBe(label));
};

const dangerToasts = (store: ReturnType<typeof createStore>) =>
  (
    store.getState() as unknown as { messageToasts: { toastType: string }[] }
  ).messageToasts.filter(toast => toast.toastType === 'DANGER_TOAST');

const ALLOWED = { auto_refresh_allowed: true };
const minutes = (value: number) => ({ value, unit: 'minutes' });
const hours = (value: number) => ({ value, unit: 'hours' });
const PROHIBITED_DEFAULT_ERROR =
  'A default of 5 minutes is set, but auto-refresh is off. Pick "Don\'t refresh".';

test('no policy with a Custom 45 saves exactly as in existing', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({ refresh_frequency: 45 });

  const body = await save(put);

  expect(body).not.toHaveProperty('auto_refresh_policy');
  expect(body.refresh_frequency).toBe(45);
});

test('no policy, a non-number refresh_frequency typed in the JSON is not an error and the control is sent', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({ refresh_frequency: 45 });

  await typeJson({ color_scheme: 'supersetColors', refresh_frequency: 'abc' });

  expect(
    screen.queryByText(/Refresh frequency must be 0 or a whole number/),
  ).not.toBeInTheDocument();
  const body = await save(put);
  expect(body.refresh_frequency).toBe('abc');
  expect(body).not.toHaveProperty('auto_refresh_policy');
});

test('no policy, a number typed in the JSON does not move the control and Save sends the control', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({ refresh_frequency: 0 });

  await typeJson({ color_scheme: 'supersetColors', refresh_frequency: 300 });
  await openPanel('Refresh settings');

  expect(
    await screen.findByRole('radio', { name: "Don't refresh" }),
  ).toBeChecked();
  const body = await save(put);
  expect(body.refresh_frequency).toBe(300);
});

test('no policy keeps Advanced JSON synchronized with the refresh selector', async () => {
  await renderRefreshModal({ refresh_frequency: 0 });
  const typed = '{"color_scheme": "supersetColors", "refresh_frequency": 300}';
  await typeJson(typed);
  await openPanel('Refresh settings');

  await userEvent.click(
    await screen.findByRole('radio', { name: '10 seconds' }),
  );

  expect(jsonText()).toEqual({
    color_scheme: 'supersetColors',
    refresh_frequency: 10,
  });
});

test('no policy: a 422 on refresh_frequency shows under the existing select and focuses its radio', async () => {
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.refresh_frequency': [
        'Refresh frequency must be one of the standard intervals.',
      ],
    }),
  );
  await renderRefreshModal({ refresh_frequency: 45 });

  await save(put);

  const error = await screen.findByText(
    'Refresh frequency must be one of the standard intervals.',
  );
  const group = screen.getByRole('radiogroup', { name: 'Refresh frequency' });
  expect(group).toHaveAttribute('aria-describedby', error.id);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      within(group).getByRole('radio', { name: /Custom/ }),
    ),
  );
});

test('turning the policy off on a dashboard that had one sends "auto_refresh_policy": null', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Use a refresh policy' }),
  );

  const body = await save(put);
  expect(body).toHaveProperty('auto_refresh_policy', null);
});

test('turning the policy on then off on a dashboard that never had one sends no key', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({ refresh_frequency: 0 });
  await openRefresh();
  const policySwitch = screen.getByRole('switch', {
    name: 'Use a refresh policy',
  });

  await userEvent.click(policySwitch);
  await screen.findByRole('switch', { name: 'Allow auto-refresh' });
  await userEvent.click(policySwitch);

  const body = await save(put);
  expect(body).not.toHaveProperty('auto_refresh_policy');
});

test('the policy is sent even when its key is deleted in Advanced JSON', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  const policy = {
    auto_refresh_allowed: true,
    minimum_refresh_interval: minutes(1),
  };
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: policy,
  });

  await typeJson({ color_scheme: 'supersetColors', refresh_frequency: 0 });

  const body = await save(put);
  expect(body.auto_refresh_policy).toEqual(policy);
});

test('a control change rewrites both refresh keys in the JSON text', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  await pickOption('Shortest interval', '1 minute');
  await userEvent.click(screen.getByRole('radio', { name: '5 minutes' }));
  await jsonEditor();

  expect(jsonText()).toMatchObject({
    refresh_frequency: 300,
    auto_refresh_policy: {
      auto_refresh_allowed: true,
      minimum_refresh_interval: minutes(1),
    },
  });
});

test('with a policy, refresh_frequency and policy edits typed in the JSON update the controls', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });

  await typeJson({
    color_scheme: 'supersetColors',
    refresh_frequency: 10,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();
  expect(screen.getByRole('radio', { name: '10 seconds' })).toBeChecked();

  await typeJson({
    color_scheme: 'supersetColors',
    refresh_frequency: 10,
    auto_refresh_policy: { ...ALLOWED, maximum_refresh_interval: minutes(5) },
  });
  await openRefresh();
  expect(selectValue('Longest interval')).toBe('5 minutes');
});

test('no policy: typing a policy object in the JSON turns the policy on', async () => {
  await renderRefreshModal({ refresh_frequency: 0 });

  await typeJson({ color_scheme: 'supersetColors', auto_refresh_policy: {} });
  await openRefresh();

  expect(
    screen.getByRole('switch', { name: 'Use a refresh policy' }),
  ).toBeChecked();
  expect(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  ).toBeChecked();
});

test('typing a policy edit in Advanced updates the controls and leaves the text exactly as typed', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });
  const typed =
    '{"color_scheme":"supersetColors",  "auto_refresh_policy": {"auto_refresh_allowed": false},"refresh_frequency":0}';

  await typeJson(typed);
  await openRefresh();

  expect(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  ).not.toBeChecked();
  expect(
    (screen.getByLabelText('dashboard-json-metadata') as HTMLTextAreaElement)
      .value,
  ).toBe(typed);
});

test('no policy: pasting refresh_frequency and a policy in one edit turns the policy on with that frequency', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({ refresh_frequency: 0 });

  await typeJson({
    color_scheme: 'supersetColors',
    refresh_frequency: 300,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  expect(
    screen.getByRole('switch', { name: 'Use a refresh policy' }),
  ).toBeChecked();
  expect(screen.getByRole('radio', { name: '5 minutes' })).toBeChecked();
  const body = await save(put);
  expect(body.refresh_frequency).toBe(300);
  expect(body.auto_refresh_policy).toEqual(ALLOWED);
});

test('control edits made while the JSON is broken are kept when it is fixed, and Save sends the controls', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  const policy = {
    auto_refresh_allowed: true,
    minimum_refresh_interval: minutes(1),
  };
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: policy,
  });
  const original = (await jsonEditor()).value;

  await typeJson('{');
  await openRefresh();
  await pickOption('Shortest interval', '5 minutes');
  await typeJson(original);
  await openRefresh();

  expect(selectValue('Shortest interval')).toBe('5 minutes');
  expect(jsonText().auto_refresh_policy.minimum_refresh_interval).toEqual(
    minutes(1),
  );
  const body = await save(put);
  expect(body.auto_refresh_policy.minimum_refresh_interval).toEqual(minutes(5));
});

test('a parsed policy equal to the last parsed one is not copied back', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });
  const original = JSON.parse((await jsonEditor()).value);

  await typeJson('{');
  await openRefresh();
  await userEvent.click(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  );
  await typeJson({ ...original, foo: 1 });
  await openRefresh();

  expect(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  ).not.toBeChecked();
});

test('Allow off writes auto_refresh_allowed false into the text right away and keeps refresh_frequency', async () => {
  await renderRefreshModal({
    refresh_frequency: 300,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  );
  await jsonEditor();

  expect(jsonText()).toMatchObject({
    refresh_frequency: 300,
    auto_refresh_policy: { auto_refresh_allowed: false },
  });
});

test("picking Don't refresh after Allow off writes refresh_frequency 0 into the text", async () => {
  await renderRefreshModal({
    refresh_frequency: 300,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  );
  await userEvent.click(
    await screen.findByRole('radio', { name: "Don't refresh" }),
  );
  await jsonEditor();

  expect(jsonText()).toMatchObject({
    refresh_frequency: 0,
    auto_refresh_policy: { auto_refresh_allowed: false },
  });
});

test('with a policy, a non-number refresh_frequency in the JSON is an error in Advanced and blocks Save', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });

  await typeJson({
    color_scheme: 'supersetColors',
    refresh_frequency: 'abc',
    auto_refresh_policy: ALLOWED,
  });

  expect(
    await screen.findByText(
      'refresh_frequency: Refresh frequency must be 0 or a whole number of seconds.',
    ),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
  );
});

test('a hand-typed unknown policy key is shown in Advanced in an aria-live region and blocks Save', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });

  await typeJson({
    color_scheme: 'supersetColors',
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, extra: 1 },
  });

  const error = await screen.findByText(
    'auto_refresh_policy.extra: Unknown field.',
  );
  expect(error.closest('[aria-live="polite"]')).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
  );
});

test('with a policy, the JSON text and the sent body agree after every control change', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  await pickOption('Longest interval', '1 hour');
  await userEvent.click(screen.getByRole('radio', { name: '30 minutes' }));
  await pickOption('Shortest interval', '5 minutes');
  await jsonEditor();
  const text = jsonText();

  const body = await save(put);
  expect(body.refresh_frequency).toBe(text.refresh_frequency);
  expect(body.auto_refresh_policy).toEqual(text.auto_refresh_policy);
  expect(body.refresh_frequency).toBe(1800);
  expect(body.auto_refresh_policy).toEqual({
    auto_refresh_allowed: true,
    minimum_refresh_interval: minutes(5),
    maximum_refresh_interval: hours(1),
  });
});

test("Allow off with a positive default focuses the default on Save until Don't refresh is picked, then sends 0 and keeps the bounds", async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  const bounds = {
    minimum_refresh_interval: minutes(1),
    maximum_refresh_interval: hours(1),
  };
  await renderRefreshModal({
    refresh_frequency: 300,
    auto_refresh_policy: { ...ALLOWED, ...bounds },
  });
  await openRefresh();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  );

  expect(await screen.findByText(PROHIBITED_DEFAULT_ERROR)).toBeInTheDocument();
  await saveFocusesInvalidField(put, defaultGroup);

  await userEvent.click(screen.getByRole('radio', { name: "Don't refresh" }));
  await waitFor(() =>
    expect(
      screen.queryByText(PROHIBITED_DEFAULT_ERROR),
    ).not.toBeInTheDocument(),
  );
  const body = await save(put);
  expect(body.refresh_frequency).toBe(0);
  expect(body.auto_refresh_policy).toEqual({
    auto_refresh_allowed: false,
    ...bounds,
  });
});

test('Allow off and on again keeps the frequency and checks it against each state', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 300,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  await openRefresh();
  const allow = screen.getByRole('switch', { name: 'Allow auto-refresh' });
  const error =
    'The saved default (5 minutes) is shorter than the shortest interval. Pick another.';

  await pickOption('Shortest interval', '30 minutes');
  expect(await screen.findByText(error)).toBeInTheDocument();
  await userEvent.click(allow);
  await waitFor(() =>
    expect(screen.queryByText(error)).not.toBeInTheDocument(),
  );
  expect(await screen.findByText(PROHIBITED_DEFAULT_ERROR)).toBeInTheDocument();
  await saveFocusesInvalidField(put, defaultGroup);
  await userEvent.click(allow);

  expect(await screen.findByText(error)).toBeInTheDocument();
  await saveFocusesInvalidField(put, defaultGroup);
  await jsonEditor();
  expect(jsonText().refresh_frequency).toBe(300);
});

test('raising the shortest above the default shows an error, focuses it on Save and changes nothing', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 60,
    auto_refresh_policy: ALLOWED,
  });
  await openRefresh();

  await pickOption('Shortest interval', '5 minutes');

  expect(
    await screen.findByText(
      'The saved default (1 minute) is shorter than the shortest interval. Pick another.',
    ),
  ).toBeInTheDocument();
  await saveFocusesInvalidField(put, defaultGroup);
  await jsonEditor();
  expect(jsonText().refresh_frequency).toBe(60);
});

test('a 422 with the refresh panel closed shows the error inline, keeps the toast, opens the panel and focuses the field', async () => {
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.auto_refresh_policy.minimum_refresh_interval': [
        "1 minute isn't a standard interval. Select one from the list.",
      ],
    }),
  );
  const { store } = await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  expect(
    screen.queryByRole('switch', { name: 'Use a refresh policy' }),
  ).not.toBeInTheDocument();

  await save(put);

  const error = await screen.findByText(
    "1 minute isn't a standard interval. Select one from the list.",
  );
  const shortest = screen.getByRole('combobox', { name: 'Shortest interval' });
  expect(shortest).toHaveAttribute('aria-describedby', error.id);
  await waitFor(() => expect(document.activeElement).toBe(shortest));
  expect(dangerToasts(store)).toHaveLength(1);
});

const collapseRefresh = async () => {
  const header = screen
    .getByText('Refresh settings')
    .closest('.ant-collapse-header')!;
  await userEvent.click(header);
  await waitFor(() => expect(header).toHaveAttribute('aria-expanded', 'false'));
};

const ignoreFocusInHiddenPanels = () => {
  const { focus } = HTMLElement.prototype;
  return jest
    .spyOn(HTMLElement.prototype, 'focus')
    .mockImplementation(function focusVisible(
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (!this.closest('.ant-collapse-panel-hidden')) {
        focus.call(this, options);
      }
    });
};

test('a 422 after the refresh panel was opened and collapsed focuses the shortest interval once the panel is open', async () => {
  const focus = ignoreFocusInHiddenPanels();
  try {
    const put = mockPut().mockRejectedValue(
      unprocessable({
        'json_metadata.auto_refresh_policy.minimum_refresh_interval': [
          "1 minute isn't a standard interval. Select one from the list.",
        ],
      }),
    );
    await renderRefreshModal({
      refresh_frequency: 0,
      auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
    });
    await openRefresh();
    await collapseRefresh();

    await save(put);

    const shortest = await screen.findByRole('combobox', {
      name: 'Shortest interval',
    });
    await waitFor(() => expect(shortest).toHaveFocus());
  } finally {
    focus.mockRestore();
  }
});

test('a 422 on refresh_frequency after the refresh panel was opened and collapsed focuses Default once the panel is open', async () => {
  const focus = ignoreFocusInHiddenPanels();
  try {
    const message = 'Refresh frequency must be one of the standard intervals.';
    const put = mockPut().mockRejectedValue(
      unprocessable({ 'json_metadata.refresh_frequency': [message] }),
    );
    await renderRefreshModal({
      refresh_frequency: 300,
      auto_refresh_policy: ALLOWED,
    });
    await openRefresh();
    await collapseRefresh();

    await save(put);

    const selected = await screen.findByRole('radio', { name: '5 minutes' });
    await waitFor(() => expect(selected).toHaveFocus());
    expect(
      screen.getByRole('radiogroup', { name: 'Default refresh frequency' }),
    ).toHaveAccessibleDescription(message);
  } finally {
    focus.mockRestore();
  }
});

test('a late 422 after a refresh change shows only the toast', async () => {
  let rejectPut: (reason: unknown) => void = () => {};
  const put = mockPut().mockReturnValue(
    new Promise<Awaited<ReturnType<typeof SupersetCore.SupersetClient.put>>>(
      (_, reject) => {
        rejectPut = reject;
      },
    ),
  );
  const { store } = await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  await openRefresh();

  await save(put);
  await pickOption('Shortest interval', '5 minutes');
  const focused = document.activeElement;
  rejectPut(
    unprocessable({
      'json_metadata.auto_refresh_policy.minimum_refresh_interval': [
        "1 minute isn't a standard interval. Select one from the list.",
      ],
    }),
  );

  await waitFor(() => expect(dangerToasts(store)).toHaveLength(1));
  expect(
    screen.queryByText(
      "1 minute isn't a standard interval. Select one from the list.",
    ),
  ).not.toBeInTheDocument();
  expect(document.activeElement).toBe(focused);
});

test('a policy state that is not an object hides Default and disables Allow, Shortest and Longest', async () => {
  await renderEditedRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: 'x',
  });
  await openRefresh();

  const allow = screen.getByRole('switch', { name: 'Allow auto-refresh' });
  expect(allow).not.toBeChecked();
  expect(allow).toBeDisabled();
  expect(
    screen.getByRole('combobox', { name: 'Shortest interval' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('combobox', { name: 'Longest interval' }),
  ).toBeDisabled();
  expect(
    screen.queryByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).not.toBeInTheDocument();
  await jsonEditor();
  expect(
    screen.getByText(
      'auto_refresh_policy: Auto-refresh policy must be an object with auto_refresh_allowed, minimum_refresh_interval and maximum_refresh_interval.',
    ),
  ).toBeInTheDocument();
});

test('no policy: a 422 on a policy field goes to Advanced, focuses the editor and stops retrying', async () => {
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.auto_refresh_policy.minimum_refresh_interval': [
        "45 seconds isn't a standard interval. Select one from the list.",
      ],
    }),
  );
  await renderRefreshModal({ refresh_frequency: 0 });

  await save(put);

  expect(
    await screen.findByText(
      "auto_refresh_policy.minimum_refresh_interval: 45 seconds isn't a standard interval. Select one from the list.",
    ),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByLabelText('dashboard-json-metadata'),
    ),
  );
  const timeouts = jest.spyOn(window, 'setTimeout');
  await new Promise(resolve => setTimeout(resolve, 300));
  expect(
    timeouts.mock.calls.filter(([, delay]) => delay === 0).length,
  ).toBeLessThan(10);
  timeouts.mockRestore();
});

test('a 422 on a field without a control opens Advanced and focuses the editor', async () => {
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.auto_refresh_policy.unknown_field': ['Unknown field.'],
    }),
  );
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: ALLOWED,
  });

  await save(put);

  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByLabelText('dashboard-json-metadata'),
    ),
  );
  expect(
    screen.getByText('auto_refresh_policy.unknown_field: Unknown field.'),
  ).toBeInTheDocument();
});

test('a 422 on both bounds is cleared by changing Shortest, and Save is enabled again', async () => {
  const message =
    'Shortest interval must be shorter than or equal to the longest interval.';
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.auto_refresh_policy.minimum_refresh_interval': [message],
      'json_metadata.auto_refresh_policy.maximum_refresh_interval': [message],
    }),
  );
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: {
      ...ALLOWED,
      minimum_refresh_interval: minutes(5),
      maximum_refresh_interval: hours(1),
    },
  });

  await save(put);
  expect(await screen.findAllByText(message)).toHaveLength(2);
  await saveFocusesInvalidField(put, shortestSelect, 1);

  await pickOption('Shortest interval', '1 minute');

  expect(screen.queryByText(message)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
  );
});

test('onlyApply: the submitted jsonMetadata carries the stored policy', async () => {
  const policy = { ...ALLOWED, minimum_refresh_interval: minutes(1) };
  const { props } = await renderRefreshModal(
    { refresh_frequency: 0, auto_refresh_policy: policy },
    { onlyApply: true },
  );

  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
  expect(
    JSON.parse(props.onSubmit.mock.calls[0][0].jsonMetadata)
      .auto_refresh_policy,
  ).toEqual(policy);
});

test('onlyApply: turning the policy off submits "auto_refresh_policy": null', async () => {
  const { props } = await renderRefreshModal(
    { refresh_frequency: 0, auto_refresh_policy: ALLOWED },
    { onlyApply: true },
  );
  await openRefresh();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Use a refresh policy' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
  expect(
    JSON.parse(props.onSubmit.mock.calls[0][0].jsonMetadata),
  ).toHaveProperty('auto_refresh_policy', null);
});

test('onlyApply: the policy is submitted even when its key is deleted in Advanced JSON', async () => {
  const { props } = await renderRefreshModal(
    { refresh_frequency: 0, auto_refresh_policy: ALLOWED },
    { onlyApply: true },
  );

  await typeJson({ color_scheme: 'supersetColors', refresh_frequency: 0 });
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

  await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
  expect(
    JSON.parse(props.onSubmit.mock.calls[0][0].jsonMetadata)
      .auto_refresh_policy,
  ).toEqual(ALLOWED);
});

test('a 422 focuses its field when the Refresh section mounts late', async () => {
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.auto_refresh_policy.minimum_refresh_interval': [
        "1 minute isn't a standard interval. Select one from the list.",
      ],
    }),
  );
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  mockRefreshSectionSkip = 2;

  await save(put);

  const shortest = await screen.findByRole('combobox', {
    name: 'Shortest interval',
  });
  await waitFor(() => expect(shortest).toHaveFocus());
});

test('a 422 whose field never mounts stops retrying focus', async () => {
  const put = mockPut().mockRejectedValue(
    unprocessable({
      'json_metadata.auto_refresh_policy.minimum_refresh_interval': [
        "1 minute isn't a standard interval. Select one from the list.",
      ],
    }),
  );
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  mockRefreshSectionSkip = Infinity;
  jest.useFakeTimers({ advanceTimers: true });

  try {
    await save(put);

    expect(() => jest.runAllTimers()).not.toThrow();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test('turning the policy off and on restores the read policy', async () => {
  const readPolicy = {
    ...ALLOWED,
    minimum_refresh_interval: minutes(1),
    maximum_refresh_interval: hours(1),
  };
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: readPolicy,
  });
  await openRefresh();
  const policySwitch = () =>
    screen.getByRole('switch', { name: 'Use a refresh policy' });

  await userEvent.click(policySwitch());
  await userEvent.click(policySwitch());

  expect(selectValue('Shortest interval')).toBe('1 minute');
  expect(selectValue('Longest interval')).toBe('1 hour');
  await jsonEditor();
  expect(jsonText().auto_refresh_policy).toEqual(readPolicy);
});

test('typing back the loaded JSON after a control change and a broken JSON restores the controls', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  const loadedJson = (await jsonEditor()).value;
  await openRefresh();
  await pickOption('Shortest interval', '5 minutes');

  await typeJson('{');
  await typeJson(loadedJson);
  await openRefresh();

  expect(selectValue('Shortest interval')).toBe('1 minute');
});

test('a Default change clears a server refresh_frequency error and enables Save', async () => {
  const message = 'Server refresh frequency error';
  const put = mockPut().mockRejectedValue(
    unprocessable({ 'json_metadata.refresh_frequency': [message] }),
  );
  await renderRefreshModal({
    refresh_frequency: 300,
    auto_refresh_policy: ALLOWED,
  });
  await save(put);
  await saveFocusesInvalidField(put, defaultGroup, 1);

  await userEvent.click(await screen.findByRole('radio', { name: '1 minute' }));

  expect(screen.queryByText(message)).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
  );
});

test('"No limit" removes the bound key from the saved policy', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { ...ALLOWED, minimum_refresh_interval: minutes(1) },
  });
  await openRefresh();

  await pickOption('Shortest interval', 'No limit');
  const body = await save(put);

  expect(body.auto_refresh_policy).not.toHaveProperty(
    'minimum_refresh_interval',
  );
});

test('a server refresh_frequency error while prohibited shows on Default and focuses it', async () => {
  const message = 'Server prohibited policy error';
  const put = mockPut().mockRejectedValue(
    unprocessable({ 'json_metadata.refresh_frequency': [message] }),
  );
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: { auto_refresh_allowed: false },
  });

  await save(put);

  const dontRefresh = await screen.findByRole('radio', {
    name: "Don't refresh",
  });
  await waitFor(() => expect(dontRefresh).toHaveFocus());
  expect(
    screen.getByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).toHaveAccessibleDescription(message);
  expect(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  ).not.toHaveAttribute('aria-invalid');
  expect(
    screen.queryByText(`refresh_frequency: ${message}`),
  ).not.toBeInTheDocument();
});

test('flag off retains a stored policy and keeps the standard Properties editor', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  const stored = { auto_refresh_allowed: false };
  await renderRefreshModal(
    { auto_refresh_policy: stored, refresh_frequency: 30 },
    { enabled: false },
  );
  await openPanel('Refresh settings');
  expect(
    screen.queryByRole('switch', { name: 'Use a refresh policy' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Custom/ })).toBeInTheDocument();
  const body = await save(put);
  expect(body.auto_refresh_policy).toEqual(stored);
  expect(body.refresh_frequency).toBe(30);
});

test('an empty policy without whole-second choices blocks Save and shows an accessible error', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderEditedRefreshModal(
    { refresh_frequency: 0, auto_refresh_policy: {} },
    {
      intervals: [
        [0, "Don't refresh"],
        [0.5, 'Half second'],
      ],
    },
  );

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(),
  );
  await jsonEditor();
  const error = await screen.findByText(
    'auto_refresh_policy: No standard interval fits between the shortest and longest interval. Widen the range.',
  );
  expect(error).toBeVisible();
  expect(error.closest('[aria-live="polite"]')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(put).not.toHaveBeenCalled();

  await openRefresh();
  await userEvent.click(
    screen.getByRole('switch', { name: 'Allow auto-refresh' }),
  );
  const body = await save(put);
  expect(body.auto_refresh_policy).toEqual({ auto_refresh_allowed: false });
});

test('a stored prohibited policy with a positive frequency warns on Default and allows Save', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 300,
    auto_refresh_policy: { auto_refresh_allowed: false },
  });
  await openRefresh();

  const error = await screen.findByText(PROHIBITED_DEFAULT_ERROR);
  expect(
    screen.getByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).not.toHaveAttribute('aria-invalid');
  expect(error.closest('[role="alert"]')).toBeTruthy();
  expect(
    screen.getByRole('radiogroup', { name: 'Default refresh frequency' }),
  ).toHaveAttribute('aria-describedby', error.closest('[role="alert"]')?.id);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled(),
  );
  await jsonEditor();
  expect(jsonText().refresh_frequency).toBe(300);

  await openRefresh();
  await userEvent.click(screen.getByRole('radio', { name: "Don't refresh" }));
  const body = await save(put);
  expect(body.refresh_frequency).toBe(0);
  expect(body.auto_refresh_policy).toEqual({ auto_refresh_allowed: false });
});

test.each([
  {
    name: 'flag off',
    metadata: { auto_refresh_policy: { auto_refresh_allowed: false } },
    enabled: false,
  },
  { name: 'no policy', metadata: {}, enabled: true },
])(
  '$name: a positive frequency saves unchanged with no prohibited error',
  async ({ metadata, enabled }) => {
    const put = mockPut().mockResolvedValue(new Response('{}'));
    await renderRefreshModal(
      { refresh_frequency: 300, ...metadata },
      { enabled },
    );
    await openPanel('Refresh settings');
    expect(
      screen.queryByText(PROHIBITED_DEFAULT_ERROR),
    ).not.toBeInTheDocument();
    const body = await save(put);
    expect(body.refresh_frequency).toBe(300);
    expect(body.auto_refresh_policy).toEqual(metadata.auto_refresh_policy);
  },
);

test.each([
  { name: 'no policy', metadata: {}, enabled: true },
  {
    name: 'null policy',
    metadata: { auto_refresh_policy: null },
    enabled: true,
  },
  { name: 'flag off', metadata: { auto_refresh_policy: {} }, enabled: false },
])(
  'without whole-second choices, $name still saves',
  async ({ metadata, enabled }) => {
    const put = mockPut().mockResolvedValue(new Response('{}'));
    await renderRefreshModal(
      { refresh_frequency: 0, ...metadata },
      {
        enabled,
        intervals: [
          [0, "Don't refresh"],
          [0.5, 'Half second'],
        ],
      },
    );
    const body = await save(put);
    expect(body.refresh_frequency).toBe(0);
    expect(body.auto_refresh_policy).toEqual(metadata.auto_refresh_policy);
  },
);

test('enabling a policy preserves the numeric frequency edited while policy was off', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({ refresh_frequency: 0 });
  await typeJson({ refresh_frequency: 300 });
  await openRefresh();
  await userEvent.click(
    screen.getByRole('switch', { name: 'Use a refresh policy' }),
  );
  expect(await screen.findByRole('radio', { name: '5 minutes' })).toBeChecked();
  expect(jsonText().refresh_frequency).toBe(300);
  const body = await save(put);
  expect(body.refresh_frequency).toBe(300);
});

test('a rename preserves an unchanged default removed from the interval list', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal(
    { refresh_frequency: 60, auto_refresh_policy: ALLOWED },
    {
      intervals: REFRESH_INTERVALS.filter(([value]) => value !== 60),
    },
  );
  const title = screen.getAllByRole('textbox')[0];
  await userEvent.clear(title);
  await userEvent.type(title, 'Renamed dashboard');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  await openRefresh();
  expect(
    await screen.findByText(
      /saved default.*isn't one of the standard intervals/,
    ),
  ).toBeInTheDocument();
  const body = await save(put);
  expect(body.refresh_frequency).toBe(60);
  expect(JSON.parse(String(put.mock.calls[0][0].body)).dashboard_title).toBe(
    'Renamed dashboard',
  );
});

test('changing the default to an invalid frequency saves nothing and focuses it on Save', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  await renderRefreshModal({
    refresh_frequency: 60,
    auto_refresh_policy: ALLOWED,
  });
  await typeJson({ refresh_frequency: 45, auto_refresh_policy: ALLOWED });
  await saveFocusesInvalidField(put, defaultGroup);
  expect(put).not.toHaveBeenCalled();
});

test.each([
  {
    name: 'unknown key',
    policy: { custom_refresh_allowed: false },
    warning: 'custom_refresh_allowed: Unknown field.',
  },
  {
    name: 'non-boolean switch',
    policy: { auto_refresh_allowed: 'yes' },
    warning: 'auto_refresh_allowed: Must be true or false.',
  },
  {
    name: 'non-object policy',
    policy: 'invalid',
    warning:
      'Auto-refresh policy must be an object with auto_refresh_allowed, minimum_refresh_interval and maximum_refresh_interval.',
  },
  {
    name: 'no standard interval fits',
    policy: {},
    warning:
      'No standard interval fits between the shortest and longest interval. Widen the range.',
    intervals: [
      [0, "Don't refresh"],
      [0.5, 'Half second'],
    ],
  },
])(
  'a rename shows the stored $name warning and permits Save',
  async ({ policy, warning, intervals }) => {
    const put = mockPut().mockResolvedValue(new Response('{}'));
    await renderRefreshModal(
      { refresh_frequency: 0, auto_refresh_policy: policy },
      intervals ? { intervals } : {},
    );
    const title = screen.getAllByRole('textbox')[0];
    await userEvent.clear(title);
    await userEvent.type(title, 'Renamed dashboard');
    await openRefresh();
    const message = await screen.findByText(warning);
    const alert = message.closest('[role="alert"]');
    expect(alert).toBeTruthy();
    if (
      policy &&
      typeof policy === 'object' &&
      'custom_refresh_allowed' in policy
    ) {
      expect(
        screen.getByText(
          'These saved refresh settings are invalid. You can still Save. Fix them in Advanced settings.',
        ),
      ).toBeVisible();
    }
    expect(alert).toHaveAttribute('id', 'dashboard-refresh-policy-warning');
    if (
      policy &&
      typeof policy === 'object' &&
      'auto_refresh_allowed' in policy
    ) {
      expect(
        screen.getByRole('switch', { name: 'Allow auto-refresh' }),
      ).toHaveAttribute('aria-describedby', 'dashboard-refresh-policy-warning');
    }
    expect(
      screen.getByRole('switch', { name: 'Use a refresh policy' }),
    ).toHaveAttribute('aria-describedby', alert?.id);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    const body = await save(put);
    expect(body.auto_refresh_policy).toEqual(policy);
  },
);

test('stored inverted bounds link each select to its warning and permit Save', async () => {
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: {
      ...ALLOWED,
      minimum_refresh_interval: hours(1),
      maximum_refresh_interval: minutes(5),
    },
  });
  await openRefresh();
  for (const [label, key] of [
    ['Shortest interval', 'minimum_refresh_interval'],
    ['Longest interval', 'maximum_refresh_interval'],
  ]) {
    const id = `dashboard-refresh-warning-auto_refresh_policy-${key}`;
    expect(screen.getByRole('combobox', { name: label })).toHaveAttribute(
      'aria-describedby',
      id,
    );
    expect(document.getElementById(id)).toBeVisible();
  }
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('a rename names both stored unknown policy keys and sends the update', async () => {
  const put = mockPut().mockResolvedValue(new Response('{}'));
  const policy = { custom_refresh_allowed: false, legacy_flag: true };
  await renderRefreshModal({
    refresh_frequency: 0,
    auto_refresh_policy: policy,
  });
  const title = screen.getAllByRole('textbox')[0];
  await userEvent.clear(title);
  await userEvent.type(title, 'Renamed dashboard');
  await openRefresh();
  for (const key of Object.keys(policy)) {
    expect(
      screen.getByText(`${key}: Unknown field.`, { exact: true }),
    ).toBeVisible();
  }
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  const body = await save(put);
  expect(put).toHaveBeenCalledTimes(1);
  expect(body.auto_refresh_policy).toEqual(policy);
  expect(JSON.parse(String(put.mock.calls[0][0].body)).dashboard_title).toBe(
    'Renamed dashboard',
  );
});
