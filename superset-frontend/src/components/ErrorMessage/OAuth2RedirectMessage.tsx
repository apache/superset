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
import { t } from '@superset-ui/core';

import { ErrorMessageComponentProps } from './types';
import ErrorAlert from './ErrorAlert';

interface OAuth2RedirectExtra {
  url: string;
}

function OAuth2RedirectMessage({
  error,
  source = 'sqllab',
}: ErrorMessageComponentProps<OAuth2RedirectExtra>) {
  const { extra, level } = error;

  const body = (
    <p>
      This database uses OAuth2 for authentication, and will store your personal
      access tokens after authentication so that only you can use it. When you
      click the link above you will be asked to grant access to the data in a
      new window. After confirming, you can close the window and re-run the
      query here.
    </p>
  );
  const subtitle = (
    <>
      You need to{' '}
      <a href={extra.url} target="_blank" rel="noreferrer">
        provide authorization
      </a>{' '}
      in order to run this query.
    </>
  );

  return (
    <ErrorAlert
      title={t('Authorization needed')}
      subtitle={subtitle}
      level={level}
      source={source}
      body={body}
    />
  );
}

export default OAuth2RedirectMessage;
