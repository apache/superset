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
import { SyntheticEvent } from 'react';
import domToImage from 'dom-to-image-more';
import downloadAsPdf, {
  calculatePageBreakOffsets,
  pdfFilterElement,
  renderElementToPdf,
} from './downloadAsPdf';
import { forceLoadAllCharts } from './downloadUtils';

const mockSave = jest.fn();
const mockAddPage = jest.fn();
const mockAddImage = jest.fn();

jest.mock('dom-to-image-more', () => ({
  __esModule: true,
  default: {
    toCanvas: jest.fn(),
  },
}));

jest.mock('jspdf', () => ({
  __esModule: true,
  jsPDF: jest.fn().mockImplementation(() => ({
    save: mockSave,
    addPage: mockAddPage,
    addImage: mockAddImage,
  })),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ common: { pdf_compression_level: 'NONE' } })),
}));

jest.mock('@apache-superset/core/translation', () => ({
  t: (str: string) => str,
}));

jest.mock('@apache-superset/core/utils', () => ({
  logging: { error: jest.fn() },
}));

jest.mock('@superset-ui/core', () => ({
  ensureIsArray: (val: unknown) => (Array.isArray(val) ? val : [val]),
  getTimeFormatter: jest.fn(),
  TimeFormats: {},
  SupersetClient: {},
}));

jest.mock('./downloadUtils', () => ({
  forceLoadAllCharts: jest.fn().mockResolvedValue(false),
  restoreVirtualization: jest.fn(),
}));

const mockToCanvas = domToImage.toCanvas as jest.Mock;

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    fillRect: jest.fn(),
    drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue('data:image/png;base64,mockdata');
});

beforeEach(() => {
  mockToCanvas.mockResolvedValue({
    width: 600,
    height: 800,
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

test('warns the user via the bound toast callback and returns early when the target element is not found', async () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(null);
  const addWarningToast = jest.fn();

  await downloadAsPdf(
    '.non-existent-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  expect(addWarningToast).toHaveBeenCalledWith(
    'PDF download failed, please refresh and try again.',
  );
  expect(mockToCanvas).not.toHaveBeenCalled();
});

test('does not throw when the target element is not found and no toast callback is provided', async () => {
  jest.spyOn(document, 'querySelector').mockReturnValue(null);

  await expect(
    downloadAsPdf(
      '.non-existent-selector',
      'test-file',
      true,
    )({} as SyntheticEvent),
  ).resolves.toBeUndefined();
});

test('warns the user via the bound toast callback when PDF generation fails', async () => {
  const element = document.createElement('div');
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  mockToCanvas.mockRejectedValue(new Error('capture failed'));
  const addWarningToast = jest.fn();

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
    addWarningToast,
  )({} as SyntheticEvent);

  expect(addWarningToast).toHaveBeenCalledWith(
    'PDF download failed, please refresh and try again.',
  );
});

test('forwards both bound toast callbacks to forceLoadAllCharts', async () => {
  const element = document.createElement('div');
  jest.spyOn(document, 'querySelector').mockReturnValue(element);
  const addWarningToast = jest.fn();
  const addInfoToast = jest.fn();

  await downloadAsPdf(
    '.some-selector',
    'test-file',
    true,
    addWarningToast,
    addInfoToast,
  )({} as SyntheticEvent);

  expect(forceLoadAllCharts).toHaveBeenCalledWith(
    element,
    undefined,
    addWarningToast,
    addInfoToast,
  );
});

test('pdfFilterElement filters out buttons, inputs, selects, and header-controls', () => {
  const button = document.createElement('button');
  const input = document.createElement('input');
  const select = document.createElement('select');
  const headerControl = document.createElement('div');
  headerControl.className = 'header-controls';
  const normalDiv = document.createElement('div');
  const normalText = document.createTextNode('hello');

  expect(pdfFilterElement(button)).toBe(false);
  expect(pdfFilterElement(input)).toBe(false);
  expect(pdfFilterElement(select)).toBe(false);
  expect(pdfFilterElement(headerControl)).toBe(false);
  expect(pdfFilterElement(normalDiv)).toBe(true);
  expect(pdfFilterElement(normalText)).toBe(true);
});

test('passes filterStyles excluding CSS custom properties to domToImage.toCanvas (#45885)', async () => {
  const element = document.createElement('div');
  await renderElementToPdf(element, 'dashboard-export.pdf');

  expect(mockToCanvas).toHaveBeenCalled();
  const [[, options]] = mockToCanvas.mock.calls;
  expect(typeof options.filterStyles).toBe('function');
  expect(options.filterStyles(element, '--ant-color-primary')).toBe(false);
  expect(options.filterStyles(element, '--custom-color')).toBe(false);
  expect(options.filterStyles(element, 'color')).toBe(true);
  expect(options.filterStyles(element, 'background-color')).toBe(true);
  expect(options.filterStyles(element, 'font-size')).toBe(true);
  expect(options.bgcolor).toBe('white');

  expect(mockAddImage).toHaveBeenCalledWith(
    'data:image/png;base64,mockdata',
    'PNG',
    0,
    0,
    expect.any(Number),
    expect.any(Number),
    undefined,
    'NONE',
  );
  expect(mockSave).toHaveBeenCalledWith('dashboard-export.pdf');
});

test('generates multipage PDF when element height exceeds page boundary', async () => {
  // Canvas height is 3000px, width is 600px -> exceeds single A4 page height (approx 848px)
  mockToCanvas.mockResolvedValue({
    width: 600,
    height: 3000,
  });

  const element = document.createElement('div');
  await renderElementToPdf(element, 'multipage-export.pdf');

  expect(mockAddPage).toHaveBeenCalled();
  expect(mockAddImage.mock.calls.length).toBeGreaterThan(1);
  expect(mockAddImage).toHaveBeenCalledWith(
    'data:image/png;base64,mockdata',
    'PNG',
    0,
    0,
    expect.any(Number),
    expect.any(Number),
    undefined,
    'NONE',
  );
  expect(mockSave).toHaveBeenCalledWith('multipage-export.pdf');
});

test('picks break offsets before any child that would straddle a page boundary (#45885)', () => {
  // Element with 3 stacked children of 330px height each, total 990px.
  // Page height is 848px. Child 2 spans [660, 990], straddling the 848px boundary.
  // calculatePageBreakOffsets should pick break at 660, leaving each block intact.
  const parent = document.createElement('div');
  Object.defineProperty(parent, 'clientWidth', {
    value: 600,
    configurable: true,
  });
  Object.defineProperty(parent, 'clientHeight', {
    value: 990,
    configurable: true,
  });
  jest.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 990,
    left: 0,
    right: 600,
    width: 600,
    height: 990,
  } as DOMRect);

  const block1 = document.createElement('div');
  const block2 = document.createElement('div');
  const block3 = document.createElement('div');

  jest.spyOn(block1, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 330,
    left: 0,
    right: 600,
    width: 600,
    height: 330,
  } as DOMRect);

  jest.spyOn(block2, 'getBoundingClientRect').mockReturnValue({
    top: 330,
    bottom: 660,
    left: 0,
    right: 600,
    width: 600,
    height: 330,
  } as DOMRect);

  jest.spyOn(block3, 'getBoundingClientRect').mockReturnValue({
    top: 660,
    bottom: 990,
    left: 0,
    right: 600,
    width: 600,
    height: 330,
  } as DOMRect);

  parent.appendChild(block1);
  parent.appendChild(block2);
  parent.appendChild(block3);

  const slices = calculatePageBreakOffsets(parent, 600, 990, 848);
  expect(slices).toEqual([
    { sourceY: 0, sourceHeight: 660 },
    { sourceY: 660, sourceHeight: 330 },
  ]);
});

test('picks break offsets for nested descendant elements wrapped in a full-height container (#45885)', () => {
  // Simulates .dashboard containing a single full-height .dashboard-content wrapper,
  // which in turn contains three 330px chart blocks. The 990px wrapper exceeds page
  // height (848px) and is ignored, while descendant blocks are inspected.
  const parent = document.createElement('div');
  parent.className = 'dashboard';
  Object.defineProperty(parent, 'clientWidth', {
    value: 600,
    configurable: true,
  });
  Object.defineProperty(parent, 'clientHeight', {
    value: 990,
    configurable: true,
  });
  jest.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 990,
    left: 0,
    right: 600,
    width: 600,
    height: 990,
  } as DOMRect);

  const wrapper = document.createElement('div');
  wrapper.className = 'dashboard-content';
  jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 990,
    left: 0,
    right: 600,
    width: 600,
    height: 990,
  } as DOMRect);

  const block1 = document.createElement('div');
  const block2 = document.createElement('div');
  const block3 = document.createElement('div');

  jest.spyOn(block1, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 330,
    left: 0,
    right: 600,
    width: 600,
    height: 330,
  } as DOMRect);

  jest.spyOn(block2, 'getBoundingClientRect').mockReturnValue({
    top: 330,
    bottom: 660,
    left: 0,
    right: 600,
    width: 600,
    height: 330,
  } as DOMRect);

  jest.spyOn(block3, 'getBoundingClientRect').mockReturnValue({
    top: 660,
    bottom: 990,
    left: 0,
    right: 600,
    width: 600,
    height: 330,
  } as DOMRect);

  wrapper.appendChild(block1);
  wrapper.appendChild(block2);
  wrapper.appendChild(block3);
  parent.appendChild(wrapper);

  const slices = calculatePageBreakOffsets(parent, 600, 990, 848);
  expect(slices).toEqual([
    { sourceY: 0, sourceHeight: 660 },
    { sourceY: 660, sourceHeight: 330 },
  ]);
});

test('falls back safely when a single child is taller than an entire page', () => {
  const parent = document.createElement('div');
  Object.defineProperty(parent, 'clientWidth', {
    value: 600,
    configurable: true,
  });
  Object.defineProperty(parent, 'clientHeight', {
    value: 2000,
    configurable: true,
  });
  jest.spyOn(parent, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 2000,
    left: 0,
    right: 600,
    width: 600,
    height: 2000,
  } as DOMRect);

  const tallChild = document.createElement('div');
  jest.spyOn(tallChild, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 2000,
    left: 0,
    right: 600,
    width: 600,
    height: 2000,
  } as DOMRect);
  parent.appendChild(tallChild);

  const slices = calculatePageBreakOffsets(parent, 600, 2000, 800);
  expect(slices).toEqual([
    { sourceY: 0, sourceHeight: 800 },
    { sourceY: 800, sourceHeight: 800 },
    { sourceY: 1600, sourceHeight: 400 },
  ]);
});

test('returns a single slice without looping when pageHeightPx is zero', () => {
  const parent = document.createElement('div');
  expect(calculatePageBreakOffsets(parent, 0, 500, 0)).toEqual([
    { sourceY: 0, sourceHeight: 500 },
  ]);
});

test('captures an expanded clone instead of the live element and cleans up (#45885)', async () => {
  const element = document.createElement('div');
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'scroll-container';
  scrollContainer.style.overflow = 'auto';
  scrollContainer.style.height = '50px';
  const content = document.createElement('div');
  content.textContent = 'wide table content';
  scrollContainer.appendChild(content);
  element.appendChild(scrollContainer);
  document.body.appendChild(element);

  try {
    await renderElementToPdf(element, 'expanded-export.pdf');

    const [[target]] = mockToCanvas.mock.calls;
    expect(target).not.toBe(element);
    const clonedScroll = (target as HTMLElement).querySelector(
      '.scroll-container',
    ) as HTMLElement;
    expect(clonedScroll.style.height).toBe('auto');
    expect(clonedScroll.style.maxHeight).toBe('none');
    expect(clonedScroll.style.overflow).toBe('visible');
    expect(
      document.body.querySelectorAll('div[style*="-20000px"]'),
    ).toHaveLength(0);
  } finally {
    element.remove();
  }
});

test('clips horizontal overflow on dashboard clones while expanding vertically (#45885)', async () => {
  const element = document.createElement('div');
  element.className = 'dashboard';
  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'scroll-container';
  scrollContainer.style.overflow = 'auto';
  scrollContainer.style.height = '50px';
  element.appendChild(scrollContainer);
  document.body.appendChild(element);

  try {
    await renderElementToPdf(element, 'dashboard-export.pdf');

    const [[target]] = mockToCanvas.mock.calls;
    const clonedScroll = (target as HTMLElement).querySelector(
      '.scroll-container',
    ) as HTMLElement;
    expect(clonedScroll.style.overflowX).toBe('clip');
    expect(clonedScroll.style.overflowY).toBe('visible');
  } finally {
    element.remove();
  }
});

test('forwards positive clone scroll dimensions to toCanvas and cleans up on error', async () => {
  const element = document.createElement('div');
  const origCloneNode = element.cloneNode.bind(element);
  jest.spyOn(element, 'cloneNode').mockImplementation(deep => {
    const cloned = origCloneNode(deep) as HTMLElement;
    Object.defineProperty(cloned, 'scrollWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(cloned, 'scrollHeight', {
      value: 1600,
      configurable: true,
    });
    return cloned;
  });
  document.body.appendChild(element);

  try {
    await renderElementToPdf(element, 'sized-export.pdf');
    const [[, options]] = mockToCanvas.mock.calls;
    expect(options.width).toBe(800);
    expect(options.height).toBe(1600);

    mockToCanvas.mockRejectedValueOnce(new Error('capture failed'));
    await expect(renderElementToPdf(element, 'fail.pdf')).rejects.toThrow(
      'capture failed',
    );
    expect(
      document.body.querySelectorAll('div[style*="-20000px"]'),
    ).toHaveLength(0);
  } finally {
    element.remove();
  }
});

test('computes page break offsets from the expanded clone rather than the live clipped element (#45885)', async () => {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', {
    value: 600,
    configurable: true,
  });
  Object.defineProperty(element, 'clientHeight', {
    value: 400,
    configurable: true,
  });
  jest.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 400,
    left: 0,
    right: 600,
    width: 600,
    height: 400,
  } as DOMRect);

  const origCloneNode = element.cloneNode.bind(element);
  jest.spyOn(element, 'cloneNode').mockImplementation(deep => {
    const cloned = origCloneNode(deep) as HTMLElement;
    Object.defineProperty(cloned, 'clientWidth', {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(cloned, 'scrollWidth', {
      value: 600,
      configurable: true,
    });
    Object.defineProperty(cloned, 'scrollHeight', {
      value: 990,
      configurable: true,
    });
    jest.spyOn(cloned, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 990,
      left: 0,
      right: 600,
      width: 600,
      height: 990,
    } as DOMRect);
    const wrapper = document.createElement('div');
    wrapper.className = 'dashboard-content';
    jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 990,
      left: 0,
      right: 600,
      width: 600,
      height: 990,
    } as DOMRect);
    for (let i = 0; i < 3; i += 1) {
      const block = document.createElement('div');
      jest.spyOn(block, 'getBoundingClientRect').mockReturnValue({
        top: i * 330,
        bottom: (i + 1) * 330,
        left: 0,
        right: 600,
        width: 600,
        height: 330,
      } as DOMRect);
      wrapper.appendChild(block);
    }
    cloned.appendChild(wrapper);
    return cloned;
  });

  mockToCanvas.mockResolvedValue({ width: 600, height: 990 });
  document.body.appendChild(element);

  try {
    await renderElementToPdf(element, 'clone-breaks.pdf');

    // Page 1 breaks cleanly before the third 330px block (at 660px, not 848px)
    const ptPerPx = 595.28 / 600;
    expect(mockAddImage).toHaveBeenCalledTimes(2);
    expect(mockAddImage.mock.calls[0][5]).toBeCloseTo(660 * ptPerPx, 2);
    expect(mockAddImage.mock.calls[1][5]).toBeCloseTo(330 * ptPerPx, 2);
  } finally {
    element.remove();
  }
});
