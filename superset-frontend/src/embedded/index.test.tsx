import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';

jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  setupAGGridModules: jest.fn(),
}));
jest.mock('src/preamble', () => jest.fn().mockResolvedValue(true));
jest.mock('src/setup/setupPlugins', () => jest.fn(), { virtual: true });
jest.mock('src/setup/setupCodeOverrides', () => jest.fn(), { virtual: true });
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({ embedded: { dashboard_id: '123' } }),
  applicationRoot: () => '/',
}));

describe('embedded/index.tsx', () => {
  beforeAll(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('initializes AG Grid modules on bootstrap', async () => {
    require('./index');

    // index.tsx uses initPreamble().then(...) to initialize plugins and AG grid
    // Wait for the promise chain to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(setupAGGridModules).toHaveBeenCalled();
  });
});
