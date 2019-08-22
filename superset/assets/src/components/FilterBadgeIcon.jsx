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

import './FilterBadgeIcon.css';

const propTypes = {
  colorCode: PropTypes.string,
};

export default function FilterBadgeIcon({ colorCode = '' }) {
  return (
    <svg className={`filter-badge ${colorCode}`} width="20" height="20" viewBox="0 0 20 20">
      <path d="M4 5H16V7H4V5ZM6 9H14V11H6V9ZM12 13H8V15H12V13Z" fill="#fff" />
    </svg>
  );
}

FilterBadgeIcon.propTypes = propTypes;
