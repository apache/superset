import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Loading from 'src/components/Loading';
import { updateQueryEditor } from 'src/SqlLab/actions/sqlLab';

import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';

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

// loading = show loading
// step1 = show query
// step2 = show results

const ValidateQuery = ({
  queryEditorId,
  onSave = () => {},
  onUpdate,
  saveQueryWarning,
  database,
  columns,
}: ValidateQueryProps) => {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState('step1');
  const dispatch = useDispatch();
  const editor = useSelector(state => state.sqlLab.queryEditors[0]);
  const unsavedQuery = useSelector(
    state => state.sqlLab.unsavedQueryEditor.sql,
  );

  const queryToValidate =
    unsavedQuery !== undefined ? unsavedQuery : editor.sql;

  const fixedQuery = `${queryToValidate} AND 1=1`;

  const onClose = () => {
    setStep('step1');
    setShowModal(false);
  };

  const onRunValidate = () => {
    setStep('loading');
    setTimeout(() => setStep('step2'), 1500);
  };
  const onAcceptChanges = () => {
    setStep('step1');
    dispatch(updateQueryEditor({ remoteId: editor.remoteId, sql: fixedQuery }));
    setShowModal(false);
  };

  return (
    <div>
      <Button
        style={{
          height: 32,
          padding: '4px 15px',
        }}
        onClick={() => {
          setShowModal(true);
        }}
        key="validate-btn"
        tooltip="Fix Query"
        disabled={false}
      >
        Fix Query
      </Button>
      <Modal
        className="save-query-modal"
        onHandledPrimaryAction={onRunValidate}
        onHide={onClose}
        primaryButtonName="Fix query"
        width="620px"
        show={showModal}
        title={<h4>{t('Fix query')}</h4>}
        footer={
          <>
            <Button onClick={onClose} data-test="cancel-query" cta>
              {t('Cancel')}
            </Button>
            {step === 'step1' || step === 'loading' ? (
              <Button
                buttonStyle="primary"
                onClick={onRunValidate}
                className="m-r-3"
                cta
                disabled={step === 'loading'}
              >
                {t('Fix Query')}
              </Button>
            ) : null}
            {step === 'step2' ? (
              <Button
                buttonStyle="primary"
                onClick={onAcceptChanges}
                className="m-r-3"
                cta
              >
                {t('Accept changes')}
              </Button>
            ) : null}
          </>
        }
      >
        <div>
          {step === 'step1' ? (
            <>
              <div style={{ padding: '8px 0px' }}>
                If your query below contains errors, we will evaluate it and
                recommend fixes.
              </div>
              <SyntaxHighlighter language="sql" style={github}>
                {queryToValidate}
              </SyntaxHighlighter>
              <div>
                Click <strong>Fix query</strong> below to begin.
              </div>
            </>
          ) : null}
          {step === 'loading' ? (
            <div style={{ height: '100px' }}>
              <Loading />
            </div>
          ) : null}
          {step === 'step2' ? (
            <>
              <div style={{ padding: '8px 0px' }}>
                Please see our recommended changes to your query below:
              </div>
              <SyntaxHighlighter language="sql" style={github}>
                {fixedQuery}
              </SyntaxHighlighter>
              <div>
                To update your editor with these recommended changes, click
                <strong>Accept changes</strong> below.
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

export default ValidateQuery;
