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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Button, Icons, Tooltip } from '@superset-ui/core/components';
import {
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
} from 'src/SqlLab/constants';

const Container = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    white-space: nowrap;
    user-select: none;
  `}
`;

const SizeValue = styled.span`
  min-width: 20px;
  text-align: center;
`;

export interface TextSizeEditorProps {
  fontSize: number;
  onIncreaseFontSize: () => void;
  onDecreaseFontSize: () => void;
  onResetFontSize: () => void;
}

const TextSizeEditor = ({
  fontSize,
  onIncreaseFontSize,
  onDecreaseFontSize,
  onResetFontSize,
}: TextSizeEditorProps) => (
  <Container data-test="text-size-editor">
    {t('Text size')}
    <Tooltip title={t('Decrease text size')}>
      <Button
        buttonSize="small"
        buttonStyle="link"
        icon={<Icons.MinusCircleOutlined iconSize="l" />}
        onClick={onDecreaseFontSize}
        disabled={fontSize <= MIN_EDITOR_FONT_SIZE}
        aria-label={t('Decrease text size')}
      />
    </Tooltip>
    <SizeValue data-test="text-size-value">{fontSize}</SizeValue>
    <Tooltip title={t('Increase text size')}>
      <Button
        buttonSize="small"
        buttonStyle="link"
        icon={<Icons.PlusCircleOutlined iconSize="l" />}
        onClick={onIncreaseFontSize}
        disabled={fontSize >= MAX_EDITOR_FONT_SIZE}
        aria-label={t('Increase text size')}
      />
    </Tooltip>
    <Button buttonSize="small" buttonStyle="link" onClick={onResetFontSize}>
      {t('Reset')}
    </Button>
  </Container>
);

export default TextSizeEditor;
