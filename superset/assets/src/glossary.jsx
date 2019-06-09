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
import PropTypes from 'prop-types';

import { t } from '@superset-ui/translation';
import InlineDefinition from './components/InlineDefinition';

const words = {
  datasource: {
    word: t('datasource'),
    definition: t(`A **datasource** is a Superset abstraction that points to
      specific **table** or **view**, and extends it with **extra metadata** like
      metrics definition, calculated columns and other relevant **settings
      and properties**.`),
  },
};

const propTypes = {
  word: PropTypes.string,
  capitalized: PropTypes.boolean,
};

export default function GlossaryWord({ word, capitalized }) {
  const entry = words[word];
  const capitalizedWord = capitalized ?
    entry.word.charAt(0).toUpperCase() + entry.word.substring(1) :
    entry.word;
  return (
    <InlineDefinition
      word={capitalizedWord}
      definition={entry.definition}
    />
  );
}
GlossaryWord.propTypes = propTypes;
