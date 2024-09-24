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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import * as ColorSchemeControlWrapper from 'src/dashboard/components/ColorSchemeControlWrapper';
import * as SupersetCore from '@superset-ui/core';
import PropertiesModal from '.';

const spyIsFeatureEnabled = jest.spyOn(SupersetCore, 'isFeatureEnabled');
const spyColorSchemeControlWrapper = jest.spyOn(
  ColorSchemeControlWrapper,
  'default',
);
const mockedJsonMetadata =
  '{"timed_refresh_immune_slices": [], "expanded_slices": {}, "refresh_frequency": 0, "default_filters": "{}", "color_scheme": "supersetColors", "label_colors": {"0": "#D3B3DA", "1": "#9EE5E5", "0. Pre-clinical": "#1FA8C9", "2. Phase II or Combined I/II": "#454E7C", "1. Phase I": "#5AC189", "3. Phase III": "#FF7F44", "4. Authorized": "#666666", "root": "#1FA8C9", "Protein subunit": "#454E7C", "Phase II": "#5AC189", "Pre-clinical": "#FF7F44", "Phase III": "#666666", "Phase I": "#E04355", "Phase I/II": "#FCC700", "Inactivated virus": "#A868B7", "Virus-like particle": "#3CCCCB", "Replicating bacterial vector": "#A38F79", "DNA-based": "#8FD3E4", "RNA-based vaccine": "#A1A6BD", "Authorized": "#ACE1C4", "Non-replicating viral vector": "#FEC0A1", "Replicating viral vector": "#B2B2B2", "Unknown": "#EFA1AA", "Live attenuated virus": "#FDE380", "COUNT(*)": "#D1C6BC"}, "filter_scopes": {"358": {"Country_Name": {"scope": ["ROOT_ID"], "immune": []}, "Product_Category": {"scope": ["ROOT_ID"], "immune": []}, "Clinical Stage": {"scope": ["ROOT_ID"], "immune": []}}}}';

spyColorSchemeControlWrapper.mockImplementation(
  () => (<div>ColorSchemeControlWrapper</div>) as any,
);

fetchMock.get(
  'http://localhost/api/v1/dashboard/related/roles?q=(filter:%27%27,page:0,page_size:100)',
  {
    body: {
      count: 6,
      result: [
        {
          text: 'Admin',
          value: 1,
          extra: {},
        },
        {
          text: 'Alpha',
          value: 3,
          extra: {},
        },
        {
          text: 'Gamma',
          value: 4,
          extra: {},
        },
        {
          text: 'Public',
          value: 2,
          extra: {},
        },
        {
          text: 'sql_lab',
          value: 6,
          extra: {},
        },
      ],
    },
  },
);

fetchMock.get(
  'http://localhost/api/v1/dashboard/related/owners?q=(filter:%27%27,page:0,page_size:100)',
  {
    body: {
      count: 1,
      result: [
        {
          text: 'Superset Admin',
          value: 1,
          extra: { active: true },
        },
        {
          text: 'Inactive Admin',
          value: 2,
          extra: { active: false },
        },
      ],
    },
  },
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
  owners: [],
  position_json:
    '{"CHART-63bEuxjDMJ": {"children": [], "id": "CHART-63bEuxjDMJ", "meta": {"chartId": 369, "height": 76, "sliceName": "Vaccine Candidates per Country", "sliceNameOverride": "Map of Vaccine Candidates", "uuid": "ddc91df6-fb40-4826-bdca-16b85af1c024", "width": 7}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zvw7luvEL"], "type": "CHART"}, "CHART-F-fkth0Dnv": {"children": [], "id": "CHART-F-fkth0Dnv", "meta": {"chartId": 314, "height": 76, "sliceName": "Vaccine Candidates per Country", "sliceNameOverride": "Treemap of Vaccine Candidates per Country", "uuid": "e2f5a8a7-feb0-4f79-bc6b-01fe55b98b3c", "width": 5}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zvw7luvEL"], "type": "CHART"}, "CHART-RjD_ygqtwH": {"children": [], "id": "CHART-RjD_ygqtwH", "meta": {"chartId": 351, "height": 59, "sliceName": "Vaccine Candidates per Phase", "sliceNameOverride": "Vaccine Candidates per Phase", "uuid": "30b73c65-85e7-455f-bb24-801bb0cdc670", "width": 2}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "CHART"}, "CHART-aGfmWtliqA": {"children": [], "id": "CHART-aGfmWtliqA", "meta": {"chartId": 312, "height": 59, "sliceName": "Vaccine Candidates per Phase", "uuid": "392f293e-0892-4316-bd41-c927b65606a4", "width": 4}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "CHART"}, "CHART-dCUpAcPsji": {"children": [], "id": "CHART-dCUpAcPsji", "meta": {"chartId": 325, "height": 82, "sliceName": "Vaccine Candidates per Country & Stage", "sliceNameOverride": "Heatmap of Countries & Clinical Stages", "uuid": "cd111331-d286-4258-9020-c7949a109ed2", "width": 4}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zhOlQLQnB"], "type": "CHART"}, "CHART-eirDduqb1A": {"children": [], "id": "CHART-eirDduqb1A", "meta": {"chartId": 358, "height": 59, "sliceName": "Filtering Vaccines", "sliceNameOverride": "Filter Box of Vaccines", "uuid": "c29381ce-0e99-4cf3-bf0f-5f55d6b94176", "width": 3}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "CHART"}, "CHART-fYo7IyvKZQ": {"children": [], "id": "CHART-fYo7IyvKZQ", "meta": {"chartId": 371, "height": 82, "sliceName": "Vaccine Candidates per Country & Stage", "sliceNameOverride": "Sunburst of Country & Clinical Stages", "uuid": "f69c556f-15fe-4a82-a8bb-69d5b6954123", "width": 5}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zhOlQLQnB"], "type": "CHART"}, "CHART-j4hUvP5dDD": {"children": [], "id": "CHART-j4hUvP5dDD", "meta": {"chartId": 364, "height": 82, "sliceName": "Vaccine Candidates per Approach & Stage", "sliceNameOverride": "Heatmap of Approaches & Clinical Stages", "uuid": "0c953c84-0c9a-418d-be9f-2894d2a2cee0", "width": 3}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-zhOlQLQnB"], "type": "CHART"}, "DASHBOARD_VERSION_KEY": "v2", "GRID_ID": {"children": [], "id": "GRID_ID", "parents": ["ROOT_ID"], "type": "GRID"}, "HEADER_ID": {"id": "HEADER_ID", "meta": {"text": "COVID Vaccine Dashboard"}, "type": "HEADER"}, "MARKDOWN-VjQQ5SFj5v": {"children": [], "id": "MARKDOWN-VjQQ5SFj5v", "meta": {"code": "# COVID-19 Vaccine Dashboard\\n\\nEverywhere you look, you see negative news about COVID-19. This is to be expected; it\'s been a brutal year and this disease is no joke. This dashboard hopes to use visualization to inject some optimism about the coming return to normalcy we enjoyed before 2020! There\'s lots to be optimistic about:\\n\\n- the sheer volume of attempts to fund the R&D needed to produce and bring an effective vaccine to market\\n- the large number of countries involved in at least one vaccine candidate (and the diversity of economic status of these countries)\\n- the diversity of vaccine approaches taken\\n- the fact that 2 vaccines have already been approved (and a hundreds of thousands of patients have already been vaccinated)\\n\\n### The Dataset\\n\\nThis dashboard is powered by data maintained by the Millken Institute ([link to dataset](https://airtable.com/shrSAi6t5WFwqo3GM/tblEzPQS5fnc0FHYR/viwDBH7b6FjmIBX5x?blocks=bipZFzhJ7wHPv7x9z)). We researched each vaccine candidate and added our own best guesses for the country responsible for each vaccine effort.\\n\\n_Note that this dataset was last updated on 12/23/2020_.\\n\\n", "height": 59, "width": 3}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ", "ROW-xSeNAspgw"], "type": "MARKDOWN"}, "ROOT_ID": {"children": ["TABS-wUKya7eQ0Z"], "id": "ROOT_ID", "type": "ROOT"}, "ROW-xSeNAspgw": {"children": ["MARKDOWN-VjQQ5SFj5v", "CHART-aGfmWtliqA", "CHART-RjD_ygqtwH", "CHART-eirDduqb1A"], "id": "ROW-xSeNAspgw", "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ"], "type": "ROW"}, "ROW-zhOlQLQnB": {"children": ["CHART-j4hUvP5dDD", "CHART-dCUpAcPsji", "CHART-fYo7IyvKZQ"], "id": "ROW-zhOlQLQnB", "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ"], "type": "ROW"}, "ROW-zvw7luvEL": {"children": ["CHART-63bEuxjDMJ", "CHART-F-fkth0Dnv"], "id": "ROW-zvw7luvEL", "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z", "TAB-BCIJF4NvgQ"], "type": "ROW"}, "TAB-BCIJF4NvgQ": {"children": ["ROW-xSeNAspgw", "ROW-zvw7luvEL", "ROW-zhOlQLQnB"], "id": "TAB-BCIJF4NvgQ", "meta": {"text": "Overview"}, "parents": ["ROOT_ID", "TABS-wUKya7eQ0Z"], "type": "TAB"}, "TABS-wUKya7eQ0Z": {"children": ["TAB-BCIJF4NvgQ"], "id": "TABS-wUKya7eQ0Z", "meta": {}, "parents": ["ROOT_ID"], "type": "TABS"}}',
  published: false,
  roles: [],
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

afterAll(() => {
  fetchMock.restore();
});

test('should render - FeatureFlag disabled', async () => {
  spyIsFeatureEnabled.mockReturnValue(false);
  const props = createProps();
  render(<PropertiesModal {...props} />, {
    useRedux: true,
  });
  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();

  expect(screen.getByRole('dialog')).toBeInTheDocument();

  expect(
    screen.getByRole('heading', { name: 'Basic information' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Colors' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Advanced' })).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Certification' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('heading')).toHaveLength(5);

  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(4);

  expect(screen.getAllByRole('textbox')).toHaveLength(4);
  expect(screen.getByRole('combobox')).toBeInTheDocument();

  expect(spyColorSchemeControlWrapper).toBeCalledWith(
    expect.objectContaining({ colorScheme: 'supersetColors' }),
    {},
  );
});

test('should render - FeatureFlag enabled', async () => {
  spyIsFeatureEnabled.mockReturnValue(true);
  const props = createProps();
  render(<PropertiesModal {...props} />, {
    useRedux: true,
  });
  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();

  expect(
    screen.getByRole('dialog', { name: 'Dashboard properties' }),
  ).toBeInTheDocument();

  expect(
    screen.getByRole('heading', { name: 'Basic information' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Advanced' })).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Certification' }),
  ).toBeInTheDocument();
  // Tags will be included since isFeatureFlag always returns true in this test
  expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
  expect(screen.getAllByRole('heading')).toHaveLength(5);

  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(4);

  expect(screen.getAllByRole('textbox')).toHaveLength(4);
  expect(screen.getAllByRole('combobox')).toHaveLength(3);

  expect(spyColorSchemeControlWrapper).toBeCalledWith(
    expect.objectContaining({ colorScheme: 'supersetColors' }),
    {},
  );
});

test('should open advance', async () => {
  spyIsFeatureEnabled.mockReturnValue(true);
  const props = createProps();
  render(<PropertiesModal {...props} />, {
    useRedux: true,
  });
  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();

  expect(screen.getAllByRole('textbox')).toHaveLength(4);
  expect(screen.getAllByRole('combobox')).toHaveLength(3);
  userEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  expect(screen.getAllByRole('textbox')).toHaveLength(5);
  expect(screen.getAllByRole('combobox')).toHaveLength(3);
});

test('should close modal', async () => {
  spyIsFeatureEnabled.mockReturnValue(true);
  const props = createProps();
  render(<PropertiesModal {...props} />, {
    useRedux: true,
  });
  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();

  expect(props.onHide).not.toBeCalled();
  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(props.onHide).toBeCalledTimes(1);
  userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(props.onHide).toBeCalledTimes(2);
});

test('submitting with onlyApply:false', async () => {
  const put = jest.spyOn(SupersetCore.SupersetClient, 'put');
  const spyGetCategoricalSchemeRegistry = jest.spyOn(
    SupersetCore,
    'getCategoricalSchemeRegistry',
  );
  spyGetCategoricalSchemeRegistry.mockReturnValue({
    keys: () => ['supersetColors'],
    get: () => ['#FFFFFF', '#000000'],
  } as any);
  put.mockResolvedValue({
    json: {
      result: {
        roles: 'roles',
        dashboard_title: 'dashboard_title',
        slug: 'slug',
        json_metadata: 'json_metadata',
        owners: 'owners',
      },
    },
  } as any);
  spyIsFeatureEnabled.mockReturnValue(false);
  const props = createProps();
  props.onlyApply = false;
  render(<PropertiesModal {...props} />, {
    useRedux: true,
  });
  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();

  expect(props.onHide).not.toBeCalled();
  expect(props.onSubmit).not.toBeCalled();

  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(props.onSubmit).toBeCalledTimes(1);
    expect(props.onSubmit).toBeCalledWith({
      certificationDetails: 'Sample certification',
      certifiedBy: 'John Doe',
      colorScheme: 'supersetColors',
      colorNamespace: undefined,
      id: 26,
      jsonMetadata: expect.anything(),
      owners: [],
      slug: '',
      title: 'COVID Vaccine Dashboard',
    });
  });
});

test('submitting with onlyApply:true', async () => {
  const spyGetCategoricalSchemeRegistry = jest.spyOn(
    SupersetCore,
    'getCategoricalSchemeRegistry',
  );
  spyGetCategoricalSchemeRegistry.mockReturnValue({
    keys: () => ['supersetColors'],
    get: () => ['#FFFFFF', '#000000'],
  } as any);
  spyIsFeatureEnabled.mockReturnValue(false);
  const props = createProps();
  props.onlyApply = true;
  render(<PropertiesModal {...props} />, {
    useRedux: true,
  });
  expect(
    await screen.findByTestId('dashboard-edit-properties-form'),
  ).toBeInTheDocument();

  expect(props.onHide).not.toBeCalled();
  expect(props.onSubmit).not.toBeCalled();

  userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => {
    expect(props.onSubmit).toBeCalledTimes(1);
  });
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

  expect(
    screen.getByRole('textbox', { name: 'Certification details' }),
  ).toHaveValue('');
});

test('should show all roles', async () => {
  spyIsFeatureEnabled.mockReturnValue(true);

  const props = createProps();
  const propsWithDashboardInfo = { ...props, dashboardInfo };

  const open = () => waitFor(() => userEvent.click(getSelect()));
  const getSelect = () =>
    screen.getByRole('combobox', { name: SupersetCore.t('Roles') });

  const getElementsByClassName = (className: string) =>
    document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

  const findAllSelectOptions = () =>
    waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

  render(<PropertiesModal {...propsWithDashboardInfo} />, {
    useRedux: true,
  });

  expect(screen.getAllByRole('combobox')).toHaveLength(3);
  expect(
    screen.getByRole('combobox', { name: SupersetCore.t('Roles') }),
  ).toBeInTheDocument();

  await open();

  const options = await findAllSelectOptions();

  expect(options).toHaveLength(5);
  expect(options[0]).toHaveTextContent('Admin');
});

test('should show active owners with dashboard rbac', async () => {
  spyIsFeatureEnabled.mockReturnValue(true);

  const props = createProps();
  const propsWithDashboardInfo = { ...props, dashboardInfo };

  const open = () => waitFor(() => userEvent.click(getSelect()));
  const getSelect = () =>
    screen.getByRole('combobox', { name: SupersetCore.t('Owners') });

  const getElementsByClassName = (className: string) =>
    document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

  const findAllSelectOptions = () =>
    waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

  render(<PropertiesModal {...propsWithDashboardInfo} />, {
    useRedux: true,
  });

  expect(screen.getAllByRole('combobox')).toHaveLength(3);
  expect(
    screen.getByRole('combobox', { name: SupersetCore.t('Owners') }),
  ).toBeInTheDocument();

  await open();

  const options = await findAllSelectOptions();

  expect(options).toHaveLength(1);
  expect(options[0]).toHaveTextContent('Superset Admin');
});

test('should show active owners without dashboard rbac', async () => {
  spyIsFeatureEnabled.mockReturnValue(false);

  const props = createProps();
  const propsWithDashboardInfo = { ...props, dashboardInfo };

  const open = () => waitFor(() => userEvent.click(getSelect()));
  const getSelect = () =>
    screen.getByRole('combobox', { name: SupersetCore.t('Owners') });

  const getElementsByClassName = (className: string) =>
    document.querySelectorAll(className)! as NodeListOf<HTMLElement>;

  const findAllSelectOptions = () =>
    waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

  render(<PropertiesModal {...propsWithDashboardInfo} />, {
    useRedux: true,
  });

  expect(screen.getByRole('combobox')).toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: SupersetCore.t('Owners') }),
  ).toBeInTheDocument();

  await open();

  const options = await findAllSelectOptions();

  expect(options).toHaveLength(1);
  expect(options[0]).toHaveTextContent('Superset Admin');
});
