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
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { IconTooltip } from 'src/components/IconTooltip';
import ModalTrigger from 'src/components/ModalTrigger';

SyntaxHighlighter.registerLanguage('sql', sql);

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
        <IconTooltip
          className="fa fa-eye pull-left m-l-2"
          tooltip={tooltipText}
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
