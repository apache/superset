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
import React, { useRef, useMemo, useLayoutEffect, useCallback, } from 'react';
import getScrollBarSize from '../utils/getScrollBarSize';
import needScrollBar from '../utils/needScrollBar';
import useMountedMemo from '../utils/useMountedMemo';
export var ReducerActions;
(function (ReducerActions) {
    ReducerActions["init"] = "init";
    ReducerActions["setStickyState"] = "setStickyState";
})(ReducerActions || (ReducerActions = {}));
const sum = (a, b) => a + b;
const mergeStyleProp = (node, style) => ({
    style: {
        ...node.props.style,
        ...style,
    },
});
const fixedTableLayout = { tableLayout: 'fixed' };
/**
 * An HOC for generating sticky header and fixed-height scrollable area
 */
function StickyWrap({ sticky = {}, width: maxWidth, height: maxHeight, children: table, setStickyState, }) {
    if (!table || table.type !== 'table') {
        throw new Error('<StickyWrap> must have only one <table> element as child');
    }
    let thead;
    let tbody;
    let tfoot;
    React.Children.forEach(table.props.children, node => {
        if (!node) {
            return;
        }
        if (node.type === 'thead') {
            thead = node;
        }
        else if (node.type === 'tbody') {
            tbody = node;
        }
        else if (node.type === 'tfoot') {
            tfoot = node;
        }
    });
    if (!thead || !tbody) {
        throw new Error('<table> in <StickyWrap> must contain both thead and tbody.');
    }
    const columnCount = useMemo(() => {
        const headerRows = React.Children.toArray(thead?.props.children).pop();
        return headerRows.props.children.length;
    }, [thead]);
    const theadRef = useRef(null); // original thead for layout computation
    const tfootRef = useRef(null); // original tfoot for layout computation
    const scrollHeaderRef = useRef(null); // fixed header
    const scrollFooterRef = useRef(null); // fixed footer
    const scrollBodyRef = useRef(null); // main body
    const scrollBarSize = getScrollBarSize();
    const { bodyHeight, columnWidths } = sticky;
    const needSizer = !columnWidths ||
        sticky.width !== maxWidth ||
        sticky.height !== maxHeight ||
        sticky.setStickyState !== setStickyState;
    // update scrollable area and header column sizes when mounted
    useLayoutEffect(() => {
        if (!theadRef.current) {
            return;
        }
        const bodyThead = theadRef.current;
        const theadHeight = bodyThead.clientHeight;
        const tfootHeight = tfootRef.current ? tfootRef.current.clientHeight : 0;
        if (!theadHeight) {
            return;
        }
        const fullTableHeight = bodyThead.parentNode
            .clientHeight;
        const ths = bodyThead.childNodes[0]
            .childNodes;
        const widths = Array.from(ths).map(th => th.clientWidth);
        const [hasVerticalScroll, hasHorizontalScroll] = needScrollBar({
            width: maxWidth,
            height: maxHeight - theadHeight - tfootHeight,
            innerHeight: fullTableHeight,
            innerWidth: widths.reduce(sum),
            scrollBarSize,
        });
        // real container height, include table header, footer and space for
        // horizontal scroll bar
        const realHeight = Math.min(maxHeight, hasHorizontalScroll ? fullTableHeight + scrollBarSize : fullTableHeight);
        setStickyState({
            hasVerticalScroll,
            hasHorizontalScroll,
            setStickyState,
            width: maxWidth,
            height: maxHeight,
            realHeight,
            tableHeight: fullTableHeight,
            bodyHeight: realHeight - theadHeight - tfootHeight,
            columnWidths: widths,
        });
    }, [maxWidth, maxHeight, setStickyState, scrollBarSize]);
    let sizerTable;
    let headerTable;
    let footerTable;
    let bodyTable;
    if (needSizer) {
        const theadWithRef = React.cloneElement(thead, { ref: theadRef });
        const tfootWithRef = tfoot && React.cloneElement(tfoot, { ref: tfootRef });
        sizerTable = (<div key="sizer" style={{
                height: maxHeight,
                overflow: 'auto',
                visibility: 'hidden',
            }}>
        {React.cloneElement(table, {}, theadWithRef, tbody, tfootWithRef)}
      </div>);
    }
    // reuse previously column widths, will be updated by `useLayoutEffect` above
    const colWidths = columnWidths?.slice(0, columnCount);
    if (colWidths && bodyHeight) {
        const bodyColgroup = (<colgroup>
        {colWidths.map((w, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <col key={i} width={w}/>))}
      </colgroup>);
        // header columns do not have vertical scroll bars,
        // so we add scroll bar size to the last column
        const headerColgroup = sticky.hasVerticalScroll && scrollBarSize ? (<colgroup>
          {colWidths.map((x, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <col key={i} width={x + (i === colWidths.length - 1 ? scrollBarSize : 0)}/>))}
        </colgroup>) : (bodyColgroup);
        headerTable = (<div key="header" ref={scrollHeaderRef} style={{
                overflow: 'hidden',
            }}>
        {React.cloneElement(table, mergeStyleProp(table, fixedTableLayout), headerColgroup, thead)}
        {headerTable}
      </div>);
        footerTable = tfoot && (<div key="footer" ref={scrollFooterRef} style={{
                overflow: 'hidden',
            }}>
        {React.cloneElement(table, mergeStyleProp(table, fixedTableLayout), headerColgroup, tfoot)}
        {footerTable}
      </div>);
        const onScroll = e => {
            if (scrollHeaderRef.current) {
                scrollHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
            if (scrollFooterRef.current) {
                scrollFooterRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
        };
        bodyTable = (<div key="body" ref={scrollBodyRef} style={{
                height: bodyHeight,
                overflow: 'auto',
            }} onScroll={sticky.hasHorizontalScroll ? onScroll : undefined}>
        {React.cloneElement(table, mergeStyleProp(table, fixedTableLayout), bodyColgroup, tbody)}
      </div>);
    }
    return (<div style={{
            width: maxWidth,
            height: sticky.realHeight || maxHeight,
            overflow: 'hidden',
        }}>
      {headerTable}
      {bodyTable}
      {footerTable}
      {sizerTable}
    </div>);
}
function useInstance(instance) {
    const { dispatch, state: { sticky }, data, page, rows, getTableSize = () => undefined, } = instance;
    const setStickyState = useCallback((size) => {
        dispatch({
            type: ReducerActions.setStickyState,
            size,
        });
    }, 
    // turning pages would also trigger a resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, getTableSize, page, rows]);
    const useStickyWrap = (renderer) => {
        const { width, height } = useMountedMemo(getTableSize, [getTableSize]) || sticky;
        // only change of data should trigger re-render
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const table = useMemo(renderer, [page, rows]);
        useLayoutEffect(() => {
            if (!width || !height) {
                setStickyState();
            }
        }, [width, height]);
        if (!width || !height) {
            return null;
        }
        if (data.length === 0) {
            return table;
        }
        return (<StickyWrap width={width} height={height} sticky={sticky} setStickyState={setStickyState}>
        {table}
      </StickyWrap>);
    };
    Object.assign(instance, {
        setStickyState,
        wrapStickyTable: useStickyWrap,
    });
}
export default function useSticky(hooks) {
    hooks.useInstance.push(useInstance);
    hooks.stateReducers.push((newState, action_, prevState) => {
        const action = action_;
        if (action.type === ReducerActions.init) {
            return {
                ...newState,
                sticky: {
                    ...prevState?.sticky,
                },
            };
        }
        if (action.type === ReducerActions.setStickyState) {
            const { size } = action;
            if (!size) {
                return { ...newState };
            }
            return {
                ...newState,
                sticky: {
                    ...prevState?.sticky,
                    ...newState?.sticky,
                    ...action.size,
                },
            };
        }
        return newState;
    });
}
useSticky.pluginName = 'useSticky';
//# sourceMappingURL=useSticky.jsx.map