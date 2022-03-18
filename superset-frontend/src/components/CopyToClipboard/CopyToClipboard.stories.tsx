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
import { useTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import Icons from 'src/components/Icons';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import CopyToClipboard from '.';

export default {
  title: 'CopyToClipboard',
  component: CopyToClipboard,
};

export const InteractiveCopyToClipboard = ({ copyNode, ...rest }: any) => {
  const theme = useTheme();
  let node = <Button>Copy</Button>;
  if (copyNode === 'Icon') {
    node = <Icons.Copy iconColor={theme.colors.grayscale.base} />;
  } else if (copyNode === 'Text') {
    node = <span role="button">Copy</span>;
  }
  return (
    <>
      <CopyToClipboard copyNode={node} {...rest} />
      <ToastContainer />
    </>
  );
};

InteractiveCopyToClipboard.args = {
  shouldShowText: true,
  text: 'http://superset.apache.org/',
  wrapped: true,
  tooltipText: 'Copy to clipboard',
  hideTooltip: false,
};

InteractiveCopyToClipboard.argTypes = {
  onCopyEnd: { action: 'onCopyEnd' },
  copyNode: {
    defaultValue: 'Button',
    control: { type: 'radio', options: ['Button', 'Icon', 'Text'] },
  },
};

InteractiveCopyToClipboard.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
