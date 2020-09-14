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
import React from 'react';
import PropTypes from 'prop-types';

import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  column: PropTypes.object.isRequired,
};

const iconMap = {
  pk: 'fa-key',
  fk: 'fa-link',
  index: 'fa-bookmark',
};
const tooltipTitleMap = {
  pk: 'Primary Key',
  fk: 'Foreign Key',
  index: 'Index',
};

export type ColumnKeyTypeType = keyof typeof tooltipTitleMap;

interface ColumnElementProps {
  column: {
    name: string;
    keys?: { type: ColumnKeyTypeType }[];
    type: string;
  };
}

export default function ColumnElement({ column }: ColumnElementProps) {
  let columnName: React.ReactNode = column.name;
  let icons;
  if (column.keys && column.keys.length > 0) {
    columnName = <strong>{column.name}</strong>;
    icons = column.keys.map((key, i) => (
      <span key={i} className="ColumnElement">
        <OverlayTrigger
          placement="right"
          overlay={
            <Tooltip id="idx-json" bsSize="lg">
              <strong>{tooltipTitleMap[key.type]}</strong>
              <hr />
              <pre className="text-small">
                {JSON.stringify(key, null, '  ')}
              </pre>
            </Tooltip>
          }
        >
          <i className={`fa text-muted m-l-2 ${iconMap[key.type]}`} />
        </OverlayTrigger>
      </span>
    ));
  }
  return (
    <div className="clearfix table-column">
      <div className="pull-left m-l-10 col-name">
        {columnName}
        {icons}
      </div>
      <div className="pull-right text-muted">
        <small> {column.type}</small>
      </div>
    </div>
  );
}
ColumnElement.propTypes = propTypes;
