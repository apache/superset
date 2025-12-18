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
import { useState, useEffect, useCallback } from 'react';
import { SupersetClient, logging } from '@superset-ui/core';
import type { SchemaReportResponse, DatabaseSchemaReport } from '../types';
import { USE_MOCK_DATA } from '../config';
import { JoinType, Cardinality } from '../../../components/DatabaseSchemaEditor';

// Mock data for testing UI without backend
const MOCK_REPORT: DatabaseSchemaReport = {
  id: 1,
  database_id: 1,
  schema_name: 'postgres-prod',
  status: 'completed',
  created_at: new Date().toISOString(),
  tables: [
    {
      id: 1,
      name: 'orders',
      type: 'table',
      description:
        'This table stores all customer orders including order details, timestamps, and status information.',
      columns: [
        {
          id: 1,
          name: 'order_id',
          type: 'INTEGER',
          position: 1,
          description: 'Unique identifier for each order',
          is_primary_key: true,
        },
        {
          id: 2,
          name: 'customer_id',
          type: 'INTEGER',
          position: 2,
          description: 'Reference to the customer who placed the order',
          is_foreign_key: true,
        },
        {
          id: 3,
          name: 'order_date',
          type: 'TIMESTAMP',
          position: 3,
          description: null,
        },
        {
          id: 4,
          name: 'total_amount',
          type: 'DECIMAL',
          position: 4,
          description: null,
        },
        {
          id: 5,
          name: 'status',
          type: 'VARCHAR',
          position: 5,
          description: null,
        },
      ],
    },
    {
      id: 2,
      name: 'customers',
      type: 'table',
      description:
        'Customer master data including contact information and account details.',
      columns: [
        {
          id: 6,
          name: 'customer_id',
          type: 'INTEGER',
          position: 1,
          description: 'Unique identifier for each customer',
          is_primary_key: true,
        },
        {
          id: 7,
          name: 'email',
          type: 'VARCHAR',
          position: 2,
          description: null,
        },
        {
          id: 8,
          name: 'created_at',
          type: 'TIMESTAMP',
          position: 3,
          description: null,
        },
        {
          id: 9,
          name: 'country',
          type: 'VARCHAR',
          position: 4,
          description: null,
        },
      ],
    },
    {
      id: 3,
      name: 'products',
      type: 'table',
      description: 'Product catalog containing all available items for sale.',
      columns: [
        {
          id: 10,
          name: 'product_id',
          type: 'INTEGER',
          position: 1,
          description: 'Unique identifier for each product',
          is_primary_key: true,
        },
        {
          id: 11,
          name: 'name',
          type: 'VARCHAR',
          position: 2,
          description: null,
        },
        {
          id: 12,
          name: 'price',
          type: 'DECIMAL',
          position: 3,
          description: null,
        },
        {
          id: 13,
          name: 'category',
          type: 'VARCHAR',
          position: 4,
          description: null,
        },
      ],
    },
  ],
  joins: [
    {
      id: 1,
      source_table: 'orders',
      source_table_id: 1,
      source_columns: ['customer_id'],
      target_table: 'customers',
      target_table_id: 2,
      target_columns: ['customer_id'],
      join_type: JoinType.LEFT,
      cardinality: Cardinality.MANY_TO_ONE,
      semantic_context: 'Orders are linked to customers through the customer_id field',
    },
  ],
};

interface UseSchemaReportReturn {
  report: DatabaseSchemaReport | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export default function useSchemaReport(
  reportId: number | null,
): UseSchemaReportReturn {
  const [report, setReport] = useState<DatabaseSchemaReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!reportId) {
      setReport(null);
      return;
    }

    // Use mock data for testing
    if (USE_MOCK_DATA) {
      setLoading(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setReport(MOCK_REPORT);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/datasource/analysis/report/${reportId}`,
      });

      const data = response.json as SchemaReportResponse;
      setReport({
        id: data.id,
        database_id: data.database_id,
        schema_name: data.schema_name,
        status: data.status,
        created_at: data.created_at,
        tables: data.tables,
        joins: data.joins || [],
      });
    } catch (err) {
      logging.error('Error fetching schema report:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch schema report',
      );
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return {
    report,
    loading,
    error,
    refetch: fetchReport,
  };
}
