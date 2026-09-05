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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import PartitionPruningIndicator, { isMirroredColumn } from '.';

const ACTIVE = {
  partition_column: 'dt_epoch',
  mapped_column: 'event_time',
  active: true,
};

test('the glyph appears for an active mapping', () => {
  render(<PartitionPruningIndicator mapping={ACTIVE} />);

  expect(screen.getByTestId('partition-pruning-indicator')).toBeInTheDocument();
});

test('an inactive mapping shows nothing', () => {
  // Configured but inert -- no transform yet. Claiming the query is pruning
  // when it is not would be worse than staying quiet.
  const { container } = render(
    <PartitionPruningIndicator mapping={{ ...ACTIVE, active: false }} />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('no mapping at all shows nothing', () => {
  const { container } = render(<PartitionPruningIndicator mapping={null} />);

  expect(container).toBeEmptyDOMElement();
});

test('the tooltip explains the speed-up without saying "partition column" twice', async () => {
  render(<PartitionPruningIndicator mapping={ACTIVE} />);

  await userEvent.hover(screen.getByTestId('partition-pruning-indicator'));

  expect(
    await screen.findByText(
      /also applied to a partition column for faster queries/,
    ),
  ).toBeInTheDocument();
});

test('only the mapped column counts as mirrored', () => {
  // The model allows exactly one mapped column, so every other filter on the
  // chart -- including one on the partition column itself -- gets no glyph.
  expect(isMirroredColumn(ACTIVE, 'event_time')).toBe(true);
  expect(isMirroredColumn(ACTIVE, 'country')).toBe(false);
  expect(isMirroredColumn(ACTIVE, 'dt_epoch')).toBe(false);
});

test('nothing is mirrored when the mapping is inactive or absent', () => {
  expect(isMirroredColumn({ ...ACTIVE, active: false }, 'event_time')).toBe(
    false,
  );
  expect(isMirroredColumn(null, 'event_time')).toBe(false);
  expect(isMirroredColumn(ACTIVE, undefined)).toBe(false);
});
