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
import React, { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { Input } from 'antd';



const StyledDbTable = styled('div')`
  .grid-item {
    border: 1px solid #e0e0e0;
    padding-top: 12px;
    padding-bottom: 12px;
    padding-left: 12px;
    padding-right: 14px;
    height: 100%;
  }

  .grid-item h3 {
    margin-top: 0;
  }
`;

const DatabaseTable = ({ items }) => {
  const [filter, setFilter] = useState('');

  const header = useMemo(() => (items && items.length > 0 ? items[0] : []), [
    items,
  ]);
  const rows = useMemo(() => (items && items.length > 1 ? items.slice(1) : []), [
    items,
  ]);

  const filteredItems = useMemo(
    () =>
      rows.filter(
        row =>
          row[0] && row[0].toLowerCase().includes(filter.toLowerCase()),
      ),
    [rows, filter],
  );

  return (
    <StyledDbTable>
      <Input
        placeholder="Filter by Database Name"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ marginBottom: '5px' }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {header.map((col, index) => (
              <th key={index} className="grid-item">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="grid-item">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </StyledDbTable>
  );
};

export default DatabaseTable;
