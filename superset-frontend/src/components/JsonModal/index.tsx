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
import { FC, useMemo } from 'react';
import { JSONTree } from 'react-json-tree';
import { useJsonTreeTheme } from 'src/hooks/useJsonTreeTheme';
import { Button, ModalTrigger } from '@superset-ui/core/components';
import { CopyToClipboard } from '../CopyToClipboard';
import { convertBigIntStrToNumber } from './utils';
import type { JsonModalProps } from './types';

function renderBigIntStrToNumber(value: string | number) {
  return <>{convertBigIntStrToNumber(value)}</>;
}

export const JsonModal: FC<JsonModalProps> = ({
  modalTitle,
  jsonObject,
  jsonValue,
}) => {
  const jsonTreeTheme = useJsonTreeTheme();
  const content = useMemo(
    () =>
      typeof jsonValue === 'object' ? JSON.stringify(jsonValue) : jsonValue,
    [jsonValue],
  );

  return (
    <ModalTrigger
      modalBody={
        <JSONTree
          data={jsonObject}
          theme={jsonTreeTheme}
          valueRenderer={renderBigIntStrToNumber}
        />
      }
      modalFooter={
        <Button>
          <CopyToClipboard shouldShowText={false} text={content} />
        </Button>
      }
      modalTitle={modalTitle}
      triggerNode={<>{content}</>}
    />
  );
};

export type { JsonModalProps };
