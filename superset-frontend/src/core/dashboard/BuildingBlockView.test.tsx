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
import { render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from './DashboardProvider';
import { registerBuiltInBuildingBlocks } from './registerBuiltInBuildingBlocks';
import BuildingBlockView from './BuildingBlockView';

const provider = DashboardProvider.getInstance();

beforeAll(() => {
  registerBuiltInBuildingBlocks();
});

beforeEach(() => {
  provider.reset();
});

const withBlock = () => {
  const rootId = provider.getRoot().id;
  const id = provider.addBuildingBlock(rootId, 0, {
    type: 'markdown',
    props: { content: 'Quarterly notes' },
  });
  render(<BuildingBlockView nodeId={id} />);
  return { rootId, id };
};

test('a block says which one it is', () => {
  const { id } = withBlock();

  // Named by the same call the Outline names its rows by, so a block is not
  // "Quarterly notes" in one place and "Markdown" in the other.
  expect(screen.getByTestId(`block-title-${id}`)).toHaveTextContent(
    'Quarterly notes',
  );
});

test('the delete control does not have to be found first', () => {
  const { id } = withBlock();

  // It used to appear only on hover, which is a control you have to already
  // know is there. `toBeVisible` fails on the opacity that hid it.
  expect(screen.getByTestId(`block-remove-${id}`)).toBeVisible();
});

test('the root carries no header of its own', () => {
  const rootId = provider.getRoot().id;
  render(<BuildingBlockView nodeId={rootId} />);

  // The root is the dashboard rather than something on it: a header there
  // would label it "Canvas" and offer a delete the provider refuses.
  expect(
    screen.queryByTestId(`block-header-${rootId}`),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId(`block-remove-${rootId}`),
  ).not.toBeInTheDocument();
});

test('the header takes its height out of the block, not out of the canvas', () => {
  const { rootId, id } = withBlock();

  // A leaf block resolves `height: 100%` against this box — a chart measures
  // the result to size its canvas — so the band above it has to come out of
  // the height rather than be added to it, or every block overflows its cell
  // by exactly the header.
  expect(screen.getByTestId(`block-content-${id}`).style.height).toMatch(
    /^calc\(100% - \d+px\)$/,
  );
  // The root has no header to subtract.
  render(<BuildingBlockView nodeId={rootId} />);
  expect(screen.getByTestId(`block-content-${rootId}`)).toHaveStyle({
    height: '100%',
  });
});
