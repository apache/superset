import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';

import Loading from 'src/components/Loading';
import { updateQueryEditor } from 'src/SqlLab/actions/sqlLab';

import type { DatabaseObject } from 'src/features/databases/types';
import { Row, Col } from 'src/components';
import { Input, TextArea } from 'src/components/Input';
import { t, styled } from '@superset-ui/core';
import Button from 'src/components/Button';
import { Menu } from 'src/components/Menu';
import { Form, FormItem } from 'src/components/Form';
import Modal from 'src/components/Modal';
import SaveDatasetActionButton from 'src/SqlLab/components/SaveDatasetActionButton';
import {
  SaveDatasetModal,
  ISaveableDatasource,
} from 'src/SqlLab/components/SaveDatasetModal';
import { getDatasourceAsSaveableDataset } from 'src/utils/datasourceUtils';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { QueryEditor } from 'src/SqlLab/types';
import _ from 'lodash';

interface ValidateQueryProps {
  queryEditorId: string;
  columns: ISaveableDatasource['columns'];
  onSave: (arg0: QueryPayload, id: string) => void;
  onUpdate: (arg0: QueryPayload, id: string) => void;
  saveQueryWarning: string | null;
  database: Partial<DatabaseObject> | undefined;
}

export type QueryPayload = {
  name: string;
  description?: string;
  id?: string;
  remoteId?: number;
} & Pick<QueryEditor, 'dbId' | 'schema' | 'sql'>;

const Styles = styled.span`
  span[role='img'] {
    display: flex;
    margin: 0;
    color: ${({ theme }) => theme.colors.grayscale.base};
    svg {
      vertical-align: -${({ theme }) => theme.gridUnit * 1.25}px;
      margin: 0;
    }
  }
`;

/*

activity item 
{
  type: 'userRequest', 'systemResponse', 'action';
  userRequest: string;
  systemResponse: string;
  action: string;
}

*/

type ActivityType = 'userRequest' | 'systemResponse' | 'userAction';

interface Activity {
  type: ActivityType;
  userRequest?: string;
  systemResponse?: string;
  userAction?: string;
}

const GenerateQuery = ({
  queryEditorId,
  onSave = () => {},
  onUpdate,
  saveQueryWarning,
  database,
  columns,
}: ValidateQueryProps) => {
  const dispatch = useDispatch();
  const editor = useSelector(state => state.sqlLab.queryEditors[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [showModal, setShowModal] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [request, setRequest] = useState('');

  const onTextAreaChange = (props: any) => {
    setRequest(props.target.value);
  };

  const onClose = () => {
    setShowModal(false);
  };

  const onApplyQuery = (query: string) => {
    dispatch(updateQueryEditor({ remoteId: editor.remoteId, sql: query }));
    setActivity([
      ...activity,
      {
        type: 'userAction',
        userAction: 'Query applied',
      },
    ]);
  };

  const onUserRequest = () => {
    setIsLoading(true);
    console.log('onUserRequest', request);
    setActivity([
      ...activity,
      {
        type: 'userRequest',
        userRequest: request,
      },
    ]);
    setTimeout(() => {
      setIsLoading(false);
      setActivity([
        ...activity,
        {
          type: 'userRequest',
          userRequest: request,
        },
        {
          type: 'systemResponse',
          systemResponse: 'SELECT awesome FROM system LIMIT 1000',
        },
      ]);
    }, 1500);
    setRequest('');
  };

  return (
    <div>
      <Button
        style={{ height: 32, padding: '4px 15px' }}
        onClick={() => {
          console.log('validate');
          setShowModal(true);
        }}
        key="validate-btn"
        tooltip="Generate Query"
        disabled={false}
      >
        Generate
      </Button>
      <Modal
        className="save-query-modal"
        onHandledPrimaryAction={onUserRequest}
        onHide={onClose}
        primaryButtonName="Send request"
        width="620px"
        show={showModal}
        title={<h4>{t('Generate SQL')}</h4>}
        footer={
          <>
            <Button onClick={onClose} data-test="cancel-query" cta>
              {t('Cancel')}
            </Button>
            <Button
              buttonStyle="primary"
              onClick={onUserRequest}
              className="m-r-3"
              cta
            >
              {t('Send request')}
            </Button>
          </>
        }
      >
        <div>
          <div>
            {activity.map(item => {
              switch (item.type) {
                case 'userRequest':
                  return (
                    <div
                      style={{
                        padding: '4px',
                      }}
                    >
                      <div>You wrote:</div>
                      <div
                        style={{
                          border: 'solid 1px #ccc',
                          backgroundColor: '#eee',
                          padding: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        {item.userRequest}
                      </div>
                    </div>
                  );
                case 'systemResponse':
                  return (
                    <div
                      style={{
                        padding: '4px',
                      }}
                    >
                      <div>System response:</div>
                      <div
                        style={{
                          border: 'solid 1px #ccc',
                          backgroundColor: '#eee',
                          padding: '8px',
                          marginBottom: '8px',
                        }}
                      >
                        <SyntaxHighlighter language="sql" style={github}>
                          {item.systemResponse}
                        </SyntaxHighlighter>
                        <div>
                          <Button
                            onClick={() => onApplyQuery(item.systemResponse)}
                          >
                            {t('Apply query')}
                          </Button>{' '}
                        </div>
                      </div>
                    </div>
                  );
                case 'userAction':
                  return <div>userAction</div>;
                default:
                  return null;
              }
            })}
            {isLoading === true ? (
              <div style={{ height: '80px', padding: '8px' }}>
                <Loading position="inline-centered" />
              </div>
            ) : null}
          </div>
          <div style={{ padding: '8px 0px' }}>
            Describe the data you are looking for, and we will generate a query
            for you.
          </div>
          <div>
            <TextArea rows={4} value={request} onChange={onTextAreaChange} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GenerateQuery;
