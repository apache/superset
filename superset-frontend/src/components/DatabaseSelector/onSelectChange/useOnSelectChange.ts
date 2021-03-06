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

import { useEffect, useRef } from 'react';
import { factoryOnSelectChange } from './factoryOnSelectChange';

export const useOnSelectChange = ({
  setCurrentDbId,
  setCurrentSchema,
  onChange,
}: {
  setCurrentDbId: (dbId: number) => void;
  setCurrentSchema: (schema: string | undefined) => void;
  onChange?: ({
    dbId,
    schema,
  }: {
    dbId: number;
    schema?: string;
    tableName?: string;
  }) => void;
}) => {
  const onSelectChange = useRef(
    factoryOnSelectChange({
      setCurrentDbId,
      setCurrentSchema,
      onChange,
    }),
  );
  useEffect(() => {
    onSelectChange.current = factoryOnSelectChange({
      setCurrentDbId,
      setCurrentSchema,
      onChange,
    });
  }, [onChange, setCurrentDbId, setCurrentSchema]);

  return onSelectChange;
};
