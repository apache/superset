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
import { SQL_KEYWORD_AUTOCOMPLETE_SCORE } from '../constants';

const SQL_KEYWORDS = [
  'AND',
  'AS',
  'ASC',
  'AVG',
  'BY',
  'CASE',
  'COUNT',
  'CREATE',
  'CROSS',
  'DATABASE',
  'DEFAULT',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'ELSE',
  'END',
  'FOREIGN',
  'FROM',
  'GRANT',
  'GROUP',
  'HAVING',
  'IF',
  'INNER',
  'INSERT',
  'JOIN',
  'KEY',
  'LEFT',
  'LIMIT',
  'MAX',
  'MIN',
  'NATURAL',
  'NOT',
  'NULL',
  'OFFSET',
  'ON',
  'OR',
  'ORDER',
  'OUTER',
  'PRIMARY',
  'REFERENCES',
  'RIGHT',
  'SELECT',
  'SUM',
  'TABLE',
  'THEN',
  'TYPE',
  'UNION',
  'UPDATE',
  'WHEN',
  'WHERE',
];

const SQL_DATA_TYPES = [
  'BIGINT',
  'BINARY',
  'BIT',
  'CHAR',
  'DATE',
  'DECIMAL',
  'DOUBLE',
  'FLOAT',
  'INT',
  'INTEGER',
  'MONEY',
  'NUMBER',
  'NUMERIC',
  'REAL',
  'SET',
  'TEXT',
  'TIMESTAMP',
  'VARCHAR',
];

const allKeywords = SQL_KEYWORDS.concat(SQL_DATA_TYPES);

const sqlKeywords = allKeywords.map((keyword) => ({
  meta: 'sql',
  name: keyword,
  score: SQL_KEYWORD_AUTOCOMPLETE_SCORE,
  value: keyword,
}));

export default sqlKeywords;
