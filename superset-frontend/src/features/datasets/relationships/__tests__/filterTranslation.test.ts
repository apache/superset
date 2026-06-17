/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file that was agreed to
 * by you in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, either express or implied.  See
 * the License for the specific language governing permissions
 * and limitations under the License.
 */

import {
  FilterTranslationEngine,
} from 'src/features/datasets/relationships/filterTranslation';

// Mock SupersetClient
jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

import { SupersetClient } from '@superset-ui/core';

const mockGet = SupersetClient.get as jest.MockedFunction<
  typeof SupersetClient.get
>;
const _mockPost = SupersetClient.post as jest.MockedFunction<
  typeof SupersetClient.post
>;
void _mockPost;

describe('FilterTranslationEngine', () => {
  let engine: FilterTranslationEngine;

  beforeEach(() => {
    engine = new FilterTranslationEngine();
    jest.clearAllMocks();
  });

  describe('loadRelationships', () => {
    it('fetches relationships from API on first call', async () => {
      mockGet.mockResolvedValue({
        json: {
          result: [
            {
              id: 1,
              source_dataset_id: 10,
              target_dataset_id: 20,
              columns: [
                { source_column_name: 'region_id', target_column_name: 'id' },
              ],
              relationship_type: 'many_to_one',
              join_type: 'LEFT',
              is_cross_database: false,
            },
          ],
        },
      } as never);

      const result = await engine.loadRelationships(10);
      expect(result).toHaveLength(1);
      expect(result[0].sourceColumn).toBe('region_id');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns cached relationships on second call', async () => {
      mockGet.mockResolvedValue({
        json: { result: [] },
      } as never);

      await engine.loadRelationships(10);
      await engine.loadRelationships(10);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('translateFilter', () => {
    it('passes filter directly for same-DB relationships', async () => {
      mockGet.mockResolvedValue({
        json: {
          result: [
            {
              id: 1,
              source_dataset_id: 10,
              target_dataset_id: 20,
              columns: [
                { source_column_name: 'region_id', target_column_name: 'id' },
              ],
              relationship_type: 'many_to_one',
              join_type: 'LEFT',
              is_cross_database: false,
            },
          ],
        },
      } as never);

      const translated = await engine.translateFilter({
        column: 'region_id',
        datasetId: 10,
        values: [1, 2, 3],
        operator: 'IN',
      });

      expect(translated).toHaveLength(1);
      expect(translated[0].targetDatasetId).toBe(20);
      expect(translated[0].targetColumn).toBe('id');
      expect(translated[0].confidence).toBe('exact');
    });

    it('skips when filter column does not match join column', async () => {
      mockGet.mockResolvedValue({
        json: {
          result: [
            {
              id: 1,
              source_dataset_id: 10,
              target_dataset_id: 20,
              columns: [
                { source_column_name: 'region_id', target_column_name: 'id' },
              ],
              relationship_type: 'many_to_one',
              join_type: 'LEFT',
              is_cross_database: false,
            },
          ],
        },
      } as never);

      const translated = await engine.translateFilter({
        column: 'different_column',
        datasetId: 10,
        values: [1, 2],
      });

      expect(translated).toHaveLength(0);
    });
  });

  describe('clearCache', () => {
    it('clears all cached relationships', async () => {
      mockGet.mockResolvedValue({
        json: { result: [] },
      } as never);

      await engine.loadRelationships(10);
      engine.clearCache();
      await engine.loadRelationships(10);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateDataset', () => {
    it('clears cache for specific dataset only', async () => {
      mockGet.mockResolvedValue({
        json: { result: [] },
      } as never);

      await engine.loadRelationships(10);
      await engine.loadRelationships(20);
      engine.invalidateDataset(10);
      await engine.loadRelationships(10);
      await engine.loadRelationships(20);

      // Dataset 10 fetched twice (invalidated), dataset 20 once (cached)
      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });
});
