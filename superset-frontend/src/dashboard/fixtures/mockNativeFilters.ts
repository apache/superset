// DODO was here
import {
  DataMaskStateWithId,
  NativeFiltersState,
  NativeFilterType,
} from '@superset-ui/core';

export const mockDataMaskInfo: DataMaskStateWithId = {
  DefaultsID: {
    id: 'DefaultId',
    ownState: {},
    filterState: {
      value: [],
    },
  },
};

export const nativeFiltersInfo: NativeFiltersState = {
  // DODO added 44211751
  filterSets: {
    '1': {
      id: 1,
      name: 'Set name',
      nativeFilters: {},
      dataMask: mockDataMaskInfo,
      isPrimary: false,
    },
  },
  filters: {
    DefaultsID: {
      cascadeParentIds: [],
      id: 'DefaultsID',
      name: 'test',
      filterType: 'filter_select',
      chartsInScope: [],
      targets: [
        {
          datasetId: 0,
          column: {
            name: 'test column',
            displayName: 'test column',
          },
        },
      ],
      defaultDataMask: {
        filterState: {
          value: null,
        },
      },
      scope: {
        rootPath: [],
        excluded: [],
      },
      controlValues: {
        allowsMultipleValues: true,
        isRequired: false,
      },
      type: NativeFilterType.NativeFilter,
      description: 'test description',
    },
  },
};
