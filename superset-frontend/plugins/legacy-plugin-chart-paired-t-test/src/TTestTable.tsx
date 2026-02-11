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
import dist from 'distributions';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tr, Td, Thead, Th } from 'reactable';

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

function TTestTable({
  alpha = 0.05,
  data,
  groups,
  liftValPrec = 4,
  metric,
  pValPrec = 6,
}: TTestTableProps) {
  const [control, setControl] = useState(0);
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
        return (2 * new dist.Studentt(finiteCount - 1).cdf(tvalue)).toFixed(
          pValPrec,
        ); // two-sided test
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
      setLiftValues(newLiftValues);
      setPValues(newPValues);
    },
    [data, computeLift, computePValue],
  );

  // Initially populate table on mount
  useEffect(() => {
    computeTTest(control);
  }, [computeTTest, control]);

  const getLiftStatus = useCallback(
    (row: number): string => {
      // Get a css class name for coloring
      if (row === control) {
        return 'control';
      }
      const liftVal = liftValues[row];
      if (Number.isNaN(liftVal) || !Number.isFinite(liftVal)) {
        return 'invalid'; // infinite or NaN values
      }

      return Number(liftVal) >= 0 ? 'true' : 'false'; // green on true, red on false
    },
    [control, liftValues],
  );

  const getPValueStatus = useCallback(
    (row: number): string => {
      if (row === control) {
        return 'control';
      }
      const pVal = pValues[row];
      if (Number.isNaN(pVal) || !Number.isFinite(pVal)) {
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

  if (!Array.isArray(groups) || groups.length === 0) {
    throw Error('Group by param is required');
  }

  // Render column header for each group
  const columns = groups.map((group, i) => (
    <Th key={i} column={group}>
      {group}
    </Th>
  ));
  const numGroups = groups.length;
  // Columns for p-value, lift-value, and significance (true/false)
  columns.push(
    <Th key={numGroups + 1} column="pValue">
      p-value
    </Th>,
  );
  columns.push(
    <Th key={numGroups + 2} column="liftValue">
      Lift %
    </Th>,
  );
  columns.push(
    <Th key={numGroups + 3} column="significant">
      Significant
    </Th>,
  );

  const rows = data.map((entry, i) => {
    const values = groups.map(
      (
        group,
        j, // group names
      ) => <Td key={j} column={group} data={entry.group[j]} />,
    );
    values.push(
      <Td
        key={numGroups + 1}
        className={getPValueStatus(i)}
        column="pValue"
        data={pValues[i]}
      />,
    );
    values.push(
      <Td
        key={numGroups + 2}
        className={getLiftStatus(i)}
        column="liftValue"
        data={liftValues[i]}
      />,
    );
    values.push(
      <Td
        key={numGroups + 3}
        className={getSignificance(i).toString()}
        column="significant"
        data={getSignificance(i)}
      />,
    );

    return (
      <Tr
        key={i}
        className={i === control ? 'control' : ''}
        onClick={() => handleRowClick(i)}
      >
        {values}
      </Tr>
    );
  });

  // When sorted ascending, 'control' will always be at top
  type SortConfigItem =
    | string
    | { column: string; sortFunction: (a: string, b: string) => number };

  const sortConfig: SortConfigItem[] = useMemo(
    () =>
      (groups as SortConfigItem[]).concat([
        {
          column: 'pValue',
          sortFunction: (a: string, b: string) => {
            if (a === 'control') {
              return -1;
            }
            if (b === 'control') {
              return 1;
            }

            return a > b ? 1 : -1; // p-values ascending
          },
        },
        {
          column: 'liftValue',
          sortFunction: (a: string, b: string) => {
            if (a === 'control') {
              return -1;
            }
            if (b === 'control') {
              return 1;
            }

            return parseFloat(a) > parseFloat(b) ? -1 : 1; // lift values descending
          },
        },
        {
          column: 'significant',
          sortFunction: (a: string, b: string) => {
            if (a === 'control') {
              return -1;
            }
            if (b === 'control') {
              return 1;
            }

            return a > b ? -1 : 1; // significant values first
          },
        },
      ]),
    [groups],
  );

  return (
    <div>
      <h3>{metric}</h3>
      <Table className="table" id={`table_${metric}`} sortable={sortConfig}>
        <Thead>{columns}</Thead>
        {rows}
      </Table>
    </div>
  );
}

export default TTestTable;
