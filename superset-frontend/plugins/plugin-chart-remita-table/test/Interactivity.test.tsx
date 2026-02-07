import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import testData from './testData';

function renderChart(override: any = {}) {
  return render(
    <ThemeProvider theme={supersetTheme}>
      <TableChart
        {...transformProps({
          ...testData.basic,
          rawFormData: {
            ...(testData.basic as any).rawFormData,
            enable_column_visibility: true,
            enable_invert_selection: true,
            include_search: true,
          },
        } as any)}
        sticky={false}
        show_split_buttons_in_slice_header={false}
        retain_selection_accross_navigation={false}
        enable_bulk_actions={true}
        selection_enabled={true}
        include_row_numbers={false}
        bulk_action_id_column={'name'}
        selection_mode={'multiple'}
        enable_table_actions={false}
        table_actions_id_column={'id'}
        split_actions={new Set()}
        non_split_actions={new Set()}
        table_actions={new Set()}
        slice_id={'test-slice'}
        {...override}
      />
    </ThemeProvider>
  );
}

describe('Interactivity', () => {
  it('Column visibility menu appears and hides a column', async () => {
    renderChart();
    // Ensure a known header is present
    expect(screen.getByText('__timestamp')).toBeInTheDocument();
    // Open columns menu
    const btn = screen.getByRole('button', { name: /columns/i });
    await userEvent.click(btn);
    // Uncheck the timestamp column
    const item = screen.getByText('__timestamp');
    const row = item.closest('span');
    const cb = row?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(cb).toBeTruthy();
    await userEvent.click(cb!);
    // Close menu by clicking button again
    await userEvent.click(btn);
    // Header should no longer be present (hidden)
    await screen.findByText(/Columns/); // ensure re-render
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByText('__timestamp')).not.toBeInTheDocument();
  });

  it('Invert selection button appears when enabled and server pagination on', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps({
            ...testData.basic,
            rawFormData: {
              ...(testData.basic as any).rawFormData,
              enable_invert_selection: true,
              server_pagination: true,
            },
          } as any)}
          sticky={false}
          show_split_buttons_in_slice_header={false}
          retain_selection_accross_navigation={false}
          enable_bulk_actions={true}
          selection_enabled={true}
          include_row_numbers={false}
          bulk_action_id_column={'name'}
          selection_mode={'multiple'}
          enable_table_actions={false}
          table_actions_id_column={'id'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          table_actions={new Set()}
          slice_id={'test-slice'}
        />
      </ThemeProvider>
    );
    // Invert button should be present next to the selection tag
    const invert = await screen.findByRole('button', { name: /invert/i });
    expect(invert).toBeInTheDocument();
  });

  it('Shows column resizer when enabled', async () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <TableChart
          {...transformProps({
            ...testData.basic,
            rawFormData: {
              ...(testData.basic as any).rawFormData,
              enable_column_resize: true,
            },
          } as any)}
          sticky={false}
          show_split_buttons_in_slice_header={false}
          retain_selection_accross_navigation={false}
          enable_bulk_actions={true}
          selection_enabled={true}
          include_row_numbers={false}
          bulk_action_id_column={'name'}
          selection_mode={'multiple'}
          enable_table_actions={false}
          table_actions_id_column={'id'}
          split_actions={new Set()}
          non_split_actions={new Set()}
          table_actions={new Set()}
          slice_id={'test-slice'}
        />
      </ThemeProvider>
    );
    // one or more resizer handles should exist
    const resizers = await screen.findAllByTitle(/drag to resize column/i);
    expect(resizers.length).toBeGreaterThan(0);
  });
});
