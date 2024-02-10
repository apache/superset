// import { Meta, Source } from '@storybook/addon-docs';
import Markdown from 'markdown-to-jsx';

export default {
  title: 'Design System/Components/DropdownContainer/Overview',
};

export const Overview = () => (
  <Markdown>
    {`
# Usage

The dropdown container is used to display elements horizontally in a responsive way. If the elements don't fit in
the available width, they are displayed vertically in a dropdown. Some of the common applications in Superset are:

- Display chart filters in the CRUD views
- Horizontally display native filters in a dashboard

# Variations

The component accepts any React element which ensures a high level of variability in Superset.

To check the component in detail and its interactions, check the [DropdownContainer](/story/design-system-components-dropdowncontainer--component) page.

    `}
    </Markdown>
);
