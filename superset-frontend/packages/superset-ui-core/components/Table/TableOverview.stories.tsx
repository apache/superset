/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import Markdown from 'markdown-to-jsx';

export default {
  title: 'Design System/Components/Table"',
};

export const Overview = () => (
  <>
    <Markdown>
      {`
# Table

A table is UI that allows the user to explore data in a tabular format.

## Usage

Common table applications in Superset:

- Display lists of user-generated entities (e.g. dashboard, charts, queries) for further exploration and use
- Display data that can help the user make a decision (e.g. query results)

This component provides a general use Table.

---

### [Basic example](./?path=/docs/design-system-components-table-examples--basic)

`}
    </Markdown>

    <Markdown>
      {`
### Data and Columns

To set the visible columns and data for the table you use the \`columns\` and \`data\` props.

The basic table example for the \`columns\` prop is:

\`\`\`
const basicColumns: = [
  {
    title: 'Name',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    sorter: (a: BasicData, b: BasicData) =>
      alphabeticalSort('name', a, b),
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    sorter: (a: BasicData, b: BasicData) =>
      alphabeticalSort('category', a, b),
  },
  {
    title: 'Price',
    dataIndex: 'price',
    key: 'price',
    sorter: (a: BasicData, b: BasicData) =>
      numericalSort('price', a, b),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
  },
];
\`\`\`

The data prop is:

\`\`\`
const basicData: = [
  {
    key: 1,
    name: 'Floppy Disk 10 pack',
    category: 'Disk Storage',
    price: '9.99'
    description: 'A real blast from the past',
  },
  {
    key: 2,
    name: 'DVD 100 pack',
    category: 'Optical Storage',
    price: '27.99'
    description: 'Still pretty ancient',
  },
  {
    key: 3,
    name: '128 GB SSD',
    category: 'Harddrive',
    price: '49.99'
    description: 'Reliable and fast data storage',
  },
];
\`\`\`

### Column Sort Functions

To ensure consistency for column sorting and to avoid redundant definitions for common column sorters, reusable sort functions are provided.
When defining the object for the \`columns\` prop you can provide an optional attribute \`sorter\`.
The function provided in the \`sorter\` prop is given the entire record representing a row as props \`a\` and \`b\`.
When using a provided sorter function the pattern is to wrap the call to the sorter with an inline function, then specify the specific attribute value from \`dataIndex\`, representing a column
of the data object for that row, as the first argument of the sorter function.

#### alphabeticalSort

The alphabeticalSort is for columns that display a string of text.

\`\`\`
import { alphabeticalSort } from 'src/components/Table/sorters';

const basicColumns = [
  {
    title: 'Column Name',
    dataIndex: 'columnName',
    key: 'columnName',
    sorter: (a, b) =>
      alphabeticalSort('columnName', a, b),
  }
]
\`\`\`

#### numericSort

The numericalSort is for columns that display a numeric value.


\`\`\`
import { numericalSort } from './sorters';

const basicColumns = [
  {
    title: 'Height',
    dataIndex: 'height',
    key: 'height',
    sorter: (a, b) =>
      numericalSort('height', a, b),
  }
]
\`\`\`

If a different sort option is needed, consider adding it as a reusable sort function following the pattern provided above.

---

### [Cell Content Renderers](./?path=/docs/design-system-components-table-examples--cell-renderers)

By default, each column will render the value as simple text. Often you will want to show formatted values, such as a numeric column showing as currency, or a more complex component such as a button or action menu as a cell value.
Cell Renderers are React components provided to the optional \`render\` attribute on a column definition that enables injecting a specific React component to enable this.

`}
    </Markdown>
    <Markdown>
      {`

For convenience and consistency, the Table component provides pre-built Cell Renderers for:
The following data types can be displayed in table cells.

- Text (default)
- [Button Cell](./?path=/docs/design-system-components-table-cell-renderers-buttoncell--basic)
- [Numeric Cell](./docs/design-system-components-table-cell-renderers-numericcell--basic)
  - Support Locale and currency formatting
  - w/ icons - Coming Soon
- [Action Menu Cell](./?path=/docs/design-system-components-table-cell-renderers-actioncell-overview--page)
- Provide a list of menu options with callback functions that retain a reference to the row the menu is defined for
- Custom
  - You can provide your own React component as a cell renderer in cases not supported

---

### [Loading](./?path=/docs/design-system-components-table-examples--loading)

The table can be set to a loading state simply by setting the loading prop to true | false

  `}
    </Markdown>
    <Markdown>
      {`
---

### [Pagination](./?path=/docs/design-system-components-table-examples--pagination)

The table displays a set number of rows at a time, the user navigates the table via pagination. Use in scenarios where the user is searching for a specific piece of content.
The default page size and page size options for the menu are configurable via the \`pageSizeOptions\` and \`defaultPageSize\` props.
NOTE: Pagination controls will only display when the data for the table has more records than the default page size.
`}
    </Markdown>
    <Markdown>
      {`

\`\`\`
<Table pageSizeOptions={[5, 10, 15, 20, 25] defaultPageSize={10} />
\`\`\`

---

### [Server Pagination](./?path=/docs/design-system-components-table-examples--server-pagination)

The table can be configured for async data fetching to get partial data sets while showing pagination controls that let the user navigate through data.
To override the default paging, which uses \`data.length\` to determine the record count, populate the \`recordCount\` prop with the total number of records
contained in the dataset on the server being paged through. When the user navigates through the paged data it will invoke the \`onChange\` callback
function enabling data fetching to occur when the user changes the page.

`}
    </Markdown>
    <Markdown>
      {`

\`\`\`
interface BasicData {
  name: string;
  category: string;
  price: number;
  description?: string;
  key: number;
}

const generateData = (startIndex: number, pageSize: number): BasicData[] => {
  const data: BasicData[] = [];
  for (let i = 0; i < pageSize; i += 1) {
    const recordIndex = startIndex + i;
    data.push({
      key: recordIndex,
      name: \`Dynamic Record \${recordIndex}\`,
      category: 'Disk Storage',
      price: recordIndex * 2.59,
      description: 'A random description',
    });
  }
  return data;
};

const ServerPaginationTable = () => {
  const [data, setData] = useState(generateData(0, 5));
  const [loading, setLoading] = useState(false);
  // This should really be calculated server side for the data set being paged through
  const recordCount = 5000;

  const handleChange = (pagination: TablePaginationConfig) => {
    const pageSize = pagination?.pageSize ?? 5;
    const current = pagination?.current ?? 0;
    setLoading(true);
    // simulate a fetch
    setTimeout(() => {
      setData(generateData(current * pageSize, pageSize));
      setLoading(false);
    }, 1000);
  };

  return (
    <Table
      columns: paginationColumns,
      size: TableSize.SMALL,
      pageSizeOptions: ['10', '20', '50'],
      defaultPageSize: 10,
      data={data}
      recordCount={5000}
      onChange={handleChange}
      loading={loading}
    />
  );
};
\`\`\`

---

### [Virtualization for Performance](./?path=/docs/design-system-components-table-examples--virtualized-performance)

Table virtualization can enable viewing data with many columns and/or rows.
Virtualization can be enabled via the \`virtualize\` prop.

NOTE: Row event handlers will be ignored when table is running with \`virtualize={true}\`.
Support for row event handlers may be added in future versions of the Table.

`}
    </Markdown>
    <Markdown>
      {`

---

## Integration Checklist

The following specifications are required every time a table is used. These choices should be intentional based on the specific user needs for the table instance.

<details>

- [ ] Size
  - Large
  - Small
- Columns
  - [ ] Number of
  - [ ] Contents
  - [ ] Order
  - [ ] Widths
- Column headers
  - [ ] Labels
  - [ ] Has tooltip
    - [ ] Tooltip text
- [ ] Default sort
- Functionality
  - [ ] Can sort columns
  - [ ] Can filter columns
- [ ] Loading
  - Pagination
    - [ ] Number of rows per page
  - Infinite scroll
- [ ] Has toolbar
  - [ ] Has table title
    - [ ] Label
  - [ ] Has buttons
    - [ ] Labels
    - [ ] Actions
  - [ ] Has search

</details>

---

## Experimental features

The Table component has features that are still experimental and can be used at your own risk.
These features are intended to be made fully stable in future releases.

### [Resizable Columns](./?path=/docs/design-system-components-table-examples--resizable-columns)

The prop \`resizable\` enables table columns to be resized by the user dragging from the right edge of each
column to increase or decrease the columns' width

`}
    </Markdown>
    <Markdown>
      {`

### [Drag & Drop Columns](./?path=/docs/design-system-components-table-examples--reorderable-columns)

The prop \`reorderable\` can enable column drag and drop reordering as well as dragging a column to another component. If you want to accept the drop event of a Table Column
you can register \`onDragOver\` and \`onDragDrop\` event handlers on the destination component. In the \`onDragDrop\` handler you can check for \`SUPERSET_TABLE_COLUMN\`
as the getData key as shown below.

\`\`\`
import { SUPERSET_TABLE_COLUMN } from 'src/components/table';

const handleDrop = (ev:Event) => {
  const json = ev.dataTransfer?.getData?.(SUPERSET_TABLE_COLUMN);
  const data = JSON.parse(json);
  // ... do something with the data here
}
\`\`\`
`}
    </Markdown>
  </>
);
