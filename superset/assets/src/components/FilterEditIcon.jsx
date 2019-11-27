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

import './FilterEditIcon.less';

const propTypes = {
  clickIconHandler: PropTypes.func,
};

export default function FilterEditIcon({ clickIconHandler = () => {} }) {
  return (
    <svg
      width="12"
      height="12"
      onClick={clickIconHandler}
      className="filter-edit"
      viewBox="0 0 12 12"
    >
      <path d="M11.8049 1.75476C12.0649 2.01472 12.0649 2.43466 11.8049 2.69463L10.5851 3.91446L8.08547 1.4148L9.3053 0.194973C9.56526 -0.064991 9.9852 -0.064991 10.2452 0.194973L11.8049 1.75476ZM0 12V9.50035L7.37231 2.12804L9.87196 4.62769L2.49965 12H0Z" />
    </svg>
  );
}

FilterEditIcon.propTypes = propTypes;
