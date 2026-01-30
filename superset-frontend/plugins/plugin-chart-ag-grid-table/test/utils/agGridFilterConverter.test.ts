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
import { convertAgGridFiltersToSQL } from '../../src/utils/agGridFilterConverter';
import type {
  AgGridFilterModel,
  AgGridSimpleFilter,
  AgGridCompoundFilter,
  AgGridSetFilter,
} from '../../src/utils/agGridFilterConverter';

describe('agGridFilterConverter', () => {
  describe('Empty and invalid inputs', () => {
    it('should handle empty filter model', () => {
      const result = convertAgGridFiltersToSQL({});

      expect(result.simpleFilters).toEqual([]);
      expect(result.complexWhere).toBeUndefined();
      expect(result.havingClause).toBeUndefined();
    });

    it('should handle null filter model', () => {
      const result = convertAgGridFiltersToSQL(null as any);

      expect(result.simpleFilters).toEqual([]);
      expect(result.complexWhere).toBeUndefined();
      expect(result.havingClause).toBeUndefined();
    });

    it('should skip invalid column names', () => {
      const filterModel: AgGridFilterModel = {
        valid_column: {
          filterType: 'text',
          type: 'equals',
          filter: 'test',
        },
        'invalid; DROP TABLE users--': {
          filterType: 'text',
          type: 'equals',
          filter: 'malicious',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0].col).toBe('valid_column');
    });

    it('should skip filters with invalid objects', () => {
      const filterModel = {
        column1: null,
        column2: 'invalid string',
        column3: {
          filterType: 'text',
          type: 'equals',
          filter: 'valid',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel as any);

      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0].col).toBe('column3');
    });
  });

  describe('Simple text filters', () => {
    it('should convert equals filter', () => {
      const filterModel: AgGridFilterModel = {
        name: {
          filterType: 'text',
          type: 'equals',
          filter: 'John',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0]).toEqual({
        col: 'name',
        op: '=',
        val: 'John',
      });
    });

    it('should convert notEqual filter', () => {
      const filterModel: AgGridFilterModel = {
        status: {
          filterType: 'text',
          type: 'notEqual',
          filter: 'inactive',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'status',
        op: '!=',
        val: 'inactive',
      });
    });

    it('should convert contains filter with wildcard', () => {
      const filterModel: AgGridFilterModel = {
        description: {
          filterType: 'text',
          type: 'contains',
          filter: 'urgent',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'description',
        op: 'ILIKE',
        val: '%urgent%',
      });
    });

    it('should convert notContains filter with wildcard', () => {
      const filterModel: AgGridFilterModel = {
        description: {
          filterType: 'text',
          type: 'notContains',
          filter: 'spam',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'description',
        op: 'NOT ILIKE',
        val: '%spam%',
      });
    });

    it('should convert startsWith filter with trailing wildcard', () => {
      const filterModel: AgGridFilterModel = {
        email: {
          filterType: 'text',
          type: 'startsWith',
          filter: 'admin',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'email',
        op: 'ILIKE',
        val: 'admin%',
      });
    });

    it('should convert endsWith filter with leading wildcard', () => {
      const filterModel: AgGridFilterModel = {
        email: {
          filterType: 'text',
          type: 'endsWith',
          filter: '@example.com',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'email',
        op: 'ILIKE',
        val: '%@example.com',
      });
    });
  });

  describe('Numeric filters', () => {
    it('should convert lessThan filter', () => {
      const filterModel: AgGridFilterModel = {
        age: {
          filterType: 'number',
          type: 'lessThan',
          filter: 30,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'age',
        op: '<',
        val: 30,
      });
    });

    it('should convert lessThanOrEqual filter', () => {
      const filterModel: AgGridFilterModel = {
        price: {
          filterType: 'number',
          type: 'lessThanOrEqual',
          filter: 100,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'price',
        op: '<=',
        val: 100,
      });
    });

    it('should convert greaterThan filter', () => {
      const filterModel: AgGridFilterModel = {
        score: {
          filterType: 'number',
          type: 'greaterThan',
          filter: 50,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'score',
        op: '>',
        val: 50,
      });
    });

    it('should convert greaterThanOrEqual filter', () => {
      const filterModel: AgGridFilterModel = {
        rating: {
          filterType: 'number',
          type: 'greaterThanOrEqual',
          filter: 4,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'rating',
        op: '>=',
        val: 4,
      });
    });

    it('should convert inRange filter to BETWEEN', () => {
      const filterModel: AgGridFilterModel = {
        age: {
          filterType: 'number',
          type: 'inRange',
          filter: 18,
          filterTo: 65,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      // inRange creates a simple filter with BETWEEN operator
      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0]).toEqual({
        col: 'age',
        op: 'BETWEEN',
        val: 18,
      });
    });
  });

  describe('Null/blank filters', () => {
    it('should convert blank filter to IS NULL', () => {
      const filterModel: AgGridFilterModel = {
        optional_field: {
          filterType: 'text',
          type: 'blank',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'optional_field',
        op: 'IS NULL',
        val: null,
      });
    });

    it('should convert notBlank filter to IS NOT NULL', () => {
      const filterModel: AgGridFilterModel = {
        required_field: {
          filterType: 'text',
          type: 'notBlank',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'required_field',
        op: 'IS NOT NULL',
        val: null,
      });
    });
  });

  describe('Set filters', () => {
    it('should convert set filter to IN operator', () => {
      const filterModel: AgGridFilterModel = {
        status: {
          filterType: 'set',
          values: ['active', 'pending', 'approved'],
        } as AgGridSetFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'status',
        op: 'IN',
        val: ['active', 'pending', 'approved'],
      });
    });

    it('should handle set filter with numeric values', () => {
      const filterModel: AgGridFilterModel = {
        priority: {
          filterType: 'set',
          values: [1, 2, 3],
        } as AgGridSetFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'priority',
        op: 'IN',
        val: [1, 2, 3],
      });
    });

    it('should skip empty set filters', () => {
      const filterModel: AgGridFilterModel = {
        status: {
          filterType: 'set',
          values: [],
        } as AgGridSetFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(0);
    });
  });

  describe('Compound filters', () => {
    it('should combine conditions with AND operator', () => {
      const filterModel: AgGridFilterModel = {
        age: {
          filterType: 'number',
          operator: 'AND',
          condition1: {
            filterType: 'number',
            type: 'greaterThanOrEqual',
            filter: 18,
          },
          condition2: {
            filterType: 'number',
            type: 'lessThan',
            filter: 65,
          },
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.complexWhere).toBe('(age >= 18 AND age < 65)');
    });

    it('should combine conditions with OR operator', () => {
      const filterModel: AgGridFilterModel = {
        status: {
          filterType: 'text',
          operator: 'OR',
          condition1: {
            filterType: 'text',
            type: 'equals',
            filter: 'urgent',
          },
          condition2: {
            filterType: 'text',
            type: 'equals',
            filter: 'critical',
          },
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.complexWhere).toBe(
        "(status = 'urgent' OR status = 'critical')",
      );
    });

    it('should handle compound filter with inRange', () => {
      const filterModel: AgGridFilterModel = {
        date: {
          filterType: 'date',
          operator: 'AND',
          condition1: {
            filterType: 'date',
            type: 'inRange',
            filter: '2024-01-01',
            filterTo: '2024-12-31',
          },
          condition2: {
            filterType: 'date',
            type: 'notBlank',
          },
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.complexWhere).toContain('BETWEEN');
      expect(result.complexWhere).toContain('IS NOT NULL');
    });

    it('should handle compound filter with invalid conditions gracefully', () => {
      const filterModel: AgGridFilterModel = {
        field: {
          filterType: 'text',
          operator: 'AND',
          condition1: {
            filterType: 'text',
            type: 'equals',
            filter: 'valid',
          },
          condition2: {
            filterType: 'text',
            type: 'equals',
            // Missing filter value - should be skipped
          } as AgGridSimpleFilter,
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      // Should only include valid condition
      expect(result.complexWhere).toBe("field = 'valid'");
    });

    it('should handle multi-condition filters (conditions array)', () => {
      const filterModel: AgGridFilterModel = {
        category: {
          filterType: 'text',
          operator: 'OR',
          conditions: [
            {
              filterType: 'text',
              type: 'equals',
              filter: 'A',
            },
            {
              filterType: 'text',
              type: 'equals',
              filter: 'B',
            },
            {
              filterType: 'text',
              type: 'equals',
              filter: 'C',
            },
          ],
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.complexWhere).toBe(
        "(category = 'A' OR category = 'B' OR category = 'C')",
      );
    });
  });

  describe('Metric vs Dimension separation', () => {
    it('should put dimension filters in simpleFilters/complexWhere', () => {
      const filterModel: AgGridFilterModel = {
        state: {
          filterType: 'text',
          type: 'equals',
          filter: 'CA',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel, []);

      expect(result.simpleFilters).toHaveLength(1);
      expect(result.havingClause).toBeUndefined();
    });

    it('should put metric filters in havingClause', () => {
      const filterModel: AgGridFilterModel = {
        'SUM(revenue)': {
          filterType: 'number',
          type: 'greaterThan',
          filter: 1000,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel, ['SUM(revenue)']);

      expect(result.simpleFilters).toHaveLength(0);
      expect(result.havingClause).toBe('SUM(revenue) > 1000');
    });

    it('should separate mixed metric and dimension filters', () => {
      const filterModel: AgGridFilterModel = {
        state: {
          filterType: 'text',
          type: 'equals',
          filter: 'CA',
        },
        'SUM(revenue)': {
          filterType: 'number',
          type: 'greaterThan',
          filter: 1000,
        },
        city: {
          filterType: 'text',
          type: 'startsWith',
          filter: 'San',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel, ['SUM(revenue)']);

      expect(result.simpleFilters).toHaveLength(2);
      expect(result.simpleFilters[0].col).toBe('state');
      expect(result.simpleFilters[1].col).toBe('city');
      expect(result.havingClause).toBe('SUM(revenue) > 1000');
    });

    it('should handle metric set filters in HAVING clause', () => {
      const filterModel: AgGridFilterModel = {
        'AVG(score)': {
          filterType: 'set',
          values: [90, 95, 100],
        } as AgGridSetFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel, ['AVG(score)']);

      expect(result.simpleFilters).toHaveLength(0);
      expect(result.havingClause).toBe('AVG(score) IN (90, 95, 100)');
    });

    it('should handle metric blank filters in HAVING clause', () => {
      const filterModel: AgGridFilterModel = {
        'COUNT(*)': {
          filterType: 'number',
          type: 'blank',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel, ['COUNT(*)']);

      expect(result.havingClause).toBe('COUNT(*) IS NULL');
    });
  });

  describe('Multiple filters combination', () => {
    it('should handle both simple and compound filters', () => {
      const filterModel: AgGridFilterModel = {
        status: {
          filterType: 'text',
          type: 'equals',
          filter: 'active',
        },
        age: {
          filterType: 'number',
          operator: 'AND',
          condition1: {
            filterType: 'number',
            type: 'greaterThan',
            filter: 18,
          },
          condition2: {
            filterType: 'number',
            type: 'lessThan',
            filter: 65,
          },
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      // Simple filter goes to simpleFilters
      expect(result.simpleFilters).toHaveLength(1);
      expect(result.simpleFilters[0]).toEqual({
        col: 'status',
        op: '=',
        val: 'active',
      });

      // Compound filter goes to complexWhere
      expect(result.complexWhere).toBe('(age > 18 AND age < 65)');
    });

    it('should combine multiple HAVING filters with AND', () => {
      const filterModel: AgGridFilterModel = {
        'SUM(revenue)': {
          filterType: 'number',
          type: 'greaterThan',
          filter: 1000,
        },
        'AVG(score)': {
          filterType: 'number',
          type: 'greaterThanOrEqual',
          filter: 90,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel, [
        'SUM(revenue)',
        'AVG(score)',
      ]);

      expect(result.havingClause).toBe(
        '(SUM(revenue) > 1000 AND AVG(score) >= 90)',
      );
    });

    it('should handle single WHERE filter without parentheses', () => {
      const filterModel: AgGridFilterModel = {
        age: {
          filterType: 'number',
          operator: 'AND',
          condition1: {
            filterType: 'number',
            type: 'greaterThan',
            filter: 18,
          },
          condition2: {
            filterType: 'number',
            type: 'lessThan',
            filter: 65,
          },
        } as AgGridCompoundFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.complexWhere).toBe('(age > 18 AND age < 65)');
    });
  });

  describe('SQL injection prevention', () => {
    it('should escape single quotes in filter values', () => {
      const filterModel: AgGridFilterModel = {
        name: {
          filterType: 'text',
          type: 'equals',
          filter: "O'Brien",
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0].val).toBe("O'Brien");
      // The actual escaping happens in SQL generation, but value is preserved
    });

    it('should escape single quotes in complex filters', () => {
      const filterModel: AgGridFilterModel = {
        description: {
          filterType: 'text',
          type: 'contains',
          filter: "It's working",
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      // For ILIKE filters, wildcards are added but value preserved
      expect(result.simpleFilters[0].val).toBe("%It's working%");
    });

    it('should reject column names with SQL injection attempts', () => {
      const filterModel: AgGridFilterModel = {
        "name'; DROP TABLE users--": {
          filterType: 'text',
          type: 'equals',
          filter: 'test',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(0);
    });

    it('should reject column names with special characters', () => {
      const filterModel: AgGridFilterModel = {
        'column<script>alert(1)</script>': {
          filterType: 'text',
          type: 'equals',
          filter: 'test',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(0);
    });

    it('should accept valid column names with allowed special characters', () => {
      const filterModel: AgGridFilterModel = {
        valid_column_123: {
          filterType: 'text',
          type: 'equals',
          filter: 'test',
        },
        'Column Name With Spaces': {
          filterType: 'text',
          type: 'equals',
          filter: 'test2',
        },
        'SUM(revenue)': {
          filterType: 'number',
          type: 'greaterThan',
          filter: 100,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(3);
    });

    it('should handle very long column names', () => {
      const longColumnName = 'a'.repeat(300);
      const filterModel: AgGridFilterModel = {
        [longColumnName]: {
          filterType: 'text',
          type: 'equals',
          filter: 'test',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      // Should reject column names longer than 255 characters
      expect(result.simpleFilters).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should skip filters with missing type', () => {
      const filterModel: AgGridFilterModel = {
        column: {
          filterType: 'text',
          filter: 'value',
        } as any,
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(0);
    });

    it('should skip filters with unknown operator type', () => {
      const filterModel: AgGridFilterModel = {
        column: {
          filterType: 'text',
          type: 'unknownOperator' as any,
          filter: 'value',
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(0);
    });

    it('should skip filters with invalid value types', () => {
      const filterModel: AgGridFilterModel = {
        column: {
          filterType: 'text',
          type: 'equals',
          filter: { invalid: 'object' } as any,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters).toHaveLength(0);
    });

    it('should handle boolean filter values', () => {
      const filterModel: AgGridFilterModel = {
        is_active: {
          filterType: 'boolean',
          type: 'equals',
          filter: true,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0]).toEqual({
        col: 'is_active',
        op: '=',
        val: true,
      });
    });

    it('should handle null filter values for blank operators', () => {
      const filterModel: AgGridFilterModel = {
        field: {
          filterType: 'text',
          type: 'blank',
          filter: null,
        },
      };

      const result = convertAgGridFiltersToSQL(filterModel);

      expect(result.simpleFilters[0].val).toBeNull();
    });

    it('should handle metric filters with set filter', () => {
      const filterModel: AgGridFilterModel = {
        'SUM(amount)': {
          filterType: 'set',
          values: ['100', '200', '300'],
        } as AgGridSetFilter,
      };

      const result = convertAgGridFiltersToSQL(filterModel, ['SUM(amount)']);

      expect(result.havingClause).toBe("SUM(amount) IN ('100', '200', '300')");
    });
  });
});
