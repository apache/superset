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

import { t } from '@superset-ui/core';
import { ErrorMessageComponentProps } from './types';
import ErrorAlert from './ErrorAlert';

interface SupersetParseErrorExtra {
  sql: string;
  engine: string | null;
  line: number | null;
  column: number | null;
}

/*
 * Component for showing syntax errors in SQL Lab.
 */
function InvalidSQLErrorMessage({
  error,
  source,
  subtitle,
}: ErrorMessageComponentProps<SupersetParseErrorExtra>) {
  const { extra, level } = error;

  const { sql, line, column } = extra;
  const lines = sql.split('\n');
  let errorLine;
  if (line !== null) errorLine = lines[line - 1];
  else if (lines.length > 0) {
    errorLine = lines[0];
  }
  const body = errorLine && (
    <>
      <pre>{errorLine}</pre>
      {column !== null && <pre>{' '.repeat(column - 1)}^</pre>}
    </>
  );
  return (
    <ErrorAlert
      errorType={t('Unable to parse SQL')}
      message={subtitle}
      type={level}
      description={body}
    />
  );
}

export default InvalidSQLErrorMessage;
