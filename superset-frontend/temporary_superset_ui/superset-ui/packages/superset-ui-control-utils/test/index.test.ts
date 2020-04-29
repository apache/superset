import { sections } from '../src';

describe('@superset-ui/control-utils', () => {
  it('exports sections', () => {
    expect(sections).toBeDefined();
    expect(sections.datasourceAndVizType).toBeDefined();
  });
});
