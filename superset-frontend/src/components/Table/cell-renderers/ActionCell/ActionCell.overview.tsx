// import { Meta, Source, Story, ArgsTable } from '@storybook/addon-docs';
import Markdown from 'markdown-to-jsx';
// import { ActionMenuItem } from 'src/components/Table/cell-renderers/index';
import ActionCell from './index';

export default {
  title: 'Design System/Components/Table/Cell Renderers/ActionCell/Overview"',
};

export const ActionCell = () => (
  <>
    <Markdown>
      {`
# ActionCell

An ActionCell is used to display an overflow icon that opens a menu allowing the user to take actions
specific to the data in the table row that the cell is a member of.

### [Basic example](./?path=/docs/design-system-components-table-cell-renderers-actioncell--basic)
      `}
    </Markdown>
  </>
);  
