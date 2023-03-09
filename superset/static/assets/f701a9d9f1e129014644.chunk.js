"use strict";(globalThis.webpackChunksuperset=globalThis.webpackChunksuperset||[]).push([[986],{52564:(e,t,n)=>{n.d(t,{u:()=>D});var l=n(5872),i=n.n(l),r=n(67294),o=n(11965),s=n(51995),a=n(55867),d=n(4715),c=n(58593),u=n(99612);const h=e=>o.iv`
  display: flex;
  font-size: ${e.typography.sizes.xl}px;
  font-weight: ${e.typography.weights.bold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  & .dynamic-title,
  & .dynamic-title-input {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & .dynamic-title {
    cursor: default;
  }
  & .dynamic-title-input {
    border: none;
    padding: 0;
    outline: none;

    &::placeholder {
      color: ${e.colors.grayscale.light1};
    }
  }

  & .input-sizer {
    position: absolute;
    left: -9999px;
    display: inline-block;
  }
`,p=e=>{let{title:t,placeholder:n,onSave:l,canEdit:i,label:s}=e;const[d,p]=(0,r.useState)(!1),[g,f]=(0,r.useState)(t||""),v=(0,r.useRef)(null),[m,b]=(0,r.useState)(!1),{width:w,ref:y}=(0,u.NB)(),{width:x,ref:D}=(0,u.NB)({refreshMode:"debounce"});(0,r.useEffect)((()=>{f(t)}),[t]),(0,r.useEffect)((()=>{if(d&&null!=v&&v.current&&(v.current.focus(),v.current.setSelectionRange)){const{length:e}=v.current.value;v.current.setSelectionRange(e,e),v.current.scrollLeft=v.current.scrollWidth}}),[d]),(0,r.useLayoutEffect)((()=>{null!=y&&y.current&&(y.current.innerHTML=(g||n).replace(/\s/g,"&nbsp;"))}),[g,n,y]),(0,r.useEffect)((()=>{v.current&&v.current.scrollWidth>v.current.clientWidth?b(!0):b(!1)}),[w,x]);const E=(0,r.useCallback)((()=>{i&&!d&&p(!0)}),[i,d]),S=(0,r.useCallback)((()=>{if(!i)return;const e=g.trim();f(e),t!==e&&l(e),p(!1)}),[i,g,l,t]),C=(0,r.useCallback)((e=>{i&&d&&f(e.target.value)}),[i,d]),R=(0,r.useCallback)((e=>{var t;i&&"Enter"===e.key&&(e.preventDefault(),null==(t=v.current)||t.blur())}),[i]);return(0,o.tZ)("div",{css:h,ref:D},(0,o.tZ)(c.u,{id:"title-tooltip",title:m&&g&&!d?g:null},i?(0,o.tZ)("input",{className:"dynamic-title-input","aria-label":null!=s?s:(0,a.t)("Title"),ref:v,onChange:C,onBlur:S,onClick:E,onKeyPress:R,placeholder:n,value:g,css:o.iv`
              cursor: ${d?"text":"pointer"};

              ${w&&w>0&&o.iv`
                width: ${w+1}px;
              `}
            `}):(0,o.tZ)("span",{className:"dynamic-title","aria-label":null!=s?s:(0,a.t)("Title"),ref:v},g)),(0,o.tZ)("span",{ref:y,className:"input-sizer","aria-hidden":!0,tabIndex:-1}))};var g=n(79789),f=n(36674),v=n(70163),m=n(35932);const b=e=>o.iv`
  width: ${8*e.gridUnit}px;
  height: ${8*e.gridUnit}px;
  padding: 0;
  border: 1px solid ${e.colors.primary.dark2};

  &.ant-btn > span.anticon {
    line-height: 0;
    transition: inherit;
  }

  &:hover:not(:focus) > span.anticon {
    color: ${e.colors.primary.light1};
  }
`,w=e=>o.iv`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: space-between;
  background-color: ${e.colors.grayscale.light5};
  height: ${16*e.gridUnit}px;
  padding: 0 ${4*e.gridUnit}px;

  .editable-title {
    overflow: hidden;

    & > input[type='button'],
    & > span {
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      white-space: nowrap;
    }
  }

  span[role='button'] {
    display: flex;
    height: 100%;
  }

  .title-panel {
    display: flex;
    align-items: center;
    min-width: 0;
    margin-right: ${12*e.gridUnit}px;
  }

  .right-button-panel {
    display: flex;
    align-items: center;
  }
`,y=e=>o.iv`
  display: flex;
  align-items: center;
  padding-left: ${2*e.gridUnit}px;

  & .fave-unfave-icon {
    padding: 0 ${e.gridUnit}px;

    &:first-of-type {
      padding-left: 0;
    }
  }
`,x=e=>o.iv`
  margin-left: ${2*e.gridUnit}px;
`,D=e=>{let{editableTitleProps:t,showTitlePanelItems:n,certificatiedBadgeProps:l,showFaveStar:r,faveStarProps:c,titlePanelAdditionalItems:u,rightPanelAdditionalItems:h,additionalActionsMenu:D,menuDropdownProps:E,tooltipProps:S}=e;const C=(0,s.Fg)();return(0,o.tZ)("div",{css:w,className:"header-with-actions"},(0,o.tZ)("div",{className:"title-panel"},(0,o.tZ)(p,t),n&&(0,o.tZ)("div",{css:y},(null==l?void 0:l.certifiedBy)&&(0,o.tZ)(g.Z,l),r&&(0,o.tZ)(f.Z,c),u)),(0,o.tZ)("div",{className:"right-button-panel"},h,(0,o.tZ)("div",{css:x},(0,o.tZ)(d.Gj,i()({trigger:["click"],overlay:D},E),(0,o.tZ)(m.Z,{css:b,buttonStyle:"tertiary","aria-label":(0,a.t)("Menu actions trigger"),tooltip:null==S?void 0:S.text,placement:null==S?void 0:S.placement},(0,o.tZ)(v.Z.MoreHoriz,{iconColor:C.colors.primary.dark2,iconSize:"l"}))))))}},93197:(e,t,n)=>{n.d(t,{tR:()=>C,iZ:()=>E,ex:()=>R,ZP:()=>$});var l=n(5872),i=n.n(l),r=n(94809),o=n(67294),s=n(41288),a=n(70338),d=n(55867),c=n(68492),u=n(51995),h=n(38703);const p=(e,t,n)=>{let l=!1;const i=t-e;return i>0&&i<=n&&(l=!0),l};class g{constructor(e,t,n){var l=this;this.tableRef=void 0,this.columnRef=void 0,this.setDerivedColumns=void 0,this.isDragging=void 0,this.resizable=void 0,this.reorderable=void 0,this.derivedColumns=void 0,this.RESIZE_INDICATOR_THRESHOLD=void 0,this.clearListeners=()=>{document.removeEventListener("mouseup",this.handleMouseup),this.initializeResizableColumns(!1,this.tableRef),this.initializeDragDropColumns(!1,this.tableRef)},this.setTableRef=e=>{this.tableRef=e},this.getColumnIndex=()=>{var e;let t=-1;const n=null==(e=this.columnRef)?void 0:e.parentNode;return n&&(t=Array.prototype.indexOf.call(n.children,this.columnRef)),t},this.handleColumnDragStart=e=>{var t;const n=null==e?void 0:e.currentTarget;n&&(this.columnRef=n),this.isDragging=!0;const l=this.getColumnIndex(),i={index:l,columnData:this.derivedColumns[l]};null==e||null==(t=e.dataTransfer)||t.setData(E,JSON.stringify(i))},this.handleDragDrop=e=>{var t;if(null==(t=e.dataTransfer)||null==t.getData?void 0:t.getData(E)){var n;e.preventDefault();const t=null==(n=e.currentTarget)?void 0:n.parentNode,l=Array.prototype.indexOf.call(t.children,e.currentTarget),i=this.getColumnIndex(),r=[...this.derivedColumns],o=r.slice(i,i+1);r.splice(i,1),r.splice(l,0,o[0]),this.derivedColumns=[...r],this.setDerivedColumns(r)}},this.allowDrop=e=>{e.preventDefault()},this.handleMouseDown=e=>{const t=null==e?void 0:e.currentTarget;t&&(this.columnRef=t,e&&p(e.offsetX,t.offsetWidth,this.RESIZE_INDICATOR_THRESHOLD)?(t.mouseDown=!0,t.oldX=e.x,t.oldWidth=t.offsetWidth,t.draggable=!1):this.reorderable&&(t.draggable=!0))},this.handleMouseMove=e=>{if(!0===this.resizable&&!this.isDragging){const t=e.currentTarget;e&&p(e.offsetX,t.offsetWidth,this.RESIZE_INDICATOR_THRESHOLD)?t.style.cursor="col-resize":t.style.cursor="default";const n=this.columnRef;if(null!=n&&n.mouseDown){let t=n.oldWidth;const l=e.x-n.oldX;n.oldWidth+(e.x-n.oldX)>0&&(t=n.oldWidth+l);const i=this.getColumnIndex();if(!Number.isNaN(i)){const e={...this.derivedColumns[i]};e.width=t,this.derivedColumns[i]=e,this.setDerivedColumns([...this.derivedColumns])}}}},this.handleMouseup=()=>{this.columnRef&&(this.columnRef.mouseDown=!1,this.columnRef.style.cursor="default",this.columnRef.draggable=!1),this.isDragging=!1},this.initializeResizableColumns=function(e,t){var n,i;void 0===e&&(e=!1),l.tableRef=t;const r=null==(n=l.tableRef)||null==(i=n.rows)?void 0:i[0];if(r){const{cells:t}=r,n=t.length;for(let i=0;i<n;i+=1){const n=t[i];!0===e?(l.resizable=!0,n.addEventListener("mousedown",l.handleMouseDown),n.addEventListener("mousemove",l.handleMouseMove,!0)):(l.resizable=!1,n.removeEventListener("mousedown",l.handleMouseDown),n.removeEventListener("mousemove",l.handleMouseMove,!0))}}},this.initializeDragDropColumns=function(e,t){var n,i;void 0===e&&(e=!1),l.tableRef=t;const r=null==(n=l.tableRef)||null==(i=n.rows)?void 0:i[0];if(r){const{cells:t}=r,n=t.length;for(let i=0;i<n;i+=1){const n=t[i];!0===e?(l.reorderable=!0,n.addEventListener("mousedown",l.handleMouseDown),n.addEventListener("dragover",l.allowDrop),n.addEventListener("dragstart",l.handleColumnDragStart),n.addEventListener("drop",l.handleDragDrop)):(l.reorderable=!1,n.draggable=!1,n.removeEventListener("mousedown",l.handleMouseDown),n.removeEventListener("dragover",l.allowDrop),n.removeEventListener("dragstart",l.handleColumnDragStart),n.removeEventListener("drop",l.handleDragDrop))}}},this.setDerivedColumns=n,this.tableRef=e,this.isDragging=!1,this.RESIZE_INDICATOR_THRESHOLD=8,this.resizable=!1,this.reorderable=!1,this.derivedColumns=[...t],document.addEventListener("mouseup",this.handleMouseup)}}var f=n(94184),v=n.n(f),m=n(99612),b=n(74061),w=n(11965);const y=(0,u.iK)("div")((e=>{let{theme:t,height:n}=e;return`\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  padding-left: ${2*t.gridUnit}px;\n  padding-right: ${t.gridUnit}px;\n  border-bottom: 1px solid ${t.colors.grayscale.light3};\n  transition: background 0.3s;\n  line-height: ${n}px;\n  box-sizing: border-box;\n`})),x=(0,u.iK)(s.Z)((e=>{let{theme:t}=e;return`\n    th.ant-table-cell {\n      font-weight: ${t.typography.weights.bold};\n      color: ${t.colors.grayscale.dark1};\n      user-select: none;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .ant-pagination-item-active {\n      border-color: ${t.colors.primary.base};\n    }\n  }\n`})),D=e=>{var t;const{columns:n,pagination:l,onChange:r,height:s,scroll:a,size:d}=e,[c,h]=(0,o.useState)(0),p=(0,o.useCallback)((e=>{h(e)}),[]),{ref:g}=(0,m.NB)({onResize:p}),f=(0,u.Fg)(),D=37*(null==f?void 0:f.gridUnit)||150,E=n.filter((e=>{let{width:t}=e;return!t})).length;let S=0;null==n||n.forEach((e=>{e.width&&(S+=e.width)}));let T=0;const L=Math.max(Math.floor((c-S)/E),50),Z=null!=(t=null==n||null==n.map?void 0:n.map((e=>{const t={...e};return e.width||(t.width=L),T+=t.width,t})))?t:[];if(T<c){const e=Z[Z.length-1];e.width=e.width+Math.floor(c-T)}const I=(0,o.useRef)(),[z]=(0,o.useState)((()=>{const e={};return Object.defineProperty(e,"scrollLeft",{get:()=>{var e,t;return I.current?null==(e=I.current)||null==(t=e.state)?void 0:t.scrollLeft:null},set:e=>{I.current&&I.current.scrollTo({scrollLeft:e})}}),e})),N=()=>{var e;null==(e=I.current)||e.resetAfterIndices({columnIndex:0,shouldForceUpdate:!0})};(0,o.useEffect)((()=>N),[c,n,d]);const $={...l,onChange:(e,t)=>{var n;null==(n=I.current)||null==n.scrollTo||n.scrollTo({scrollTop:0}),null==r||r({...l,current:e,pageSize:t},{},{},{action:C.PAGINATE,currentDataSource:[]})}};return(0,w.tZ)("div",{ref:g},(0,w.tZ)(x,i()({},e,{sticky:!1,className:"virtual-table",columns:Z,components:{body:(e,t)=>{let{ref:n,onScroll:l}=t;n.current=z;const i=d===R.MIDDLE?47:39;return(0,w.tZ)(b.cd,{ref:I,className:"virtual-grid",columnCount:Z.length,columnWidth:e=>{const{width:t=D}=Z[e];return t},height:s||a.y,rowCount:e.length,rowHeight:()=>i,width:c,onScroll:e=>{let{scrollLeft:t}=e;l({scrollLeft:t})}},(t=>{var n,l;let{columnIndex:r,rowIndex:o,style:s}=t;const a=null==e?void 0:e[o];let d=null==a?void 0:a[null==Z||null==(n=Z[r])?void 0:n.dataIndex];const c=null==(l=Z[r])?void 0:l.render;return"function"==typeof c&&(d=c(d,a,o)),(0,w.tZ)(y,{className:v()("virtual-table-cell",{"virtual-table-cell-last":r===Z.length-1}),style:s,title:"string"==typeof d?d:void 0,theme:f,height:i},d)}))}},pagination:$})))},E="superset/table-column";var S,C,R;!function(e){e.DISABLED="disabled",e.SINGLE="single",e.MULTI="multi"}(S||(S={})),function(e){e.PAGINATE="paginate",e.SORT="sort",e.FILTER="filter"}(C||(C={})),function(e){e.SMALL="small",e.MIDDLE="middle"}(R||(R={}));const T=[],L=(0,r.Z)(s.Z,{target:"ei48tom0"})((e=>{let{theme:t,height:n}=e;return`\n    .ant-table-body {\n      overflow: auto;\n      height: ${n?`${n}px`:void 0};\n    }\n\n    th.ant-table-cell {\n      font-weight: ${t.typography.weights.bold};\n      color: ${t.colors.grayscale.dark1};\n      user-select: none;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .ant-table-tbody > tr > td {\n      user-select: none;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      border-bottom: 1px solid ${t.colors.grayscale.light3};\n    }\n\n    .ant-pagination-item-active {\n      border-color: ${t.colors.primary.base};\n    }\n  }\n`}),""),Z=(0,r.Z)(D,{target:"ei48tom1"})((e=>{let{theme:t}=e;return`\n  .virtual-table .ant-table-container:before,\n  .virtual-table .ant-table-container:after {\n    display: none;\n  }\n  .virtual-table-cell {\n    box-sizing: border-box;\n    padding: ${4*t.gridUnit}px;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n`}),""),I={filterTitle:(0,d.t)("Filter menu"),filterConfirm:(0,d.t)("OK"),filterReset:(0,d.t)("Reset"),filterEmptyText:(0,d.t)("No filters"),filterCheckall:(0,d.t)("Select all items"),filterSearchPlaceholder:(0,d.t)("Search in filters"),emptyText:(0,d.t)("No data"),selectAll:(0,d.t)("Select current page"),selectInvert:(0,d.t)("Invert current page"),selectNone:(0,d.t)("Clear all data"),selectionAll:(0,d.t)("Select all data"),sortTitle:(0,d.t)("Sort"),expand:(0,d.t)("Expand row"),collapse:(0,d.t)("Collapse row"),triggerDesc:(0,d.t)("Click to sort descending"),triggerAsc:(0,d.t)("Click to sort ascending"),cancelSort:(0,d.t)("Click to cancel sorting")},z={},N=()=>{};z[S.MULTI]="checkbox",z[S.SINGLE]="radio",z[S.DISABLED]=null;const $=function(e){const{data:t,columns:n,selectedRows:l=T,handleRowSelection:r,size:s=R.SMALL,selectionType:d=S.DISABLED,sticky:p=!0,loading:f=!1,resizable:v=!1,reorderable:m=!1,usePagination:b=!0,defaultPageSize:y=15,pageSizeOptions:x=["5","15","25","50","100"],hideData:D=!1,emptyComponent:E,locale:C,height:$,virtualize:M=!1,onChange:k=N,recordCount:A}=e,P=(0,o.useRef)(null),[O,U]=(0,o.useState)(n),[B,H]=(0,o.useState)(y),[W,F]=(0,o.useState)({...I}),[_,X]=(0,o.useState)(l),G=(0,o.useRef)(null),K=z[d],j={type:K,selectedRowKeys:_,onChange:e=>{X(e),null==r||r(e)}};(0,o.useEffect)((()=>{!0===m&&c.Z.warn('EXPERIMENTAL FEATURE ENABLED: The "reorderable" prop of Table is experimental and NOT recommended for use in production deployments.'),!0===v&&c.Z.warn('EXPERIMENTAL FEATURE ENABLED: The "resizable" prop of Table is experimental and NOT recommended for use in production deployments.')}),[m,v]),(0,o.useEffect)((()=>{let e;e=C?{...I,...C}:{...I},F(e)}),[C]),(0,o.useEffect)((()=>U(n)),[n]),(0,o.useEffect)((()=>{var e,t;G.current&&(null==(t=G.current)||t.clearListeners());const n=null==(e=P.current)?void 0:e.getElementsByTagName("table")[0];var l,i;n&&(G.current=new g(n,O,U),m&&(null==G||null==(l=G.current)||l.initializeDragDropColumns(m,n)),v&&(null==G||null==(i=G.current)||i.initializeResizableColumns(v,n)));return()=>{var e;null==G||null==(e=G.current)||null==e.clearListeners||e.clearListeners()}}),[P,m,v,M,G]);const J=(0,u.Fg)(),q=!!b&&{hideOnSinglePage:!0,pageSize:B,pageSizeOptions:x,onShowSizeChange:(e,t)=>H(t)};q&&A&&(q.total=A);let Q=$;Q&&(Q-=68,b&&A&&A>B&&(Q-=40));const V={loading:{spinning:null!=f&&f,indicator:(0,w.tZ)(h.Z,null)},hasData:!D&&t,columns:O,dataSource:D?[void 0]:t,size:s,pagination:q,locale:W,showSorterTooltip:!1,onChange:k,theme:J,height:Q};return(0,w.tZ)(a.ZP,{renderEmpty:()=>null!=E?E:(0,w.tZ)("div",null,W.emptyText)},(0,w.tZ)("div",{ref:P},!M&&(0,w.tZ)(L,i()({},V,{rowSelection:K?j:void 0,sticky:p})),M&&(0,w.tZ)(Z,i()({},V,{scroll:{y:300,x:"100vw"}}))))}}}]);
//# sourceMappingURL=f701a9d9f1e129014644.chunk.js.map
