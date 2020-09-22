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
import SyntaxHighlighter, {
  registerLanguage,
  // @ts-ignore
} from 'react-syntax-highlighter/dist/light';
// @ts-ignore
import sql from 'react-syntax-highlighter/dist/languages/hljs/sql';
// @ts-ignore
import github from 'react-syntax-highlighter/dist/styles/hljs/github';

import Link from '../../components/Link';
import ModalTrigger from '../../components/ModalTrigger';

registerLanguage('sql', sql);

interface ShowSQLProps {
  sql: string;
  title: string;
  tooltipText: string;
}

export default function ShowSQL({
  tooltipText,
  title,
  sql: sqlString,
}: ShowSQLProps) {
  return (
    <ModalTrigger
      modalTitle={title}
      triggerNode={
        <Link
          className="fa fa-eye pull-left m-l-2"
          tooltip={tooltipText}
          href="#"
        />
      }
      modalBody={
        <div>
          <SyntaxHighlighter language="sql" style={github}>
            {sqlString}
          </SyntaxHighlighter>
        </div>
      }
    />
  );
}
