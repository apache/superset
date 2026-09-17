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

import { CSSProperties, PureComponent, ReactNode } from 'react';

interface TooltipRowData {
  key: string | number;
  keyColumn?: ReactNode;
  keyStyle?: CSSProperties;
  valueColumn: ReactNode;
  valueStyle?: CSSProperties;
}

const defaultProps = {
  className: '',
  data: [] as TooltipRowData[],
};

type Props = {
  className?: string;
  data: TooltipRowData[];
} & Readonly<typeof defaultProps>;

const VALUE_CELL_STYLE: CSSProperties = { paddingLeft: 8, textAlign: 'right' };

export default class TooltipTable extends PureComponent<Props, {}> {
  static defaultProps = defaultProps;

  render() {
    const { className, data } = this.props;

    return (
      <table className={className}>
        <tbody>
          {data.map(({ key, keyColumn, keyStyle, valueColumn, valueStyle }) => (
            <tr key={key}>
              <td style={keyStyle}>{keyColumn ?? key}</td>
              <td
                style={
                  valueStyle
                    ? { ...VALUE_CELL_STYLE, ...valueStyle }
                    : VALUE_CELL_STYLE
                }
              >
                {valueColumn}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
