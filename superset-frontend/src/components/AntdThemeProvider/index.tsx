import { ConfigProvider, type ConfigProviderProps } from 'antd-v5';
import { getLightThemeWithOverrides } from 'packages/superset-ui-core/src/style/antd/light';
import { theme as supersetTheme } from 'src/preamble';

export const AntdThemeProvider = ({ children, theme }: ConfigProviderProps) => (
  <ConfigProvider
    theme={theme || getLightThemeWithOverrides(supersetTheme)}
    prefixCls="antd5"
  >
    {children}
  </ConfigProvider>
);
