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
import AsyncEsmComponent from 'src/components/AsyncEsmComponent';

const AsyncAceEditor = AsyncEsmComponent(async () => {
  const { default: ace } = await import('brace');
  const { default: ReactAceEditor } = await import('react-ace');

  await Promise.all([
    import('brace/mode/sql'),
    import('brace/theme/github'),
    import('brace/ext/language_tools'),
  ]);

  return React.forwardRef(function ExtendedAceEditor(
    { keywords, mode, ...props },
    ref,
  ) {
    if (keywords && mode === 'sql') {
      console.log(keywords);
      const langTools = ace.acequire('ace/ext/language_tools');
      const completer = {
        getCompletions: (aceEditor, session, pos, prefix, callback) => {
          callback(null, keywords);
        },
      };
      langTools.setCompleters([completer]);
    }
    return <ReactAceEditor ref={ref} mode={mode} {...props} />;
  });
});

export default AsyncAceEditor;
