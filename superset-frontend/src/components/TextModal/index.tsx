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
import { FC, ReactNode } from 'react';
import { styled } from '@apache-superset/core/theme';
import { Button, ModalTrigger } from '@superset-ui/core/components';
import { CopyToClipboard } from '../CopyToClipboard';

export interface TextModalProps {
  /** Title shown in the modal header. */
  modalTitle: string;
  /** Full, unmodified value shown in the modal body and copied verbatim. */
  value: string;
  /** Node rendered in place as the clickable trigger. Defaults to `value`. */
  triggerNode?: ReactNode;
}

/**
 * Keeps line breaks and wraps long unbroken tokens (URLs, base64, hashes)
 * so the whole value is readable without horizontal scrolling.
 */
const FullText = styled.pre`
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ${({ theme }) => theme.fontFamilyCode};
`;

/**
 * Clips the trigger to one line with an ellipsis, matching the grid's own
 * truncation. ModalTrigger wraps the trigger in a block element, which would
 * otherwise remove the ellipsis.
 */
const TriggerText = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * Renders a trigger that opens a modal with the full plain-text value and a
 * button that copies the original value to the clipboard.
 *
 * A click that ends a text selection does not open the modal, so users can
 * select or copy part of the cell without triggering it.
 */
export const TextModal: FC<TextModalProps> = ({
  modalTitle,
  value,
  triggerNode,
}) => (
  <ModalTrigger
    modalTitle={modalTitle}
    modalBody={<FullText data-test="text-modal-body">{value}</FullText>}
    modalFooter={
      <Button>
        <CopyToClipboard shouldShowText={false} text={value} />
      </Button>
    }
    triggerNode={
      <TriggerText
        onClickCapture={event => {
          if (window.getSelection()?.toString()) {
            event.stopPropagation();
          }
        }}
      >
        {triggerNode ?? value}
      </TriggerText>
    }
  />
);
