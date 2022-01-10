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
import React, { SetStateAction, useEffect, useState } from 'react';
import { styled } from '@superset-ui/core';
import { ConciseCardProps } from './types';
import SubChart from './Components/SubChart/SubChart';
import { OPERATOR_ID_EQUALS, runCustomQuery } from './plugin/CustomApiUtils';

const Styles = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: 400px;
  width: 900px;
  overflow: hidden;
  padding-bottom: 10px;
  margin-bottom: 10px;
`;

export default function ConciseCard(props: ConciseCardProps) {
  const { data, formData, firstFilterData, secondFilterData } = props;

  const [firstFilterValue, setFirstFilterValue] = useState('');
  const [secondFilterValue, setSecondFilterValue] = useState('');
  const [firstFilterQueriedValue, setFirstFilterQueriedValue] = useState('');
  const [secondFilterQueriedValue, setSecondFilterQueriedValue] = useState('');
  const [shouldRunQuery, setShouldRunQuery] = useState(false);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [customData, setCustomData] = useState(null);

  const firstFilterValueChanged = firstFilterValue && firstFilterValue !== firstFilterQueriedValue;
  const secondFilterValueChanged =
    secondFilterValue && secondFilterValue !== secondFilterQueriedValue;

  const enableRunButton: boolean = Boolean(
    !isQueryRunning && (secondFilterValueChanged || firstFilterValueChanged),
  );

  if (shouldRunQuery && (secondFilterValueChanged || firstFilterValueChanged)) {
    setIsQueryRunning(true);
    setShouldRunQuery(false);
    runCustomQuery(
      formData,
      firstFilterValue || firstFilterQueriedValue,
      secondFilterValue || secondFilterQueriedValue,
      firstFilterData.colnames[0],
      secondFilterData.colnames[0],
    )
      .then(r => {
        setCustomData(r.json.result[0].data[0] || {});
      })
      .catch(e => console.log(e))
      .finally(() => setIsQueryRunning(false));
  }

  const { adhocFilters } = formData;
  // @ts-ignore
  const customAdhocFilters = customData ? customData.adhocFilters : null;

  useEffect(() => {
    const relevantFilters = customAdhocFilters || adhocFilters;
    if (relevantFilters) {
      relevantFilters.forEach(
        (filter: { operatorId: string; subject: string; comparator: SetStateAction<any> }) => {
          if (filter.operatorId === OPERATOR_ID_EQUALS) {
            if (filter.subject === firstFilterData.colnames[0]) {
              setFirstFilterQueriedValue(filter.comparator);
            }
            if (filter.subject === firstFilterData.colnames[0]) {
              setSecondFilterQueriedValue(filter.comparator);
            }
          }
        },
      );
    }
  }, [adhocFilters, customAdhocFilters]);

  const firstData = data[0];

  const filterFieldsData = [];

  filterFieldsData.push({
    filterData: firstFilterData,
    filterValue: firstFilterValue,
    setFilterValue: setFirstFilterValue,
    queriedValue: firstFilterQueriedValue,
  });

  filterFieldsData.push({
    filterData: secondFilterData,
    filterValue: secondFilterValue,
    setFilterValue: setSecondFilterValue,
    queriedValue: secondFilterQueriedValue,
  });

  return (
    <Styles>
      {formData && (
        <SubChart
          borderTopColor={'#450097'}
          data={customData || firstData}
          formData={formData}
          filterFieldsData={filterFieldsData}
          setShouldRunQuery={setShouldRunQuery}
          enableRunButton={enableRunButton}
          isQueryRunning={isQueryRunning}
        />
      )}
    </Styles>
  );
}
