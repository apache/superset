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
import { css, styled } from '@apache-superset/core';
import { t } from '@superset-ui/core';
import { Flex } from '@superset-ui/core/components';
import { Timer } from '@superset-ui/core/components/Timer';
import { useSelector } from 'react-redux';
import {
  SQL_EDITOR_STATUSBAR_HEIGHT,
  STATE_TYPE_MAP,
} from 'src/SqlLab/constants';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { SqlLabRootState } from 'src/SqlLab/types';

const Container = styled(Flex)`
  height: ${SQL_EDITOR_STATUSBAR_HEIGHT}px;
  background-color: ${({ theme }) => theme.colorPrimary};
  color: ${({ theme }) => theme.colorWhite};
  padding: 0 ${({ theme }) => theme.sizeUnit * 4}px;

  & .ant-tag {
    color: ${({ theme }) => theme.colorWhite};
    background-color: transparent;
    border: 0;
  }
`;

export interface StatusBarProps {
  queryEditorId: string;
}

const StatusBar = ({ queryEditorId }: StatusBarProps) => {
  const { latestQueryId } = useQueryEditor(queryEditorId, ['latestQueryId']);
  const queries = useSelector<
    SqlLabRootState,
    SqlLabRootState['sqlLab']['queries']
  >(({ sqlLab }) => sqlLab.queries);
  const latestQuery = queries[latestQueryId ?? ''];

  return (
    <Container align="center" justify="space-bewteen">
      <div
        css={css`
          flex: 1;
        `}
      >
        &nbsp;
      </div>
      {latestQuery && (
        <Flex align="center">
          <b>{t('Execution (s)')}</b>
          <Timer
            startTime={latestQuery.startDttm}
            endTime={latestQuery.endDttm}
            status={STATE_TYPE_MAP[latestQuery.state]}
            isRunning={latestQuery.state === 'running'}
          />
        </Flex>
      )}
    </Container>
  );
};

export default StatusBar;
