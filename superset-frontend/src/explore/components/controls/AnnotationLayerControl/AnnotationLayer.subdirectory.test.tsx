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

// Subdirectory regression coverage for the "Add an annotation layer here"
// link shown when the annotation layer/chart search finds no results.
//
// Original bug: under a subdirectory deployment (applicationRoot() =
// '/superset') the link pointed to the un-prefixed '/annotationlayer/list',
// which 404s because every route lives under the app root. Fixed by routing
// the href through ensureAppRoot.

import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import {
  getChartMetadataRegistry,
  ChartMetadata,
  VizType,
} from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import setupColors from 'src/setup/setupColors';
import { ANNOTATION_TYPES_METADATA } from './AnnotationTypes';
import AnnotationLayer from './AnnotationLayer';

// The link statically reads applicationRoot(); intercept it to simulate a
// subdirectory deployment, mirroring Menu.subdirectory.test.tsx.
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  ...jest.requireActual('src/utils/getBootstrapData'),
  applicationRoot: () => '/superset',
}));

const defaultProps = {
  value: '',
  vizType: VizType.Table,
  annotationType: ANNOTATION_TYPES_METADATA.EVENT.value,
  sourceType: 'Table',
};

beforeAll(() => {
  fetchMock.get('glob:*/api/v1/annotation_layer/*', { result: [] });
  fetchMock.get(/\/api\/v1\/chart\/\?q=.+/, { result: [] });

  setupColors();

  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'Table',
      thumbnail: '',
      supportedAnnotationTypes: Object.values(ANNOTATION_TYPES_METADATA).map(
        value => value.value,
      ),
      canBeAnnotationTypes: ['EVENT'],
    }),
  );
});

test('empty-state link to the annotation layer list honors the app root', async () => {
  await waitFor(() => render(<AnnotationLayer {...defaultProps} />));

  userEvent.click(
    screen.getByRole('combobox', { name: 'Annotation layer value' }),
  );

  const link = await screen.findByRole('link', { name: 'here' });
  expect(link).toHaveAttribute('href', '/superset/annotationlayer/list');
});
