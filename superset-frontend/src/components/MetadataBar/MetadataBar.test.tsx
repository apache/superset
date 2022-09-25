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
import React from 'react';
import { render, screen, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import * as resizeDetector from 'react-resize-detector';
import moment from 'moment';
import { supersetTheme } from '@superset-ui/core';
import { hexToRgb } from 'src/utils/colorUtils';
import MetadataBar, {
  MIN_NUMBER_ITEMS,
  MAX_NUMBER_ITEMS,
  ContentType,
  MetadataType,
} from '.';

const DASHBOARD_TITLE = 'Added to 452 dashboards';
const DASHBOARD_DESCRIPTION =
  'To preview the list of dashboards go to "More" settings on the right.';
const DESCRIPTION_VALUE = 'This is the description';
const ROWS_TITLE = '500 rows';
const SQL_TITLE = 'Click to view query';
const TABLE_TITLE = 'database.schema.table';
const CREATED_BY = 'Jane Smith';
const DATE = new Date(Date.parse('2022-01-01'));
const MODIFIED_BY = 'Jane Smith';
const OWNERS = ['John Doe', 'Mary Wilson'];
const TAGS = ['management', 'research', 'poc'];

const runWithBarCollapsed = async (func: Function) => {
  const spy = jest.spyOn(resizeDetector, 'useResizeDetector');
  spy.mockReturnValue({ width: 80, ref: { current: undefined } });
  await func();
  spy.mockRestore();
};

const ITEMS: ContentType[] = [
  {
    type: MetadataType.DASHBOARDS,
    title: DASHBOARD_TITLE,
    description: DASHBOARD_DESCRIPTION,
  },
  {
    type: MetadataType.DESCRIPTION,
    value: DESCRIPTION_VALUE,
  },
  {
    type: MetadataType.LAST_MODIFIED,
    value: DATE,
    modifiedBy: MODIFIED_BY,
  },
  {
    type: MetadataType.OWNER,
    createdBy: CREATED_BY,
    owners: OWNERS,
    createdOn: DATE,
  },
  {
    type: MetadataType.ROWS,
    title: ROWS_TITLE,
  },
  {
    type: MetadataType.SQL,
    title: SQL_TITLE,
  },
  {
    type: MetadataType.TABLE,
    title: TABLE_TITLE,
  },
  {
    type: MetadataType.TAGS,
    values: TAGS,
  },
];

test('renders an array of items', () => {
  render(<MetadataBar items={ITEMS.slice(0, 2)} />);
  expect(screen.getByText(DASHBOARD_TITLE)).toBeInTheDocument();
  expect(screen.getByText(DESCRIPTION_VALUE)).toBeInTheDocument();
});

test('throws errors when out of min/max restrictions', () => {
  const spy = jest.spyOn(console, 'error');
  spy.mockImplementation(() => {});
  expect(() =>
    render(<MetadataBar items={ITEMS.slice(0, MIN_NUMBER_ITEMS - 1)} />),
  ).toThrow(
    `The minimum number of items for the metadata bar is ${MIN_NUMBER_ITEMS}.`,
  );
  expect(() =>
    render(<MetadataBar items={ITEMS.slice(0, MAX_NUMBER_ITEMS + 1)} />),
  ).toThrow(
    `The maximum number of items for the metadata bar is ${MAX_NUMBER_ITEMS}.`,
  );
  spy.mockRestore();
});

test('removes duplicated items when rendering', () => {
  render(<MetadataBar items={[...ITEMS.slice(0, 2), ...ITEMS.slice(0, 2)]} />);
  expect(screen.getAllByRole('img').length).toBe(2);
});

test('collapses the bar when min width is reached', async () => {
  await runWithBarCollapsed(() => {
    render(<MetadataBar items={ITEMS.slice(0, 2)} />);
    expect(screen.queryByText(DASHBOARD_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText(DESCRIPTION_VALUE)).not.toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBe(2);
  });
});

test('always renders a tooltip when the bar is collapsed', async () => {
  await runWithBarCollapsed(async () => {
    render(<MetadataBar items={ITEMS.slice(0, 2)} />);
    userEvent.hover(screen.getAllByRole('img')[0]);
    expect(await screen.findByText(DASHBOARD_DESCRIPTION)).toBeInTheDocument();
    userEvent.hover(screen.getAllByRole('img')[1]);
    expect(await screen.findByText(DESCRIPTION_VALUE)).toBeInTheDocument();
  });
});

test('renders a tooltip when one is provided even if not collapsed', async () => {
  render(<MetadataBar items={ITEMS.slice(0, 2)} />);
  expect(screen.getByText(DASHBOARD_TITLE)).toBeInTheDocument();
  userEvent.hover(screen.getAllByRole('img')[0]);
  expect(await screen.findByText(DASHBOARD_DESCRIPTION)).toBeInTheDocument();
});

test('renders underlined text and emits event when clickable', () => {
  const onClick = jest.fn();
  const items = [{ ...ITEMS[0], onClick }, ITEMS[1]];
  render(<MetadataBar items={items} />);
  const element = screen.getByText(DASHBOARD_TITLE);
  userEvent.click(element);
  expect(onClick).toHaveBeenCalled();
  const style = window.getComputedStyle(element);
  expect(style.textDecoration).toBe('underline');
});

test('renders clicable items with blue icons when the bar is collapsed', async () => {
  await runWithBarCollapsed(async () => {
    const onClick = jest.fn();
    const items = [{ ...ITEMS[0], onClick }, ITEMS[1]];
    render(<MetadataBar items={items} />);
    const images = screen.getAllByRole('img');
    const clickableColor = window.getComputedStyle(images[0]).color;
    const nonClickableColor = window.getComputedStyle(images[1]).color;
    expect(clickableColor).toBe(hexToRgb(supersetTheme.colors.primary.base));
    expect(nonClickableColor).toBeFalsy();
  });
});

test('renders the items sorted', () => {
  const { container } = render(<MetadataBar items={ITEMS.slice(0, 6)} />);
  const nodes = container.firstChild?.childNodes as NodeListOf<HTMLElement>;
  expect(within(nodes[0]).getByText(DASHBOARD_TITLE)).toBeInTheDocument();
  expect(within(nodes[1]).getByText(SQL_TITLE)).toBeInTheDocument();
  expect(within(nodes[2]).getByText(ROWS_TITLE)).toBeInTheDocument();
  expect(within(nodes[3]).getByText(DESCRIPTION_VALUE)).toBeInTheDocument();
  expect(within(nodes[4]).getByText(CREATED_BY)).toBeInTheDocument();
});

test('correctly renders the dashboards tooltip', async () => {
  render(<MetadataBar items={ITEMS.slice(0, 2)} />);
  userEvent.hover(screen.getByText(DASHBOARD_TITLE));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(within(tooltip).getByText(DASHBOARD_TITLE)).toBeInTheDocument();
  expect(within(tooltip).getByText(DASHBOARD_DESCRIPTION)).toBeInTheDocument();
});

test('correctly renders the description tooltip', async () => {
  await runWithBarCollapsed(async () => {
    render(<MetadataBar items={ITEMS.slice(0, 2)} />);
    userEvent.hover(screen.getAllByRole('img')[1]);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText(DESCRIPTION_VALUE)).toBeInTheDocument();
  });
});

test('correctly renders the last modified tooltip', async () => {
  const dateText = moment.utc(DATE).fromNow();
  render(<MetadataBar items={ITEMS.slice(0, 3)} />);
  userEvent.hover(screen.getByText(dateText));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(within(tooltip).getByText(dateText)).toBeInTheDocument();
  expect(within(tooltip).getByText(MODIFIED_BY)).toBeInTheDocument();
});

test('correctly renders the owner tooltip', async () => {
  const dateText = moment.utc(DATE).fromNow();
  render(<MetadataBar items={ITEMS.slice(0, 4)} />);
  userEvent.hover(screen.getByText(CREATED_BY));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(within(tooltip).getByText(CREATED_BY)).toBeInTheDocument();
  expect(within(tooltip).getByText(dateText)).toBeInTheDocument();
  OWNERS.forEach(owner =>
    expect(within(tooltip).getByText(owner)).toBeInTheDocument(),
  );
});

test('correctly renders the rows tooltip', async () => {
  await runWithBarCollapsed(async () => {
    render(<MetadataBar items={ITEMS.slice(4, 8)} />);
    userEvent.hover(screen.getAllByRole('img')[2]);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText(ROWS_TITLE)).toBeInTheDocument();
  });
});

test('correctly renders the sql tooltip', async () => {
  await runWithBarCollapsed(async () => {
    render(<MetadataBar items={ITEMS.slice(4, 8)} />);
    userEvent.hover(screen.getAllByRole('img')[1]);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText(SQL_TITLE)).toBeInTheDocument();
  });
});

test('correctly renders the table tooltip', async () => {
  await runWithBarCollapsed(async () => {
    render(<MetadataBar items={ITEMS.slice(4, 8)} />);
    userEvent.hover(screen.getAllByRole('img')[0]);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText(TABLE_TITLE)).toBeInTheDocument();
  });
});

test('correctly renders the tags tooltip', async () => {
  await runWithBarCollapsed(async () => {
    render(<MetadataBar items={ITEMS.slice(4, 8)} />);
    userEvent.hover(screen.getAllByRole('img')[3]);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    TAGS.forEach(tag =>
      expect(within(tooltip).getByText(tag)).toBeInTheDocument(),
    );
  });
});
