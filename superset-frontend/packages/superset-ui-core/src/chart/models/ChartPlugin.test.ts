import { renderHook } from '@testing-library/react-hooks';
import '@testing-library/jest-dom';
import ChartPlugin from './ChartPlugin';
import ChartMetadata from './ChartMetadata';
import { QueryFormData } from '../..';
import { ChartProps } from '..';

describe('ChartPlugin', () => {
  const metadata = new ChartMetadata({
    name: 'Test Chart',
    thumbnail: 'test.png',
  });

  it('should handle promise-based loader with default export', async () => {
    const mockModule = { default: 'defaultExport' };
    const loader = jest.fn(() => Promise.resolve(mockModule));
    const plugin = new ChartPlugin({ ...config, loadChart: loader });

    const result = await plugin.loadChart();
    expect(result).toBe('defaultExport');
  });

  it('should handle promise-based loader without default export', async () => {
    const mockModule = { value: 'nonDefaultExport' };
    const loader = jest.fn(() => Promise.resolve(mockModule));
    const plugin = new ChartPlugin({ ...config, loadChart: loader });

    const result = await plugin.loadChart();
    expect(result.value).toBe('nonDefaultExport');
  });

  it('should handle non-promise loader', () => {
    const mockModule = { value: 'nonPromiseExport' };
    const loader = jest.fn(() => mockModule);
    const plugin = new ChartPlugin({ ...config, loadChart: loader });

    const result = plugin.loadChart();
    expect(result.value).toBe('nonPromiseExport');
  });

  const buildQuery = jest.fn();
  const transformProps = jest.fn();
  const Chart = jest.fn();
  const config = {
    key: 'testKey',
    metadata,
    buildQuery,
    transformProps,
    Chart,
  };

  it('should instantiate with the correct properties', () => {
    const plugin = new ChartPlugin({ ...config, key: 'testKey' });
    expect(plugin.metadata).toBe(metadata);
    expect(plugin.loadBuildQuery).toBeDefined();
    expect(plugin.loadTransformProps).toBeDefined();
    expect(plugin.loadChart).toBeDefined();
  });

  it('should throw an error if neither Chart nor loadChart is provided', () => {
    expect(
      () =>
        new ChartPlugin({ ...config, Chart: undefined, loadChart: undefined }),
    ).toThrow('Chart or loadChart is required');
  });
});
