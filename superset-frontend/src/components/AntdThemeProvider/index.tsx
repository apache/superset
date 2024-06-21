import { ConfigProvider, type ConfigProviderProps } from 'antd-v5';
import { getTheme, ThemeType } from 'src/theme/index';

export const AntdThemeProvider = ({ theme, children }: ConfigProviderProps) => (
  <ConfigProvider theme={theme || getTheme(ThemeType.LIGHT)} prefixCls="antd5">
    {children}
  </ConfigProvider>
);
