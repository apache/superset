import React from 'react';
import { theme, useConfig } from 'docz';
import { ThemeProvider } from 'theme-ui';
import SEO from '../components/seo';
import Layout from '../components/layout';
import NextLinks from '../components/next';

import 'antd/dist/antd.css';

interface Props {
  children: React.ReactNode,
}

const Theme = ({ children }: Props) => {
  const config = useConfig();
  return (
    <ThemeProvider theme={config}>
      <Layout>
        <SEO title="Documents" />
        {children}
        <div>
          <NextLinks />
        </div>
      </Layout>
    </ThemeProvider>
  );
};

// @ts-ignore
export default theme()(Theme);
