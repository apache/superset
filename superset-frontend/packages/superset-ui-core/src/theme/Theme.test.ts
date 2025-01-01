import { Theme } from './Theme';
import tinycolor from 'tinycolor2';

describe('Theme', () => {
  it('initializes with default system colors and light mode', () => {
    const theme = new Theme();
    const result = theme.getTheme();
    expect(result).toBeDefined();
    expect(result.colors.primary.base).toBe('#20a7c9');
    expect(result.colors.grayscale.base).toBe('#666666');
  });

  it('initializes with custom system colors and dark mode', () => {
    const customColors = {
      primary: '#123456',
      secondary: '#654321',
    };
    const theme = new Theme(customColors, true);
    const result = theme.getTheme();
    expect(result.colors.primary.base).toBe('#123456');
    expect(result.colors.secondary.base).toBe('#654321');
    expect(result.colors.darkest).toBe('#FFF');
    expect(result.colors.lightest).toBe('#000');
  });

  it('throws an error if getTheme is called before initialization', () => {
    const theme = new Theme();
    theme['theme'] = null; // Simulating uninitialized theme
    expect(() => theme.getTheme()).toThrow('Theme is not initialized.');
  });

  it('adjusts colors correctly', () => {
    const theme = new Theme();
    const adjustColorSpy = jest.spyOn(theme as any, 'adjustColor');
    const lighterColor = theme['adjustColor']('#123456', 20, 'white');
    expect(adjustColorSpy).toHaveBeenCalledWith('#123456', 20, 'white');
    expect(tinycolor(lighterColor).isValid()).toBe(true);
  });

  it('swaps light and dark colors correctly', () => {
    const theme = new Theme();
    const colors = {
      base: '#123456',
      light1: '#abcdef',
      light2: '#cdefab',
      light3: '#efabcd',
      light4: '#fabced',
      light5: '#ffabcd',
      dark1: '#654321',
      dark2: '#543210',
      dark3: '#43210f',
      dark4: '#3210fe',
      dark5: '#210fed',
    };
    const swappedColors = theme['swapLightAndDark'](colors);
    expect(swappedColors.light1).toBe('#654321');
    expect(swappedColors.dark1).toBe('#abcdef');
  });

  it('filters out deny-listed colors from the AntD theme', () => {
    const theme = new Theme();
    const filteredTheme = theme['getFilteredAntdTheme']();
    Theme['denyList'].forEach(denyRegex => {
      Object.keys(filteredTheme).forEach(key => {
        expect(denyRegex.test(key)).toBe(false);
      });
    });
  });

  it('handles empty AntD theme gracefully', () => {
    const theme = new Theme();
    theme['antdTheme'] = {};
    const filteredTheme = theme['getFilteredAntdTheme']();
    expect(Object.keys(filteredTheme).length).toBe(0);
  });

  it('generates AntD seed correctly', () => {
    const theme = new Theme();
    const antdSeed = theme['getAntdSeed']();
    expect(antdSeed.borderRadius).toBe(4);
    expect(antdSeed.colorPrimary).toBe('#20a7c9');
  });

  it('sets AntD theme correctly based on dark mode', () => {
    const lightTheme = new Theme();
    expect(lightTheme.antdConfig?.algorithm).toBeDefined();

    const darkTheme = new Theme(undefined, true);
    expect(darkTheme.antdConfig?.algorithm).toBeDefined();
  });

  it('sets theme with custom colors and updates systemColors', () => {
    const customColors = {
      primary: '#123456',
      success: '#00ff00',
    };
    const theme = new Theme(customColors, false);
    expect(theme.getTheme().colors.primary.base).toBe('#123456');
    expect(theme.getTheme().colors.success.base).toBe('#00ff00');
    expect(theme.getTheme().colors.darkest).toBe('#000');
    expect(theme.getTheme().colors.lightest).toBe('#FFF');
  });

  it('sets theme in dark mode', () => {
    const customColors = {
      primary: '#123456',
      success: '#00ff00',
    };
    const theme = new Theme(customColors, true);
    expect(theme.getTheme().colors.darkest).toBe('#FFF');
    expect(theme.getTheme().colors.lightest).toBe('#000');
  });

  it('ensures all denyList patterns are tested', () => {
    Theme['denyList'].forEach(pattern => {
      expect(pattern).toBeInstanceOf(RegExp);
    });
  });
  test('getLegacySupersetTheme handles dark theme', () => {
    const theme = new Theme();
    const result = theme['getLegacySupersetTheme'](theme['systemColors'], true);
    expect(result.colors.darkest).toBe('#FFF');
    expect(result.colors.lightest).toBe('#000');
  });
  test('getLegacySupersetTheme handles light theme by default', () => {
    const theme = new Theme();
    const result = theme['getLegacySupersetTheme'](theme['systemColors']);
    expect(result.colors.darkest).toBe('#000');
    expect(result.colors.lightest).toBe('#FFF');
  });
});
