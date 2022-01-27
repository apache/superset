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
import useAsyncState from '../utils/useAsyncState';
function DefaultSearchInput({ count, value, onChange }) {
    return (<span className="dt-global-filter">
      Search{' '}
      <input className="form-control input-sm" placeholder={`${count} records...`} value={value} onChange={onChange}/>
    </span>);
}
export default React.memo(function GlobalFilter({ preGlobalFilteredRows, filterValue = '', searchInput, setGlobalFilter, }) {
    const count = preGlobalFilteredRows.length;
    const [value, setValue] = useAsyncState(filterValue, (newValue) => {
        setGlobalFilter(newValue || undefined);
    }, 200);
    const SearchInput = searchInput || DefaultSearchInput;
    return (<SearchInput count={count} value={value} onChange={e => {
            const target = e.target;
            e.preventDefault();
            setValue(target.value);
        }}/>);
});
//# sourceMappingURL=GlobalFilter.jsx.map