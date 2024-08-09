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
import { FC, useRef, useEffect, memo, useState, useCallback } from 'react';
import { styled, useTheme } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import TableMetadataContent from './TableMetadataContent';
import useTableMetadataPrepare from './useTableMetadataPrepare';
import { MetadataType, useActiveTokenContext } from './AceEditorTokenProvider';

const InvisibleButton = styled.button<{
  x: number;
  y: number;
  width: number;
  visible: boolean;
}>`
  opacity: 0;
  position: fixed;
  height: 14px;
  display: ${({ visible }) => (visible ? 'block' : 'none')};
  top: ${({ y }) => y}px;
  left: ${({ x }) => x}px;
  width: ${({ width }) => width}px;
`;

const COMPONENTS = {
  [MetadataType.TABLE]: TableMetadataContent,
};

const AceEditorMetadataPopup: FC = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const activeTokenData = useActiveTokenContext();
  const { markerStyle } = activeTokenData || {};
  const metadata = activeTokenData?.metadata;
  const metadataType = activeTokenData?.metadataType;
  const Component = metadataType && COMPONENTS[metadataType];

  useTableMetadataPrepare({
    dbId: metadata?.dbId,
    schema: metadata?.schema,
    catalog: metadata?.catalog,
  });

  useEffect(() => {
    setVisible(Boolean(markerStyle));
  }, [markerStyle]);

  const onVisibleChange = useCallback((visible: boolean) => {
    if (!visible) {
      setVisible(false);
    }
  }, []);

  return (
    <Popover
      title={metadata?.title}
      content={metadata && Component && <Component {...metadata} />}
      trigger="click"
      placement="bottom"
      visible={visible}
      onVisibleChange={onVisibleChange}
      overlayStyle={{ zIndex: theme.zIndex.belowModal }}
      overlayInnerStyle={{ width: 500 }}
    >
      <InvisibleButton
        ref={buttonRef}
        x={markerStyle?.x || 0}
        y={markerStyle?.y || 0}
        width={markerStyle?.width || 0}
        visible={visible}
      >
        .
      </InvisibleButton>
    </Popover>
  );
};

export default memo(AceEditorMetadataPopup);
