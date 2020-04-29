import styled, { supersetTheme, SupersetThemeProps } from '../src';

describe('@superset-ui/style package', () => {
  it('exports a theme', () => {
    expect(typeof supersetTheme).toBe('object');
  });

  it('exports styled component templater', () => {
    expect(typeof styled.div).toBe('function');
  });

  it('exports SupersetThemeProps', () => {
    const props: SupersetThemeProps = {
      theme: supersetTheme,
    };
    expect(typeof props).toBe('object');
  });
});
