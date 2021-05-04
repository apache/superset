import React from 'react';
import { mount } from 'enzyme';
import {
  styled,
  supersetTheme,
  SupersetThemeProps,
  useTheme,
  ThemeProvider,
  EmotionCacheProvider,
  emotionCache,
} from '@superset-ui/core';

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

  describe('useTheme()', () => {
    it('returns the theme', () => {
      function ThemeUser() {
        expect(useTheme()).toStrictEqual(supersetTheme);
        return <div>test</div>;
      }
      mount(<ThemeUser />, {
        wrappingComponent: ({ children }) => (
          <EmotionCacheProvider value={emotionCache}>
            <ThemeProvider theme={supersetTheme}>{children}</ThemeProvider>
          </EmotionCacheProvider>
        ),
      });
    });

    it('throws when a theme is not present', () => {
      function ThemeUser() {
        expect(useTheme).toThrow(/could not find a ThemeContext/);
        return <div>test</div>;
      }
      mount(<ThemeUser />, {
        wrappingComponent: ({ children }) => <div>{children}</div>,
      });
    });
  });
});
