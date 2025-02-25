const mockData = { id: 1, template_name: 'test', css: 'body { color: red; }' };

export const useSingleViewResource = (
  resource: string,
  resourceLabel: string,
  handleErrorMsg: (message: string) => void,
  handleResource = false,
  resourceData = null,
) => {
  // Return mockData in edit mode, null in create mode
  const isEditMode = window.location.search.includes('cssTemplate') || resourceData;
  
  return {
    state: {
      loading: false,
      resource: isEditMode ? mockData : null,
    },
    fetchResource: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        json: { result: isEditMode ? mockData : null },
      });
    }),
    createResource: jest.fn().mockResolvedValue({}),
    updateResource: jest.fn().mockResolvedValue({}),
    clearError: jest.fn(),
    refreshResource: jest.fn(),
  };
};

export const useListViewResource = (
  resource: string,
  resourceLabel: string,
  handleErrorMsg: (message: string) => void,
) => ({
  state: {
    loading: false,
    resourceCount: 0,
    resourceCollection: [],
    bulkSelectEnabled: false,
  },
  hasPerm: jest.fn().mockReturnValue(true),
  fetchData: jest.fn(),
  refreshData: jest.fn(),
  toggleBulkSelect: jest.fn(),
});

export const copyQueryLink = jest.fn();

export const handleDashboardDelete = jest.fn();