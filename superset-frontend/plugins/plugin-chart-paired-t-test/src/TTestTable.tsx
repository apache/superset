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
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@apache-superset/core/theme';
import {
  Table,
  TableSize,
  type ColumnsType,
} from '@superset-ui/core/components/Table';
import { studentTwoSidedPValue } from './statistics';

interface DataPointValue {
  x: number;
  y: number;
}

export interface DataEntry {
  group: string[];
  values: DataPointValue[];
}

interface TTestTableProps {
  alpha?: number;
  data: DataEntry[];
  groups: string[];
  liftValPrec?: number;
  metric: string;
  pValPrec?: number;
}

type TTestRow = {
  key: number;
  index: number;
  pValue: string | number;
  liftValue: string | number;
  significant: string;
} & Record<string, string | number>;

const P_VALUE = 'pValue';
const LIFT_VALUE = 'liftValue';
const SIGNIFICANT = 'significant';

type Comparator = (a: string, b: string) => number;

// Column comparators ported from the previous reactable `sortable` config.
// 'control' always sorts to the top in ascending order.
const COMPARATORS: Record<string, Comparator> = {
  [P_VALUE]: (a, b) => {
    if (a === 'control') return -1;
    if (b === 'control') return 1;
    if (a === b) return 0;
    return a > b ? 1 : -1; // p-values ascending
  },
  [LIFT_VALUE]: (a, b) => {
    if (a === 'control') return -1;
    if (b === 'control') return 1;
    const liftA = parseFloat(a);
    const liftB = parseFloat(b);
    const aFinite = Number.isFinite(liftA);
    const bFinite = Number.isFinite(liftB);
    // Non-finite (Infinity/NaN) lift values sort ahead of finite ones,
    // consistently regardless of comparison order, to avoid an antisymmetric
    // comparator.
    if (!aFinite && !bFinite) return 0;
    if (!aFinite) return -1;
    if (!bFinite) return 1;
    if (liftA === liftB) return 0;
    return liftA > liftB ? -1 : 1; // lift values descending
  },
  [SIGNIFICANT]: (a, b) => {
    if (a === 'control') return -1;
    if (b === 'control') return 1;
    if (a === b) return 0;
    return a > b ? -1 : 1; // significant values first
  },
};

// Default comparator for the group columns: numeric when both values parse as
// numbers, lexicographic otherwise.
const defaultCompare: Comparator = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

function TTestTable({
  alpha = 0.05,
  data,
  groups,
  liftValPrec = 4,
  metric,
  pValPrec = 6,
}: TTestTableProps) {
  const theme = useTheme();
  const [control, setControl] = useState(0);
  // Mirrors `control` so the data-change effect can read the latest value
  // without re-running (and recomputing) after every row click
  const controlRef = useRef(0);
  const [liftValues, setLiftValues] = useState<(string | number)[]>([]);
  const [pValues, setPValues] = useState<(string | number)[]>([]);

  const computeLift = useCallback(
    (values: DataPointValue[], controlValues: DataPointValue[]): string => {
      // Compute the lift value between two time series
      let sumValues = 0;
      let sumControl = 0;
      values.forEach((value, i) => {
        sumValues += value.y;
        sumControl += controlValues[i].y;
      });

      // A zero control sum yields "Infinity" (or "NaN" for 0/0) via toFixed,
      // matching the original class component's output
      return (((sumValues - sumControl) / sumControl) * 100).toFixed(
        liftValPrec,
      );
    },
    [liftValPrec],
  );

  const computePValue = useCallback(
    (
      values: DataPointValue[],
      controlValues: DataPointValue[],
    ): string | number => {
      // Compute the p-value from Student's t-test
      // between two time series
      let diffSum = 0;
      let diffSqSum = 0;
      let finiteCount = 0;
      values.forEach((value, i) => {
        const diff = controlValues[i].y - value.y;
        /* eslint-disable-next-line */
        if (isFinite(diff)) {
          finiteCount += 1;
          diffSum += diff;
          diffSqSum += diff * diff;
        }
      });
      const tvalue = -Math.abs(
        diffSum *
          Math.sqrt(
            (finiteCount - 1) / (finiteCount * diffSqSum - diffSum * diffSum),
          ),
      );
      try {
        // two-sided test
        return studentTwoSidedPValue(tvalue, finiteCount - 1).toFixed(pValPrec);
      } catch {
        return NaN;
      }
    },
    [pValPrec],
  );

  const computeTTest = useCallback(
    (controlIndex: number) => {
      // Compute lift and p-values for each row
      // against the selected control
      const newPValues: (string | number)[] = [];
      const newLiftValues: (string | number)[] = [];
      if (!data) {
        return;
      }
      for (let i = 0; i < data.length; i += 1) {
        if (i === controlIndex) {
          newPValues.push('control');
          newLiftValues.push('control');
        } else {
          newPValues.push(
            computePValue(data[i].values, data[controlIndex].values),
          );
          newLiftValues.push(
            computeLift(data[i].values, data[controlIndex].values),
          );
        }
      }
      setControl(controlIndex);
      controlRef.current = controlIndex;
      setLiftValues(newLiftValues);
      setPValues(newPValues);
    },
    [data, computeLift, computePValue],
  );

  // Recompute table when data changes, keeping control index in range.
  // Row clicks call computeTTest directly, so `control` is read via a ref
  // here to avoid a duplicate recompute after each click.
  useEffect(() => {
    if (!data || data.length === 0) {
      setControl(0);
      controlRef.current = 0;
      setLiftValues([]);
      setPValues([]);
      return;
    }

    computeTTest(Math.min(controlRef.current, data.length - 1));
  }, [computeTTest, data]);

  const getLiftStatus = useCallback(
    (row: number): string => {
      if (row === control) {
        return 'control';
      }
      const numericLiftVal = Number(liftValues[row]);
      if (Number.isNaN(numericLiftVal) || !Number.isFinite(numericLiftVal)) {
        return 'invalid'; // infinite or NaN values
      }

      return numericLiftVal >= 0 ? 'true' : 'false'; // green on true, red on false
    },
    [control, liftValues],
  );

  const getPValueStatus = useCallback(
    (row: number): string => {
      if (row === control) {
        return 'control';
      }
      const numericPVal = Number(pValues[row]);
      if (Number.isNaN(numericPVal) || !Number.isFinite(numericPVal)) {
        return 'invalid';
      }

      return ''; // p-values won't normally be colored
    },
    [control, pValues],
  );

  const getSignificance = useCallback(
    (row: number): string | boolean => {
      if (row === control) {
        return 'control';
      }

      // p-values significant below set threshold
      return Number(pValues[row]) <= alpha;
    },
    [control, pValues, alpha],
  );

  const handleRowClick = useCallback(
    (rowIndex: number) => {
      computeTTest(rowIndex);
    },
    [computeTTest],
  );

  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('Group by param is required');
  }

  // Map a status keyword to its theme color; the control/significant/lift
  // states reuse the semantic antd tokens.
  const statusColor = (status: string): string | undefined => {
    switch (status) {
      case 'control':
        return theme.colorPrimary;
      case 'true':
        return theme.colorSuccess;
      case 'false':
        return theme.colorError;
      case 'invalid':
        return theme.colorWarning;
      default:
        return undefined;
    }
  };

  const rows: TTestRow[] = (data ?? []).map((entry, i) => {
    const row = {
      key: i,
      index: i,
      pValue: pValues[i],
      liftValue: liftValues[i],
      significant: String(getSignificance(i)),
    } as TTestRow;
    groups.forEach((group, j) => {
      row[group] = entry.group[j];
    });
    return row;
  });

  const columns: ColumnsType<TTestRow> = [
    ...groups.map(group => ({
      title: group,
      dataIndex: group,
      key: group,
      sorter: (a: TTestRow, b: TTestRow) =>
        defaultCompare(String(a[group]), String(b[group])),
    })),
    {
      title: 'p-value',
      dataIndex: P_VALUE,
      key: P_VALUE,
      sorter: (a: TTestRow, b: TTestRow) =>
        COMPARATORS[P_VALUE](String(a.pValue), String(b.pValue)),
      render: (value: string | number, row: TTestRow) => (
        <span style={{ color: statusColor(getPValueStatus(row.index)) }}>
          {value}
        </span>
      ),
    },
    {
      title: 'Lift %',
      dataIndex: LIFT_VALUE,
      key: LIFT_VALUE,
      sorter: (a: TTestRow, b: TTestRow) =>
        COMPARATORS[LIFT_VALUE](String(a.liftValue), String(b.liftValue)),
      render: (value: string | number, row: TTestRow) => (
        <span style={{ color: statusColor(getLiftStatus(row.index)) }}>
          {value}
        </span>
      ),
    },
    {
      title: 'Significant',
      dataIndex: SIGNIFICANT,
      key: SIGNIFICANT,
      sorter: (a: TTestRow, b: TTestRow) =>
        COMPARATORS[SIGNIFICANT](String(a.significant), String(b.significant)),
      render: (value: string) => (
        <span style={{ color: statusColor(value) }}>{value}</span>
      ),
    },
  ];

  return (
    <div>
      <h3>{metric}</h3>
      <Table<TTestRow>
        data={rows}
        columns={columns}
        size={TableSize.Small}
        rowKey="key"
        usePagination={false}
        sticky={false}
        onRow={row => ({
          onClick: () => handleRowClick(row.index),
          style: {
            cursor: 'pointer',
            ...(row.index === control
              ? { backgroundColor: theme.colorFillTertiary }
              : {}),
          },
        })}
      />
    </div>
  );
}

export default TTestTable;
