/*
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
// eslint-disable-next-line no-restricted-syntax
import React from "react";
import { Avatar } from "@apache-superset/core";
import { MetadataRow } from "./types";

const BORDER_COLOR = "#e0e0e0";
const HEADER_COLOR = "#f7f7f7";
const CELL_STYLE = {
  padding: "4px 8px",
  borderColor: BORDER_COLOR,
  borderWidth: 1,
  borderStyle: "solid",
};

const getInitials = (fullName: string): string =>
  fullName
    .split(" ")
    .map((name) => name[0].toUpperCase())
    .join("");

const Table: React.FC<{ metadata: MetadataRow[] }> = ({ metadata }) => (
  <table
    style={{
      width: "100%",
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: BORDER_COLOR,
      fontSize: "12px",
    }}
  >
    <thead>
      <tr>
        <th style={{ ...CELL_STYLE, background: HEADER_COLOR }}>
          Dataset name
        </th>
        <th style={{ ...CELL_STYLE, background: HEADER_COLOR }}>Owners</th>
        <th style={{ ...CELL_STYLE, background: HEADER_COLOR }}>
          Latest available partition
        </th>
        <th style={{ ...CELL_STYLE, background: HEADER_COLOR }}>
          Estimated row count
        </th>
      </tr>
    </thead>
    <tbody>
      {metadata?.length > 0 ? (
        metadata.map((row, index) => (
          <tr key={index}>
            <td style={CELL_STYLE}>{row.dataset_name}</td>
            <td style={CELL_STYLE}>
              {row.owners.map((owner: string, idx: number) => {
                const color = `#${Math.floor(Math.random() * 10777215).toString(
                  16
                )}`;
                return (
                  <span title={owner} key={idx}>
                    <Avatar
                      alt={owner}
                      style={{
                        backgroundColor: color,
                        borderColor: color,
                        marginRight: 4,
                      }}
                    >
                      {getInitials(owner)}
                    </Avatar>
                  </span>
                );
              })}
            </td>
            <td style={CELL_STYLE}>{row.latest_partition}</td>
            <td style={CELL_STYLE}>
              {row.estimated_row_count?.toLocaleString()}
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={4} style={CELL_STYLE}>
            No data available
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export default Table;
