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
import Select from 'react-select';
import { SupersetClient } from '@superset-ui/connection';

import Omnibar from 'omnibar';

function MathExtension(query) {
  SupersetClient.get({
      endpoint: '/dashboardasync/api/read?_oc_DashboardModelViewAsync=changed_on&_od_DashboardModelViewAsync=desc',
    })
      .then(({ json }) => {
        console.log(json.result);
      })
      .catch(() => {
        console.log('An error occurred while fethching Dashboards');
      });
  try {
    return [
      {
        title: query,
        subtitle: "Calculate: " + query
      }
    ];
  } catch (err) {
    return [];
  }
}

export default class OmniContianer extends React.Component {
  render() {
    return <Omnibar placeholder="Enter an expression" extensions={[MathExtension]} />;
  }
}

OmniContianer.propTypes = {};
OmniContianer.defaultProps = {};
