// DODO was here
import React, {
  useRef,
  useMemo,
  useLayoutEffect,
  ReactElement,
  UIEventHandler,
} from 'react';
import getScrollBarSize from '../../../DataTable/utils/getScrollBarSize';
import needScrollBar from '../../../DataTable/utils/needScrollBar';
import {
  fixedTableLayout,
  mergeStyleProp,
  SetStickyState,
  StickyState,
  sum,
  Table,
  Tbody,
  Tfoot,
  Thead,
  TrWithTh,
} from '../../../DataTable';

/**
 * An HOC for generating sticky header and fixed-height scrollable area
 */

// DODO added - fragment start
export const WidthContext = React.createContext<{ colWidths: Array<number> }>({
  colWidths: [],
});
// DODO fragment stop

export function StickyWrapDodo({
  sticky = {},
  width: maxWidth,
  height: maxHeight,
  children: table,
  setStickyState,
}: {
  width: number;
  height: number;
  setStickyState: SetStickyState;
  children: Table;
  sticky?: StickyState; // current sticky element sizes
}) {
  if (!table || table.type !== 'table') {
    throw new Error('<StickyWrap> must have only one <table> element as child');
  }
  let thead: Thead | undefined;
  let tbody: Tbody | undefined;
  let tfoot: Tfoot | undefined;

  React.Children.forEach(table.props.children, node => {
    if (!node) {
      return;
    }
    if (node.type === 'thead') {
      thead = node;
    } else if (node.type === 'tbody') {
      tbody = node;
    } else if (node.type === 'tfoot') {
      tfoot = node;
    }
  });
  if (!thead || !tbody) {
    throw new Error(
      '<table> in <StickyWrap> must contain both thead and tbody.',
    );
  }
  const columnCount = useMemo(() => {
    const headerRows = React.Children.toArray(
      thead?.props.children,
    ).pop() as TrWithTh;
    return headerRows.props.children.length;
  }, [thead]);

  const theadRef = useRef<HTMLTableSectionElement>(null); // original thead for layout computation
  const tfootRef = useRef<HTMLTableSectionElement>(null); // original tfoot for layout computation
  const scrollHeaderRef = useRef<HTMLDivElement>(null); // fixed header
  const scrollFooterRef = useRef<HTMLDivElement>(null); // fixed footer
  const scrollBodyRef = useRef<HTMLDivElement>(null); // main body

  const scrollBarSize = getScrollBarSize();
  const { bodyHeight, columnWidths } = sticky;
  const needSizer =
    !columnWidths ||
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
    const fullTableHeight = (bodyThead.parentNode as HTMLTableElement)
      .clientHeight;
    const ths = bodyThead.childNodes[0]
      .childNodes as NodeListOf<HTMLTableHeaderCellElement>;
    const widths = Array.from(ths).map(
      th => th.getBoundingClientRect()?.width || th.clientWidth,
    );
    const [hasVerticalScroll, hasHorizontalScroll] = needScrollBar({
      width: maxWidth,
      height: maxHeight - theadHeight - tfootHeight,
      innerHeight: fullTableHeight,
      innerWidth: widths.reduce(sum),
      scrollBarSize,
    });
    // real container height, include table header, footer and space for
    // horizontal scroll bar
    const realHeight = Math.min(
      maxHeight,
      hasHorizontalScroll ? fullTableHeight + scrollBarSize : fullTableHeight,
    );
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

  let sizerTable: ReactElement | undefined;
  let headerTable: ReactElement | undefined;
  let footerTable: ReactElement | undefined;
  let bodyTable: ReactElement | undefined;
  if (needSizer) {
    const theadWithRef = React.cloneElement(thead, { ref: theadRef });
    const tfootWithRef = tfoot && React.cloneElement(tfoot, { ref: tfootRef });
    sizerTable = (
      <div
        key="sizer"
        style={{
          height: maxHeight,
          overflow: 'auto',
          visibility: 'hidden',
        }}
      >
        {React.cloneElement(table, {}, theadWithRef, tbody, tfootWithRef)}
      </div>
    );
  }

  // reuse previously column widths, will be updated by `useLayoutEffect` above
  const colWidths = columnWidths?.slice(0, columnCount);

  if (colWidths && bodyHeight) {
    const colgroup = (
      <colgroup>
        {colWidths.map((w, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <col key={i} width={w} />
        ))}
      </colgroup>
    );

    headerTable = (
      <div
        key="header"
        ref={scrollHeaderRef}
        style={{
          overflow: 'hidden',
        }}
      >
        {React.cloneElement(
          table,
          mergeStyleProp(table, fixedTableLayout),
          colgroup,
          thead,
        )}
        {headerTable}
      </div>
    );

    footerTable = tfoot && (
      <div
        key="footer"
        ref={scrollFooterRef}
        style={{
          overflow: 'hidden',
        }}
      >
        {React.cloneElement(
          table,
          mergeStyleProp(table, fixedTableLayout),
          colgroup,
          tfoot,
        )}
        {footerTable}
      </div>
    );

    const onScroll: UIEventHandler<HTMLDivElement> = e => {
      if (scrollHeaderRef.current) {
        scrollHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      if (scrollFooterRef.current) {
        scrollFooterRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    };
    bodyTable = (
      <div
        key="body"
        ref={scrollBodyRef}
        style={{
          height: bodyHeight,
          overflow: 'auto',
        }}
        onScroll={sticky.hasHorizontalScroll ? onScroll : undefined}
      >
        {React.cloneElement(
          table,
          mergeStyleProp(table, fixedTableLayout),
          colgroup,
          tbody,
        )}
      </div>
    );
  }

  /* DODO added - add provider */
  return (
    <WidthContext.Provider value={{ colWidths: colWidths ?? [] }}>
      <div
        style={{
          width: maxWidth,
          height: sticky.realHeight || maxHeight,
          overflow: 'hidden',
        }}
      >
        {headerTable}
        {bodyTable}
        {footerTable}
        {sizerTable}
      </div>
    </WidthContext.Provider>
  );
}
