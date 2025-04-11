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
import { FC, useEffect, useState } from 'react';

import {
  styled,
  ensureIsArray,
  t,
  getClientErrorObject,
} from '@superset-ui/core';
import Loading from 'src/components/Loading';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import ViewQuery from 'src/explore/components/controls/ViewQuery';

interface Props {
  latestQueryFormData: object;
}

type Result = {
  query: string;
  language: string;
};

const ViewQueryModalContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const ViewQueryModal: FC<Props> = props => {
  const [result, setResult] = useState<Result[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChartData = (resultType: string) => {
    setIsLoading(true);
    getChartDataRequest({
      formData: props.latestQueryFormData,
      resultFormat: 'json',
      resultType,
    })
      .then(({ json }) => {
        setResult(ensureIsArray(json.result));
        setIsLoading(false);
        setError(null);
      })
      .catch(response => {
        getClientErrorObject(response).then(({ error, message }) => {
          setError(
            error ||
              message ||
              response.statusText ||
              t('Sorry, An error occurred'),
          );
          setIsLoading(false);
        });
      });
  };
  useEffect(() => {
    loadChartData('query');
  }, [JSON.stringify(props.latestQueryFormData)]);

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <pre>{error}</pre>;
  }

  return (
    <ViewQueryModalContainer>
      {result.map(item =>
        item.query ? (
          <ViewQuery sql={item.query} language={item.language || undefined} />
        ) : null,
      )}
    </ViewQueryModalContainer>
  );
};

export default ViewQueryModal;
