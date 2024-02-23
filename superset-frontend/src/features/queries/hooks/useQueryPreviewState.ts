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
import { useState, useEffect } from 'react';

type BaseQueryObject = {
  id: number;
};

export default function useQueryPreviewState<D extends BaseQueryObject = any>({
  queries,
  fetchData,
  currentQueryId,
}: {
  queries: D[];
  fetchData: (id: number) => any;
  currentQueryId: number;
}) {
  const index = queries.findIndex(query => query.id === currentQueryId);
  const [currentIndex, setCurrentIndex] = useState(index);
  const [disablePrevious, setDisablePrevious] = useState(false);
  const [disableNext, setDisableNext] = useState(false);

  function checkIndex() {
    setDisablePrevious(currentIndex === 0);
    setDisableNext(currentIndex === queries.length - 1);
  }

  function handleDataChange(previous: boolean) {
    const offset = previous ? -1 : 1;
    const index = currentIndex + offset;
    if (index >= 0 && index < queries.length) {
      fetchData(queries[index].id);
      setCurrentIndex(index);
      checkIndex();
    }
  }

  function handleKeyPress(ev: any) {
    if (currentIndex >= 0 && currentIndex < queries.length) {
      if (ev.key === 'ArrowDown' || ev.key === 'k') {
        ev.preventDefault();
        handleDataChange(false);
      } else if (ev.key === 'ArrowUp' || ev.key === 'j') {
        ev.preventDefault();
        handleDataChange(true);
      }
    }
  }

  useEffect(() => {
    checkIndex();
  });

  return {
    handleKeyPress,
    handleDataChange,
    disablePrevious,
    disableNext,
  };
}
