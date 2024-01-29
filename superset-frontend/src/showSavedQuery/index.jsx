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
import ReactDom from 'react-dom';
import Form from 'react-jsonschema-form';
import { interpolate } from 'src/showSavedQuery/utils';
import { styled } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';

const scheduleInfoContainer = document.getElementById('schedule-info');
const bootstrapData = getBootstrapData();
const config = bootstrapData.common.conf.SCHEDULED_QUERIES;
const { query } = bootstrapData.common;
const scheduleInfo = query.extra_json.schedule_info;
const linkback = config.linkback ? interpolate(config.linkback, query) : null;

const StyledSavedQueryContainer = styled.div`
  .btn-add {
    display: none;
  }
`;

const StyledLinkBack = styled.div`
  ${({ theme }) => `
    padding-top: 0;
    padding-right: ${theme.gridUnit * 2 + 2}px;
    padding-bottom: ${theme.gridUnit * 5}px;
    padding-left: ${theme.gridUnit / 2}px;
`}
`;

if (scheduleInfo && config) {
  // hide instructions when showing schedule info
  config.JSONSCHEMA.description = '';

  ReactDom.render(
    <StyledSavedQueryContainer>
      <Form
        schema={config.JSONSCHEMA}
        uiSchema={config.UISCHEMA}
        formData={scheduleInfo}
        disabled
      >
        <br />
      </Form>
      {linkback && (
        <StyledLinkBack className="linkback">
          <a href={linkback}>
            <i className="fa fa-link" />
            &nbsp; Pipeline status
          </a>
        </StyledLinkBack>
      )}
    </StyledSavedQueryContainer>,
    scheduleInfoContainer,
  );
}
