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
import React, { useMemo, useCallback, RefObject, createRef } from 'react';
import moment from 'moment';
import { useDispatch } from 'react-redux';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useInView } from 'react-intersection-observer';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import { DashboardState } from 'src/dashboard/types';
import {
  saveDashboardRequest,
  setOverrideConfirm,
} from 'src/dashboard/actions/dashboardState';
import { t, styled } from '@superset-ui/core';
import { SAVE_TYPE_OVERWRITE_CONFIRMED } from 'src/dashboard/util/constants';

const STICKY_HEADER_TOP = 16;
const STICKY_HEADER_HEIGHT = 32;

const StyledTitle = styled.h2`
  ${({ theme }) => `
     color:  ${theme.colors.grayscale.dark1}
   `}
`;

const StyledEditor = styled.div`
  ${({ theme }) => `
     table {
       border: 1px ${theme.colors.grayscale.light2} solid;
     }
     pre {
       font-size: 11px;
       padding: 0px;
       background-color: transparent;
       border: 0px;
       line-height: 110%;
     }
   `}
`;

const StackableHeader = styled(Button)<{ top: number }>`
  ${({ theme, top }) => `
     position: sticky;
     top: ${top}px;
     background-color: ${theme.colors.grayscale.light5};
     margin: 0px;
     padding: 8px 4px;
     z-index: 1;
     border: 0px;
     border-radius: 0px;
     width: 100%;
     justify-content: flex-start;
     border-bottom: 1px ${theme.colors.grayscale.light1} solid;
     &::before {
       display: inline-block;
       position: relative;
       opacity: 1;
       content: "\\00BB";
     }
   `}
`;

const StyledBottom = styled.div<{ inView: boolean }>`
  ${({ inView }) => `
     margin: 8px auto;
     text-align: center;
     opacity: ${inView ? 0 : 1};
  `}
`;

type Props = {
  overwriteConfirmMetadata: DashboardState['overwriteConfirmMetadata'];
};

const OverrideConfirmModal = ({ overwriteConfirmMetadata }: Props) => {
  const [bottomRef, hasReviewed] = useInView({ triggerOnce: true });
  const dispatch = useDispatch();
  const onHide = useCallback(
    () => dispatch(setOverrideConfirm(undefined)),
    [dispatch],
  );
  const anchors = useMemo<RefObject<HTMLDivElement>[]>(
    () =>
      overwriteConfirmMetadata
        ? overwriteConfirmMetadata.overwriteConfirmItems.map(() =>
            createRef<HTMLDivElement>(),
          )
        : [],
    [overwriteConfirmMetadata],
  );
  const onAnchorClicked = useCallback(
    (index: number) => {
      anchors[index]?.current?.scrollIntoView({ behavior: 'smooth' });
    },
    [anchors],
  );
  const onConfirmOverwrite = useCallback(() => {
    if (overwriteConfirmMetadata) {
      dispatch(
        saveDashboardRequest(
          overwriteConfirmMetadata.data,
          overwriteConfirmMetadata.dashboardId,
          SAVE_TYPE_OVERWRITE_CONFIRMED,
        ),
      );
    }
  }, [dispatch, overwriteConfirmMetadata]);

  return (
    <Modal
      responsive
      maxWidth="1024px"
      height="50vh"
      show={Boolean(overwriteConfirmMetadata)}
      title={t('Confirm overwrite')}
      footer={
        <>
          {t('Scroll down to the bottom to enable overwriting changes. ')}
          <Button
            htmlType="button"
            buttonSize="small"
            onClick={onHide}
            data-test="override-confirm-modal-cancel-button"
            cta
          >
            {t('No')}
          </Button>
          <Button
            data-test="overwrite-confirm-save-button"
            htmlType="button"
            buttonSize="small"
            cta
            buttonStyle="primary"
            onClick={onConfirmOverwrite}
            disabled={!hasReviewed}
          >
            {t('Yes, overwrite changes')}
          </Button>
        </>
      }
      onHide={onHide}
    >
      {overwriteConfirmMetadata && (
        <>
          <StyledTitle>
            {t('Are you sure you intend to overwrite the following values?')}
          </StyledTitle>
          <StyledEditor>
            {overwriteConfirmMetadata.overwriteConfirmItems.map(
              ({ keyPath, oldValue, newValue }, index) => (
                <React.Fragment key={keyPath}>
                  <div ref={anchors[index]} />
                  <StackableHeader
                    top={index * STICKY_HEADER_HEIGHT - STICKY_HEADER_TOP}
                    buttonStyle="tertiary"
                    onClick={() => onAnchorClicked(index)}
                  >
                    {keyPath}
                  </StackableHeader>
                  <ReactDiffViewer
                    oldValue={oldValue}
                    newValue={newValue}
                    leftTitle={t(
                      'Last Updated %s by %s',
                      moment.utc(overwriteConfirmMetadata.updatedAt).calendar(),
                      overwriteConfirmMetadata.updatedBy,
                    )}
                    rightTitle="new value"
                  />
                </React.Fragment>
              ),
            )}
            <StyledBottom ref={bottomRef} inView={hasReviewed}>
              {/* Add submit button at the bottom in case of intersection-observer fallback */}
              <Button
                htmlType="button"
                buttonSize="small"
                cta
                buttonStyle="primary"
                onClick={onConfirmOverwrite}
              >
                {t('Yes, overwrite changes')}
              </Button>
            </StyledBottom>
          </StyledEditor>
        </>
      )}
    </Modal>
  );
};

export default OverrideConfirmModal;
