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

/**
 * SQL Expression Types - aligned with backend SqlExpressionType enum
 */
export enum SqlExpressionType {
  COLUMN = 'column',
  METRIC = 'metric',
  WHERE = 'where',
  HAVING = 'having',
  FILTER = 'filter', // Deprecated: maps to WHERE/HAVING based on clause
}

export type ExpressionType = `${SqlExpressionType}`;

/**
 * Validation error structure returned from backend
 */
export interface ValidationError {
  line_number?: number;
  start_column?: number;
  end_column?: number;
  message: string;
}

/**
 * Backend validation response structure
 */
export interface ValidationResponse {
  result: ValidationError[];
}
