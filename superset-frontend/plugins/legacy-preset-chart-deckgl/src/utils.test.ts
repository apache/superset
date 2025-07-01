import { getColorBreakpointsBuckets } from './utils';
import { ColorBreakpointType } from './types';

describe('getColorBreakpointsBuckets', () => {
  it('returns correct buckets for multiple breakpoints', () => {
    const color_breakpoints: ColorBreakpointType[] = [
      { minValue: 0, maxValue: 10, color: { r: 255, g: 0, b: 0, a: 100 } },
      { minValue: 11, maxValue: 20, color: { r: 0, g: 255, b: 0, a: 100 } },
      { minValue: 21, maxValue: 30, color: { r: 0, g: 0, b: 255, a: 100 } },
    ];
    const fd = { color_breakpoints };
    const result = getColorBreakpointsBuckets(fd as any);
    expect(result).toEqual({
      '0 - 10': { color: [255, 0, 0], enabled: true },
      '11 - 20': { color: [0, 255, 0], enabled: true },
      '21 - 30': { color: [0, 0, 255], enabled: true },
    });
  });

  it('returns empty object if color_breakpoints is empty', () => {
    const fd = { color_breakpoints: [] };
    const result = getColorBreakpointsBuckets(fd as any);
    expect(result).toEqual({});
  });

  it('returns empty object if color_breakpoints is missing', () => {
    const fd = {};
    const result = getColorBreakpointsBuckets(fd as any);
    expect(result).toEqual({});
  });
});
