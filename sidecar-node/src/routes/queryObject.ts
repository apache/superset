// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { Request, Response, Router } from 'express';
import buildQueryObject from '../query/buildQueryObject';
import { QueryFormData, QueryFieldAliases } from '../types';

const router = Router();

interface BuildQueryObjectRequest {
  form_data: QueryFormData;
  query_fields?: QueryFieldAliases;
}

interface BuildQueryObjectResponse {
  query_object: any;
  error?: string;
}

/**
 * POST /api/v1/query-object
 *
 * Build a QueryObject from form_data
 *
 * Request body:
 * - form_data: The form data from Superset frontend
 * - query_fields: Optional query field aliases for visualization-specific mappings
 *
 * Response:
 * - query_object: The computed QueryObject
 * - error: Error message if processing failed
 */
router.post('/api/v1/query-object', (req: Request, res: Response) => {
  try {
    const { form_data, query_fields }: BuildQueryObjectRequest = req.body;

    if (!form_data) {
      return res.status(400).json({
        error: 'form_data is required',
      } as BuildQueryObjectResponse);
    }

    // Validate required form_data fields
    if (!form_data.datasource || !form_data.viz_type) {
      return res.status(400).json({
        error: 'form_data must include datasource and viz_type',
      } as BuildQueryObjectResponse);
    }

    const queryObject = buildQueryObject(form_data, query_fields);

    res.json({
      query_object: queryObject,
    } as BuildQueryObjectResponse);

  } catch (error: any) {
    console.error('Error building query object:', error);
    res.status(500).json({
      error: `Failed to build query object: ${error.message}`,
    } as BuildQueryObjectResponse);
  }
});

/**
 * GET /health
 *
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

export default router;
