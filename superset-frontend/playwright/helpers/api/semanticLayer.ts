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

import { APIResponse, Page, test } from '@playwright/test';
import rison from 'rison';
import { apiDelete, apiGet, apiPost, ApiRequestOptions } from './requests';

/**
 * Layer type of the in-memory provider in tests/e2e_extensions/semantic_stub.
 * The prefix comes from the extension loader, so a stub that registered
 * outside the extension mechanism would not match.
 */
export const STUB_SEMANTIC_LAYER_TYPE =
  'extensions.superset-e2e.semantic-stub.stub';

/** The stub's only view, with dimensions `category`/`region`. */
export const STUB_VIEW_NAME = 'orders';

const ENDPOINTS = {
  SEMANTIC_LAYER: 'api/v1/semantic_layer/',
  SEMANTIC_VIEW: 'api/v1/semantic_view/',
  DATASOURCE: 'api/v1/datasource/',
} as const;

export interface StubSemanticView {
  layerUuid: string;
  viewId: number;
  /** `<id>__semantic_view`, the form-data datasource key. */
  datasource: string;
}

/**
 * Stand down unless the stub provider is registered on this instance.
 *
 * The stub loads only under `superset_test_config_semantic`, so the required
 * run collects and skips these specs. The dedicated CI step sets
 * `PLAYWRIGHT_REQUIRE_SEMANTIC_STUB=true`, which turns a missing stub into a
 * failure: a broken extension load must not pass as an empty run.
 */
export async function skipUnlessSemanticStub(page: Page): Promise<void> {
  const response = await apiGet(page, `${ENDPOINTS.SEMANTIC_LAYER}types`, {
    failOnStatusCode: false,
  });
  const types: Array<{ id: string }> = response.ok()
    ? (await response.json()).result
    : [];
  const registered = types.some(type => type.id === STUB_SEMANTIC_LAYER_TYPE);
  if (process.env.PLAYWRIGHT_REQUIRE_SEMANTIC_STUB?.toLowerCase() === 'true') {
    if (!registered) {
      throw new Error(
        `${STUB_SEMANTIC_LAYER_TYPE} is not registered; check LOCAL_EXTENSIONS ` +
          'and ENABLE_EXTENSIONS in superset_test_config_semantic.',
      );
    }
    return;
  }
  test.skip(
    !registered,
    'The E2E semantic stub is not loaded on this instance.',
  );
}

/**
 * Create a stub semantic layer and its `orders` view. Track the returned
 * layer for cleanup; deleting a layer deletes its views.
 */
export async function apiCreateStubSemanticView(
  page: Page,
  uniqueSuffix: string,
): Promise<StubSemanticView> {
  const layerResp = await apiPost(page, ENDPOINTS.SEMANTIC_LAYER, {
    name: `e2e_semantic_stub_${uniqueSuffix}`,
    type: STUB_SEMANTIC_LAYER_TYPE,
    configuration: {},
  });
  const layerUuid: string = (await layerResp.json()).result.uuid;

  const viewResp = await apiPost(page, ENDPOINTS.SEMANTIC_VIEW, {
    views: [{ name: STUB_VIEW_NAME, semantic_layer_uuid: layerUuid }],
  });
  const viewUuid: string = (await viewResp.json()).result.created[0].uuid;

  // The semantic-view API has no GET; the combined datasource list is where
  // the integer id that charts and filters reference is exposed.
  const query = rison.encode({
    filters: [{ col: 'table_name', opr: 'ct', value: STUB_VIEW_NAME }],
    page: 0,
    page_size: 100,
  });
  const listResp = await apiGet(page, `${ENDPOINTS.DATASOURCE}?q=${query}`);
  const rows: Array<{ id: number; uuid: string; kind: string }> = (
    await listResp.json()
  ).result;
  const row = rows.find(
    item => item.kind === 'semantic_view' && item.uuid === viewUuid,
  );
  if (!row) {
    throw new Error(`Semantic view ${viewUuid} missing from datasource list`);
  }
  return { layerUuid, viewId: row.id, datasource: `${row.id}__semantic_view` };
}

export async function apiDeleteSemanticLayer(
  page: Page,
  layerUuid: string,
  options?: ApiRequestOptions,
): Promise<APIResponse> {
  return apiDelete(page, `${ENDPOINTS.SEMANTIC_LAYER}${layerUuid}`, options);
}
