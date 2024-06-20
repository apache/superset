import { type ThemeConfig } from 'antd-v5';
import { SupersetTheme } from '..';

export const getBaseConfigWithOverrides = (
  supersetTheme: SupersetTheme,
): ThemeConfig => ({
  token: {
    borderRadius: supersetTheme.borderRadius,
    colorBgBase: supersetTheme.colors.primary.light4,
    colorError: supersetTheme.colors.error.base,
    colorInfo: supersetTheme.colors.info.base,
    colorLink: supersetTheme.colors.grayscale.dark1,
    colorPrimary: supersetTheme.colors.primary.base,
    colorSuccess: supersetTheme.colors.success.base,
    colorTextBase: supersetTheme.colors.grayscale.dark2,
    colorWarning: supersetTheme.colors.warning.base,
    controlHeight: supersetTheme.gridUnit * 32,
    fontFamily: supersetTheme.typography.families.sansSerif,
    fontFamilyCode: supersetTheme.typography.families.monospace,
    fontSize: supersetTheme.typography.sizes.m,
    lineType: 'solid',
    lineWidth: 1,
    sizeStep: supersetTheme.gridUnit,
    sizeUnit: supersetTheme.gridUnit,
    zIndexBase: 0,
    zIndexPopupBase: supersetTheme.zIndex.max,
  },
  components: {
    Badge: {
      paddingXS: supersetTheme.gridUnit * 2,
    },
    Card: {
      colorBgContainer: supersetTheme.colors.grayscale.light4,
      paddingLG: supersetTheme.gridUnit * 6,
      fontWeightStrong: supersetTheme.typography.weights.medium,
    },
  },
});
