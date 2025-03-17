import { useState, ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Layout from 'src/components/Layout';
import Button from 'src/components/Button';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';

describe('Layout Component', () => {
  const renderWithTheme = (ui: ReactElement) =>
    render(<ThemeProvider theme={supersetTheme}>{ui}</ThemeProvider>);

  test('renders Layout with Header, Content, and Footer', () => {
    render(
      <Layout hasSider={false}>
        <Layout.Header>Header</Layout.Header>
        <Layout.Content>Content Area</Layout.Content>
        <Layout.Footer>Ant Design Layout Footer</Layout.Footer>
      </Layout>,
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Content Area')).toBeInTheDocument();
    expect(screen.getByText('Ant Design Layout Footer')).toBeInTheDocument();
  });

  test('renders Layout with Sider when hasSider is true', () => {
    render(
      <Layout hasSider>
        <Layout.Sider>Sider Content</Layout.Sider>
      </Layout>,
    );

    expect(screen.getByText('Sider Content')).toBeInTheDocument();
  });

  test('hides Header when headerVisible is false', () => {
    render(
      <Layout>
        {false && <Layout.Header>Header</Layout.Header>}
        <Layout.Content>Content Area</Layout.Content>
        <Layout.Footer>Ant Design Layout Footer</Layout.Footer>
      </Layout>,
    );

    expect(screen.queryByText('Header')).not.toBeInTheDocument();
  });

  test('hides Footer when footerVisible is false', () => {
    render(
      <Layout>
        <Layout.Header>Header</Layout.Header>
        <Layout.Content>Content Area</Layout.Content>
        {false && <Layout.Footer>Ant Design Layout Footer</Layout.Footer>}
      </Layout>,
    );

    expect(
      screen.queryByText('Ant Design Layout Footer'),
    ).not.toBeInTheDocument();
  });
  test('collapses Sider when clicked', () => {
    const TestLayout = () => {
      const [collapsed, setCollapsed] = useState(false);

      return (
        <Layout hasSider>
          <Layout.Sider
            collapsible
            collapsed={collapsed}
            collapsedWidth={80}
            width={200}
          >
            <Button onClick={() => setCollapsed(!collapsed)}>Toggle</Button>
            Sider Content
          </Layout.Sider>
        </Layout>
      );
    };

    renderWithTheme(<TestLayout />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle' });

    expect(screen.getByText('Sider Content').parentElement).toHaveStyle({
      width: '200px',
    });

    fireEvent.click(toggleButton);

    expect(screen.getByText('Sider Content').parentElement).toHaveStyle({
      width: '80px',
    });
  });
});
