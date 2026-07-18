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
/* eslint-disable react/no-array-index-key, react/jsx-no-bind */
import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
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

const P_VALUE = 'pValue';
const LIFT_VALUE = 'liftValue';
const SIGNIFICANT = 'significant';

type Comparator = (a: string, b: string) => number;

// Column comparators ported from the previous reactable `sortable` config.
// 'control' always sorts to the top in ascending order (the table toggles to
// descending on a second click, mirroring the old behavior).
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
  const [control, setControl] = useState(0);
  // Mirrors `control` so the data-change effect can read the latest value
  // without re-running (and recomputing) after every row click
  const controlRef = useRef(0);
  const [liftValues, setLiftValues] = useState<(string | number)[]>([]);
  const [pValues, setPValues] = useState<(string | number)[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

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
      } catch (error) {
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
      // Get a css class name for coloring
      if (row === control) {
        return 'control';
      }
      const liftVal = liftValues[row];
      const numericLiftVal = Number(liftVal);
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
      const pVal = pValues[row];
      const numericPVal = Number(pVal);
      if (Number.isNaN(numericPVal) || !Number.isFinite(numericPVal)) {
        return 'invalid';
      }

      return ''; // p-values won't normally be colored
    },
    [control, pValues],
  );

  const getSignificance = useCallback(
    (row: number): string | boolean => {
      // Color significant as green, else red
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

  const handleSort = useCallback((column: string) => {
    setSortColumn(prev => {
      if (prev === column) {
        setSortDesc(desc => !desc);
        return prev;
      }
      setSortDesc(false);
      return column;
    });
  }, []);

  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('Group by param is required');
  }

  const columns = [
    ...groups.map(group => ({ key: group, label: group })),
    { key: P_VALUE, label: 'p-value' },
    { key: LIFT_VALUE, label: 'Lift %' },
    { key: SIGNIFICANT, label: 'Significant' },
  ];

  // Value used to sort a row by the active column.
  const sortValueOf = (index: number): string => {
    if (sortColumn === null) {
      return '';
    }
    const groupIndex = groups.indexOf(sortColumn);
    if (groupIndex >= 0) {
      return String(data[index].group[groupIndex]);
    }
    if (sortColumn === P_VALUE) {
      return String(pValues[index]);
    }
    if (sortColumn === LIFT_VALUE) {
      return String(liftValues[index]);
    }
    return String(getSignificance(index));
  };

  const rowOrder = (data ?? []).map((_, i) => i);
  if (sortColumn !== null) {
    const compare = COMPARATORS[sortColumn] ?? defaultCompare;
    rowOrder.sort((a, b) => {
      const result = compare(sortValueOf(a), sortValueOf(b));
      return sortDesc ? -result : result;
    });
  }

  return (
    <div>
      <h3>{metric}</h3>
      <table className="table" id={`table_${metric}`}>
        <thead>
          <tr className="reactable-column-header">
            {columns.map(column => {
              const sortClass =
                sortColumn === column.key
                  ? sortDesc
                    ? ' reactable-header-sort-desc'
                    : ' reactable-header-sort-asc'
                  : '';
              return (
                <th
                  key={column.key}
                  className={`reactable-header-sortable${sortClass}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSort(column.key)}
                  onKeyDown={(e: KeyboardEvent<HTMLTableCellElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort(column.key);
                    }
                  }}
                >
                  {column.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="reactable-data">
          {rowOrder.map(i => {
            const entry = data[i];
            const significance = getSignificance(i);
            return (
              <tr
                key={i}
                className={i === control ? 'control' : ''}
                onClick={() => handleRowClick(i)}
              >
                {groups.map((group, j) => (
                  <td key={j}>{entry.group[j]}</td>
                ))}
                <td className={getPValueStatus(i)}>{pValues[i]}</td>
                <td className={getLiftStatus(i)}>{liftValues[i]}</td>
                <td className={String(significance)}>{String(significance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TTestTable;
