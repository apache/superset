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
import PropTypes from 'prop-types';
import { Clauses, ExpressionTypes } from './types';

export default PropTypes.oneOfType([
  PropTypes.shape({
    expressionType: PropTypes.oneOf([ExpressionTypes.Simple]).isRequired,
    clause: PropTypes.oneOf([Clauses.Having, Clauses.Where]).isRequired,
    subject: PropTypes.string.isRequired,
    comparator: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]).isRequired,
  }),
  PropTypes.shape({
    expressionType: PropTypes.oneOf([ExpressionTypes.Sql]).isRequired,
    clause: PropTypes.oneOf([Clauses.Where, Clauses.Having]).isRequired,
    sqlExpression: PropTypes.string.isRequired,
  }),
]);
