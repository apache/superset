import React, { useState } from 'react';
import { css } from '@apache-superset/core/ui';
import { t } from '@apache-superset/core';
import { Button, Tag } from '@superset-ui/core/components';
import { DatePicker, InputNumber, Radio } from 'antd';
import dayjs from 'dayjs';
import { RawAntdSelect as Select } from '@superset-ui/core/components/Select';
import { Dropdown } from '@superset-ui/chart-controls';
import { FilterOutlined, MoreOutlined, SortAscendingOutlined, SortDescendingOutlined, MinusCircleOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, ColumnWidthOutlined, DeleteOutlined, CheckSquareOutlined, CloseOutlined, PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { FaSort } from '@react-icons/all-files/fa/FaSort';
import { FaSortDown as FaSortDesc } from '@react-icons/all-files/fa/FaSortDown';
import { FaSortUp as FaSortAsc } from '@react-icons/all-files/fa/FaSortUp';

function SortIcon({ column }: any) {
  const { isSorted, isSortedDesc } = column || {};
  let sortIcon: any = <FaSort />;
  if (isSorted) sortIcon = isSortedDesc ? <FaSortDesc /> : <FaSortAsc />;
  return sortIcon;
}

const HeaderCell: React.FC<any> = (props: any) => {
  const {
    headerProps,
    label,
    colKey,
    column,
    columnHeaderClassName,
    sharedStyle,
    columnWidth,
    theme,
    // features
    enablePinColumns,
    enableColumnVisibility,
    enableColumnResize,
    enableAdvancedColumnFilters,
    serverPagination,
    // pin + width state
    isPinnedLeft,
    isPinnedRight,
    pinnedLeftOffsets,
    pinnedRightOffsets,
    pinnedLeftKeys,
    pinnedRightKeys,
    savePinned,
    tableColWidthsByKey,
    setTableColWidthsByKey,
    appliedVisibleColumnsMeta,
    visibleColumnsMeta,
    visibleColumnKeys,
    saveVisibleColumns,
    // data/context
    data,
    sliceId,
    chartId,
    // menus + filters
    openHeaderMenuKey,
    setOpenHeaderMenuKey,
    advancedFilters,
    setAdvancedFilters,
    openFilterKey,
    setOpenFilterKey,
    quickFilters,
    setQuickFilters,
    ACTION_KEYS,
    applyAdvancedFilters,
    // typing helpers
    isNumeric,
    isTemporal,
    isBoolean,
  } = props;

  const { column: col, onClick, style, onDragStart, onDrop, setStickyState, containerWidth, enableColumnResize: enableResize } = headerProps || {};
  const [filterDraft, setFilterDraft] = useState<Record<string, { op: string; v1: any; v2: any; connector?: 'AND' | 'OR' }>>({});
  const [inputMsg, setInputMsg] = useState<string | null>(null);
  const [openSubmenuKeys, setOpenSubmenuKeys] = useState<string[]>([]);
  const interactiveMenuEnabled = Boolean(enablePinColumns || enableColumnVisibility || enableColumnResize || enableAdvancedColumnFilters);

  const attachResizeHandlers = (e: React.MouseEvent) => {
    if (!enableResize) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const th = (e.target as HTMLElement).closest('th') as HTMLTableCellElement | null;
      if (!th || !th.parentElement) return;
      const headerRow = th.parentElement;
      const cells = Array.from(headerRow.children).filter((n): n is HTMLTableCellElement => n instanceof HTMLTableCellElement);
      const idx = cells.indexOf(th);
      if (idx < 0) return;
      const startX = (e as any).clientX as number;
      const widths = cells.map((el: HTMLTableCellElement) => el.getBoundingClientRect().width);
      const startW = widths[idx] || 0;
      let lastW = startW;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const newW = Math.max(40, Math.round(startW + dx));
        if (newW === lastW) return;
        lastW = newW;
        const next = widths.slice();
        next[idx] = newW;
        const total = next.reduce((a, b) => a + b, 0);
        const cw = typeof containerWidth === 'number' ? containerWidth : 0;
        const hasH = total > cw && cw > 0;
        try { setStickyState?.({ columnWidths: next, hasHorizontalScroll: hasH }); } catch {}
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        try {
          const finalW = Math.max(40, lastW || startW);
          setTableColWidthsByKey((prev: any) => {
            const updated = { ...(prev || {}), [String(colKey)]: finalW } as Record<string, number>;
            try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
            return updated;
          });
        } catch {}
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    } catch {}
  };

  // Render advanced filter panel content (used inside Dropdown overlay)
  const renderFilterPanel = () => {
    const temporalOps: { value: any; label: string }[] = [
      { value: 'equals', label: t('Equals') as any },
      { value: 'not_equals', label: t('Not equals') as any },
      { value: 'gt', label: '>' },
      { value: 'gte', label: '>=' },
      { value: 'lt', label: '<' },
      { value: 'lte', label: '<=' },
      { value: 'between', label: t('Between') as any },
      { value: 'is_null', label: t('Is null') as any },
      { value: 'is_not_null', label: t('Is not null') as any },
    ];
    const numericOps: { value: any; label: string }[] = [
      { value: 'equals', label: t('Equals') as any },
      { value: 'not_equals', label: t('Not equals') as any },
      { value: 'gt', label: '>' },
      { value: 'gte', label: '>=' },
      { value: 'lt', label: '<' },
      { value: 'lte', label: '<=' },
      { value: 'between', label: t('Between') as any },
      { value: 'in', label: t('In list') as any },
      { value: 'not_in', label: t('Not in list') as any },
      { value: 'is_null', label: t('Is null') as any },
      { value: 'is_not_null', label: t('Is not null') as any },
    ];
    const stringOps: { value: any; label: string }[] = [
      { value: 'contains', label: t('Contains') as any },
      { value: 'not_contains', label: t('Does not contain') as any },
      { value: 'equals', label: t('Equals') as any },
      { value: 'not_equals', label: t('Not equals') as any },
      { value: 'starts_with', label: t('Starts with') as any },
      { value: 'ends_with', label: t('Ends with') as any },
      { value: 'in', label: t('In list') as any },
      { value: 'not_in', label: t('Not in list') as any },
      { value: 'is_empty', label: t('Is empty') as any },
      { value: 'is_not_empty', label: t('Is not empty') as any },
      { value: 'is_null', label: t('Is null') as any },
      { value: 'is_not_null', label: t('Is not null') as any },
    ];
    const booleanOps: { value: any; label: string }[] = [
      { value: 'equals', label: t('Equals') as any },
      { value: 'not_equals', label: t('Not equals') as any },
      { value: 'is_null', label: t('Is null') as any },
      { value: 'is_not_null', label: t('Is not null') as any },
    ];
    const ops = isBoolean ? booleanOps : (isTemporal ? temporalOps : (isNumeric ? numericOps : stringOps));
    const DEFAULT_OP = (isTemporal || isNumeric) ? 'between' : (String(ops?.[0]?.value || 'contains'));
    const draft = filterDraft[colKey] || { op: DEFAULT_OP, v1: '', v2: '' };
    const selectedOp = draft.op;
    let v1: any = draft.v1; let v2: any = draft.v2;
    // Derived validation flags for inline invalid styling
    const op = String(selectedOp);
    const n1 = Number(v1); const n2 = Number(v2);
    const invalidNumSingle = isNumeric && ['equals','not_equals','gt','gte','lt','lte'].includes(op) && Number.isNaN(n1);
    const invalidNumBetween = isNumeric && op === 'between' && (Number.isNaN(n1) || Number.isNaN(n2) || (Number.isFinite(n1) && Number.isFinite(n2) && n1 > n2));
    const s1 = isTemporal ? normalizeDateInput(v1) : '';
    const s2 = isTemporal ? normalizeDateInput(v2) : '';
    const FMT = 'YYYY-MM-DD HH:mm:ss';
    const toDayjs = (s: string | undefined) => {
      try {
        if (!s) return undefined;
        const d = (dayjs as any)?.(s, FMT);
        // Some environments may not have dayjs resolved; guard isValid method
        if (d && typeof d.isValid === 'function' && d.isValid()) return d;
      } catch {}
      return undefined;
    };
    const t1 = s1 ? new Date(s1).getTime() : NaN;
    const t2 = s2 ? new Date(s2).getTime() : NaN;
    const invalidTempSingle = isTemporal && ['equals','not_equals','gt','gte','lt','lte'].includes(op) && !s1;
    const invalidTempBetween = isTemporal && op === 'between' && (!s1 || !s2 || Number.isNaN(t1) || Number.isNaN(t2) || t1 > t2);

    const normalizeDateInput = (s: any) => {
      try {
        const str = String(s || '').trim();
        if (!str) return '';
        const m = str.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
        if (!m) return '';
        const date = m[1];
        const hh = m[2] ?? '00';
        const mm = m[3] ?? '00';
        const ss = m[4] ?? '00';
        return `${date} ${hh}:${mm}:${ss}`;
      } catch { return ''; }
    };
    const isValid = () => {
      const op = String(selectedOp);
      if (['is_null','is_not_null'].includes(op)) return true;
      if (isBoolean) {
        if (['equals','not_equals'].includes(op)) return v1 === 'true' || v1 === 'false' || typeof v1 === 'boolean';
        return true;
      }
      if (isTemporal) {
        if (op === 'between') {
          const s1 = normalizeDateInput(v1); const s2 = normalizeDateInput(v2);
          if (!s1 || !s2) return false;
          const t1 = new Date(s1).getTime();
          const t2 = new Date(s2).getTime();
          if (Number.isNaN(t1) || Number.isNaN(t2)) return false;
          return t1 <= t2;
        }
        if (['equals','not_equals','gt','gte','lt','lte'].includes(op)) return Boolean(normalizeDateInput(v1));
        return String(v1 || '').trim() !== '';
      }
      if (isNumeric) {
        if (op === 'between') {
          const n1 = Number(v1); const n2 = Number(v2);
          if (Number.isNaN(n1) || Number.isNaN(n2)) return false;
          return n1 <= n2;
        }
        if (['equals','not_equals','gt','gte','lt','lte'].includes(op)) return !Number.isNaN(Number(v1));
        if (['in','not_in'].includes(op)) {
          const tokens = String(v1 || '').split(',').map(s => s.trim()).filter(Boolean);
          return tokens.length > 0 && tokens.every(tk => !Number.isNaN(Number(tk)));
        }
        return true;
      }
      if (['is_empty','is_not_empty'].includes(op)) return true;
      return String(v1 || '').trim() !== '';
    };

    return (
      <div
        className="ant-dropdown-menu ant-dropdown-menu-root ant-dropdown-menu-vertical ant-dropdown-menu-light dt-filter-panel"
        onKeyDown={(e: any) => {
          if (e.key === 'Escape') { e.stopPropagation?.(); setOpenFilterKey(null); return; }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault?.();
            const prev = advancedFilters || {};
            const prevCfg = prev[colKey] || { logic: 'AND', conditions: [] };
            let nextCfg = prevCfg;
            if (isValid()) {
              const cur = filterDraft[colKey] || { op: selectedOp, v1, v2 };
              let nv1 = cur.v1, nv2 = cur.v2;
              if (isTemporal) { nv1 = normalizeDateInput(v1); nv2 = normalizeDateInput(v2); }
              if (isBoolean) { if (typeof nv1 === 'string') nv1 = nv1 === 'true'; if (typeof nv2 === 'string') nv2 = nv2 === 'true'; }
              nextCfg = { ...prevCfg, conditions: [...(prevCfg.conditions || []), { op: cur.op, value: nv1, value2: nv2, connector: (cur as any).connector || undefined }] };
            }
            const nextAll = { ...prev, [colKey]: nextCfg } as any;
            setAdvancedFilters(nextAll);
            applyAdvancedFilters?.(nextAll);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault?.();
            if (!isValid()) return;
            const prev = advancedFilters || {};
            const prevCfg = prev[colKey] || { logic: 'AND', conditions: [] };
            const cur = filterDraft[colKey] || { op: selectedOp, v1, v2 };
            let nv1 = cur.v1, nv2 = cur.v2;
            if (isTemporal) { nv1 = normalizeDateInput(v1); nv2 = normalizeDateInput(v2); }
            if (isBoolean) { if (typeof nv1 === 'string') nv1 = nv1 === 'true'; if (typeof nv2 === 'string') nv2 = nv2 === 'true'; }
            const nextCfg = { ...prevCfg, conditions: [...(prevCfg.conditions || []), { op: cur.op, value: nv1, value2: nv2, connector: (cur as any).connector || undefined }] };
            const nextAll = { ...prev, [colKey]: nextCfg } as any;
            setAdvancedFilters(nextAll);
          }
        }}
      >
        <div style={{ fontSize: 12, color: (theme as any).colorTextSecondary, marginBottom: 12, fontWeight: 500 }}>
          {t('Filter Conditions') as any}
        </div>
        <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal', paddingTop: 0, paddingBottom: 8 }}>
          <Select aria-label={t('Operator') as any} size="small" value={selectedOp} onChange={(val: any) => {
            const op = String(val);
            setFilterDraft(prev => ({ ...prev, [colKey]: { op, v1: '', v2: '' } }));
          }} style={{ width: '100%' }}>
            {ops.map(op => (
              <Select.Option key={String(op.value)} value={op.value}>{op.label}</Select.Option>
            ))}
          </Select>
        </div>
        {String(selectedOp) === 'between' ? (
          <>
            <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal' }}>
            {isTemporal ? (
              <DatePicker.RangePicker
                showTime
                status={invalidTempBetween ? 'error' as any : undefined}
                value={(s1 && s2) ? ([toDayjs(s1), toDayjs(s2)] as any) : undefined}
                onChange={(vals: any) => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: (vals?.[0] && (vals[0] as any).format?.(FMT)) || '', v2: (vals?.[1] && (vals[1] as any).format?.(FMT)) || '' } }))}
              />
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <InputNumber aria-label={t('Minimum') as any} placeholder={t('Min') as any} status={invalidNumBetween && (Number.isNaN(n1) || (Number.isFinite(n1) && Number.isFinite(n2) && n1 > n2)) ? 'error' as any : undefined} value={v1 as any} onChange={(val: any) => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: val } }))} style={{ width: '100%' }} />
                  <InputNumber aria-label={t('Maximum') as any} placeholder={t('Max') as any} status={invalidNumBetween && (Number.isNaN(n2) || (Number.isFinite(n1) && Number.isFinite(n2) && n1 > n2)) ? 'error' as any : undefined} value={v2 as any} onChange={(val: any) => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v2: val } }))} style={{ width: '100%' }} />
                </div>
                {(() => {
                  const show = String(selectedOp) === 'between' && !(Number.isNaN(n1) || Number.isNaN(n2)) && n1 > n2;
                  return show ? (
                    <div style={{ color: theme.colorError, fontSize: 11, marginTop: 4 }}>{t('Min must be ≤ Max') as any}</div>
                  ) : null;
                })()}
              </>
            )}
            </div>
            {/* no extra input row needed; temporal uses RangePicker, numeric uses two inputs above */}
          </>
        ) : (['gt','gte','lt','lte','equals','not_equals'].includes(String(selectedOp))) ? (
          <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal' }}>
            {isTemporal ? (
              <DatePicker aria-label={t('Value') as any} showTime status={invalidTempSingle ? 'error' as any : undefined} value={toDayjs(s1) as any} onChange={(val: any) => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: (val && (val as any).format?.(FMT)) || '' } }))} />
            ) : isNumeric ? (
              <InputNumber aria-label={t('Value') as any} placeholder={t('Value') as any} status={invalidNumSingle ? 'error' as any : undefined} value={v1 as any} onChange={(val: any) => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: val } }))} style={{ width: '100%' }} />
            ) : isBoolean ? (
              <select value={String(v1)} onChange={e => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: e.target.value } }))}>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input aria-label={t('Value') as any} placeholder={t('Value') as any} value={v1} onChange={e => {
                const s = String(e.target.value || '').slice(0, 200);
                setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: s } }));
              }} />
            )}
          </div>
        ) : (!['is_null','is_not_null','is_empty','is_not_empty'].includes(String(selectedOp))) ? (
          <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal' }}>
            <Select
              mode="tags"
              value={String(v1 || '').split(',').filter(Boolean)}
              onChange={(vals: any[]) => {
                try {
                  const arr = Array.isArray(vals) ? vals : [];
                  let safe = arr.map(v => String(v ?? ''));
                  // enforce numeric-only tokens for numeric columns
                  if (isNumeric) {
                    const before = safe.length;
                    safe = safe.filter(s => s !== '' && Number.isFinite(Number(s)));
                    if (safe.length < before) {
                      setInputMsg(String(t('Some non-numeric values were ignored')) as any);
                      setTimeout(() => setInputMsg(null), 2500);
                    }
                  }
                  // cap length per token and number of tokens
                  safe = safe.map(s => s.slice(0, 200)).slice(0, 100);
                  setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: safe.join(',') } }));
                } catch {
                  setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), op: selectedOp, v1: '' } }));
                }
              }}
              style={{ width: '100%' }}
            />
            {inputMsg ? (<div style={{ color: theme.colorTextTertiary, fontSize: 11, marginTop: 4 }}>{inputMsg}</div>) : null}
          </div>
        ) : null}

        {/* Next-condition connector (AND/OR) as radio buttons for compact UX */}
        <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal', paddingTop: 8, paddingBottom: 8 }}>
          <div style={{ fontSize: 11, color: (theme as any).colorTextTertiary, marginBottom: 6 }}>
            {t('Combine with next condition:') as any}
          </div>
          <Radio.Group
            className="dt-next-connector"
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={(filterDraft[colKey]?.connector as any) || (advancedFilters[colKey]?.logic || 'AND')}
            onChange={e => setFilterDraft(prev => ({ ...prev, [colKey]: { ...(prev[colKey] || { op: selectedOp, v1: '', v2: '' }), connector: (e.target.value as any) } }))}
          >
            <Radio.Button value="AND">AND</Radio.Button>
            <Radio.Button value="OR">OR</Radio.Button>
          </Radio.Group>
        </div>
        <div className="ant-dropdown-menu-item" style={{ textAlign: 'center', fontSize: 11, color: (theme as any).colorTextTertiary, marginTop: 4, marginBottom: 8, padding: '6px 8px', background: (theme as any).colorBgLayout, borderRadius: (theme as any).borderRadiusSM }}>
          {t('⌨ Enter: Add  •  Cmd/Ctrl+Enter: Search') as any}
        </div>
        <div className="ant-dropdown-menu-item dt-filter-actions">
          <div className="left">
            <Tag
              style={{
                backgroundColor: !isValid() ? theme.colorBgContainerDisabled : theme.colorPrimary,
                color: !isValid() ? theme.colorTextDisabled : theme.colorBgContainer,
                border: 'none',
                cursor: !isValid() ? 'not-allowed' : 'pointer',
                opacity: !isValid() ? 0.6 : 1,
              } as React.CSSProperties}
              onClick={() => {
                if (!isValid()) return;
                // Add only; do not hit backend
                const prev = advancedFilters || {};
                const prevCfg = prev[colKey] || { logic: 'AND', conditions: [] };
                const cur = filterDraft[colKey] || { op: selectedOp, v1, v2 };
                let nv1 = cur.v1, nv2 = cur.v2;
                if (isTemporal) { nv1 = normalizeDateInput(v1); nv2 = normalizeDateInput(v2); }
                if (isBoolean) { if (typeof nv1 === 'string') nv1 = nv1 === 'true'; if (typeof nv2 === 'string') nv2 = nv2 === 'true'; }
                const nextCfg = { ...prevCfg, conditions: [...(prevCfg.conditions || []), { op: cur.op, value: nv1, value2: nv2, connector: (cur as any).connector || undefined }] };
                const nextAll = { ...prev, [colKey]: nextCfg } as any;
                setAdvancedFilters(nextAll);
                // keep draft inputs for further adds
              }}
              title={t('Add condition') as any}
            >
              <PlusOutlined /> {t('Add')}
            </Tag>
            <Tag
              style={{
                backgroundColor: ((isTemporal && String(selectedOp) === 'between' && invalidTempBetween) || (!(((advancedFilters[colKey]?.conditions?.length || 0) > 0) || isValid())))
                  ? theme.colorBgContainerDisabled
                  : theme.colorPrimary,
                color: ((isTemporal && String(selectedOp) === 'between' && invalidTempBetween) || (!(((advancedFilters[colKey]?.conditions?.length || 0) > 0) || isValid())))
                  ? theme.colorTextDisabled
                  : theme.colorBgContainer,
                border: 'none',
                cursor: ((isTemporal && String(selectedOp) === 'between' && invalidTempBetween) || (!(((advancedFilters[colKey]?.conditions?.length || 0) > 0) || isValid())))
                  ? 'not-allowed'
                  : 'pointer',
                opacity: ((isTemporal && String(selectedOp) === 'between' && invalidTempBetween) || (!(((advancedFilters[colKey]?.conditions?.length || 0) > 0) || isValid())))
                  ? 0.6
                  : 1,
              } as React.CSSProperties}
              onClick={() => {
                if ((isTemporal && String(selectedOp) === 'between' && invalidTempBetween) || (!(((advancedFilters[colKey]?.conditions?.length || 0) > 0) || isValid()))) return;
                // Apply current staged conditions; also add current draft if valid
                const prev = advancedFilters || {};
                const prevCfg = prev[colKey] || { logic: 'AND', conditions: [] };
                let nextCfg = prevCfg;
                if (isValid()) {
                  const cur = filterDraft[colKey] || { op: selectedOp, v1, v2 };
                  let nv1 = cur.v1, nv2 = cur.v2;
                  if (isTemporal) { nv1 = normalizeDateInput(v1); nv2 = normalizeDateInput(v2); }
                  if (isBoolean) { if (typeof nv1 === 'string') nv1 = nv1 === 'true'; if (typeof nv2 === 'string') nv2 = nv2 === 'true'; }
                  nextCfg = { ...prevCfg, conditions: [...(prevCfg.conditions || []), { op: cur.op, value: nv1, value2: nv2, connector: (cur as any).connector || undefined }] };
                }
                const nextAll = { ...prev, [colKey]: nextCfg } as any;
                setAdvancedFilters(nextAll);
                applyAdvancedFilters?.(nextAll);
              }}
              title={t('Apply filters') as any}
            >
              <SearchOutlined /> {t('Search')}
            </Tag>
          </div>
          <div className="right">
            <Tag
              style={{
                backgroundColor: !((advancedFilters[colKey]?.conditions?.length || 0) > 0)
                  ? theme.colorBgContainerDisabled
                  : theme.colorError,
                color: !((advancedFilters[colKey]?.conditions?.length || 0) > 0)
                  ? theme.colorTextDisabled
                  : theme.colorBgContainer,
                border: 'none',
                cursor: !((advancedFilters[colKey]?.conditions?.length || 0) > 0)
                  ? 'not-allowed'
                  : 'pointer',
                opacity: !((advancedFilters[colKey]?.conditions?.length || 0) > 0)
                  ? 0.6
                  : 1,
              } as React.CSSProperties}
              onClick={() => {
                if (!((advancedFilters[colKey]?.conditions?.length || 0) > 0)) return;
                const prev = advancedFilters || {};
                const nextAll = { ...prev, [colKey]: { logic: (prev[colKey]?.logic || 'AND'), conditions: [] } } as any;
                setAdvancedFilters(nextAll);
                // do not auto-apply; user must click Search
              }}
              title={t('Reset conditions') as any}
            >
              <DeleteOutlined /> {t('Reset')}
            </Tag>
          </div>
        </div>
        {(advancedFilters[colKey]?.conditions?.length ? (
          <div className="ant-dropdown-menu-item-group">
            <div className="ant-dropdown-menu-item" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="dt-condition-separator" role="separator" />
            </div>
            <div className="ant-dropdown-menu-item-group-title" style={{ fontWeight: 600, fontSize: 12, color: (theme as any).colorText, marginBottom: 8 }}>{t('Active Conditions')}</div>
            <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal' }}>
              <div className="dt-condition-list">
                {(advancedFilters[colKey]?.conditions || []).map((c: any, idx: number) => (
                  <div key={`c-${idx}`} className="dt-condition-row">
                    <div className="left">
                      {idx > 0 ? (
                        <Radio.Group
                          className="dt-chip-connector"
                          size="small"
                          optionType="button"
                          buttonStyle="solid"
                          value={String((c && c.connector) || 'AND')}
                          onChange={e => {
                            const prev = advancedFilters || {};
                            const cfg = prev[colKey] || { logic: 'AND', conditions: [] };
                            const nextConds = (cfg.conditions || []).slice();
                            nextConds[idx] = { ...(nextConds[idx] || {}), connector: (e.target.value as any) };
                            const nextCfg = { ...cfg, conditions: nextConds };
                            const nextAll = { ...prev, [colKey]: nextCfg } as any;
                            setAdvancedFilters(nextAll);
                          }}
                        >
                          <Radio.Button value="AND">AND</Radio.Button>
                          <Radio.Button value="OR">OR</Radio.Button>
                        </Radio.Group>
                      ) : null}
                      <span className="dt-chip-op">{String(c.op)}</span>
                      {c.value !== undefined && <span className="dt-chip-val">{` ${String(c.value)}`}</span>}
                      {c.value2 !== undefined && <span className="dt-chip-val">{` - ${String(c.value2)}`}</span>}
                    </div>
                    <span
                      className="dt-chip-close"
                      role="button"
                      tabIndex={0}
                      title={t('Remove condition') as any}
                      onClick={() => {
                        const prev = advancedFilters || {};
                        const cfg = prev[colKey];
                        const nextConds = (cfg?.conditions || []).slice();
                        nextConds.splice(idx, 1);
                        const nextCfg = { ...(cfg || { logic: 'AND', conditions: [] }), conditions: nextConds };
                        const nextAll = { ...prev, [colKey]: nextCfg } as any;
                        setAdvancedFilters(nextAll);
                      }}
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault?.();
                          const prev = advancedFilters || {};
                          const cfg = prev[colKey];
                          const nextConds = (cfg?.conditions || []).slice();
                          nextConds.splice(idx, 1);
                          const nextCfg = { ...(cfg || { logic: 'AND', conditions: [] }), conditions: nextConds };
                          const nextAll = { ...prev, [colKey]: nextCfg } as any;
                          setAdvancedFilters(nextAll);
                        }
                      }}
                    >
                      <CloseOutlined />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="ant-dropdown-menu-item" style={{ paddingTop: 0, paddingBottom: 0 }}>
              <div className="dt-condition-separator" role="separator" />
            </div>
            <div className="ant-dropdown-menu-item" style={{ whiteSpace: 'normal', fontSize: 12, color: theme.colorTextTertiary, textAlign: 'center', padding: '16px 12px', background: (theme as any).colorBgLayout, borderRadius: (theme as any).borderRadiusSM }}>
              {t('No active conditions. Add conditions above to filter results.') as any}
            </div>
          </>
        ))}
      </div>
    );
  };

  return (
    <th
      key={col?.id}
      id={`header-${String(colKey)}`}
      title={t('Shift + Click to sort by multiple columns') as any}
      className={[columnHeaderClassName, col?.isSorted ? 'is-sorted' : '',
        (enablePinColumns && isPinnedLeft(colKey) ? 'pinned-left' : ''),
        (enablePinColumns && isPinnedRight(colKey) ? 'pinned-right' : ''),
      ].filter(Boolean).join(' ')}
      style={{
        ...sharedStyle,
        ...style,
        position:
          (enablePinColumns && (isPinnedLeft(colKey) || isPinnedRight(colKey)))
            ? ('sticky' as const)
            : (enableResize || enableAdvancedColumnFilters)
            ? ('relative' as const)
            : (sharedStyle as any)?.position,
        ...(enablePinColumns && isPinnedLeft(colKey) ? { left: pinnedLeftOffsets.get(colKey) || 0, zIndex: 3, background: theme.colorBgBase } : {}),
        ...(enablePinColumns && isPinnedRight(colKey) ? { right: pinnedRightOffsets.get(colKey) || 0, zIndex: 3, background: theme.colorBgBase } : {}),
        ...(columnWidth !== undefined && columnWidth !== null ? ({ width: columnWidth as any} as React.CSSProperties) : {}),
      }}
      onKeyDown={(e: any) => {
        if (Object.values(ACTION_KEYS || {}).includes(e.key)) {
          col?.toggleSortBy?.();
        }
      }}
      role="columnheader button"
      aria-sort={col?.isSorted ? (col?.isSortedDesc ? 'descending' : 'ascending') : undefined}
      onClick={interactiveMenuEnabled ? undefined : onClick}
      data-column-name={col?.id}
      {...({
        draggable: 'true',
        onDragStart,
        onDragOver: (e: any) => e.preventDefault(),
        onDragEnter: (e: any) => e.preventDefault(),
        onDrop,
      } as any)}
      tabIndex={0}
    >
      {columnWidth ? (
        <div style={{ width: columnWidth, height: 0.01 }} />
      ) : null}
      {enableResize && (
        <span
          className="dt-col-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('Resize column') as any}
          title={t('Drag to resize column') as any}
          onMouseDown={attachResizeHandlers}
        />
      )}
      {interactiveMenuEnabled ? (
        <div data-column-name={col?.id} css={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span className="dt-col-label" data-column-name={col?.id}>{label}</span>
          <div css={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
          {enableAdvancedColumnFilters && (
            <Dropdown
              trigger={["click"]}
              open={openFilterKey === colKey}
              onOpenChange={(v: boolean) => setOpenFilterKey(v ? colKey : null)}
              {...({
                overlayStyle: { boxShadow: 'none', filter: 'none' },
                dropdownRender: () => (
                  <div
                    className="ant-dropdown-menu ant-dropdown-menu-root ant-dropdown-menu-vertical ant-dropdown-menu-light dt-filter-panel"
                    style={{ boxShadow: 'none', filter: 'none' }}
                    onClick={(e: any) => e.stopPropagation?.()}
                  >
                    {renderFilterPanel()}
                  </div>
                ),
                getPopupContainer: () => document.body,
              } as any)}
            >
              <span
                className={['dt-filter-icon', (advancedFilters[colKey]?.conditions?.length ? 'active' : '')].join(' ')}
                role="button"
                aria-label={t('Filter column') as any}
                onClick={(e: any) => { e.stopPropagation?.(); }}
              >
                <FilterOutlined />
                {((advancedFilters[colKey]?.conditions?.length || 0) > 0) ? (
                  <span className="dt-filter-count">{advancedFilters[colKey]?.conditions?.length}</span>
                ) : null}
              </span>
            </Dropdown>
          )}
          <Dropdown
            destroyPopupOnHide={false}
            menu={{
              selectable: false,
              openKeys: openSubmenuKeys,
              onOpenChange: (keys: string[]) => {
                // Always keep choose-columns open when it's in the keys array
                // This prevents Ant Design from automatically closing it on item clicks
                setOpenSubmenuKeys(keys);
              },
              items: (() => {
                const items: any[] = [];
                items.push({ key: 'sort-asc', label: (<span><SortAscendingOutlined style={{ marginRight: 10 }} />{t('Sort Ascending')}</span>) });
                items.push({ key: 'sort-desc', label: (<span><SortDescendingOutlined style={{ marginRight: 10 }} />{t('Sort Descending')}</span>) });
                items.push({ key: '__divider1', type: 'divider' as const });
                if (enablePinColumns) {
                  const isLeft = isPinnedLeft(colKey);
                  const isRight = isPinnedRight(colKey);
                  items.push({
                    key: 'pin-sub',
                    label: t('Pin Column') as any,
                    children: [
                      { key: 'pin-none', label: (<span><MinusCircleOutlined style={{ marginRight: 10 }} />{!isLeft && !isRight ? '✓ ' : ''}{t('No Pin')}</span>) },
                      { key: 'pin-left', label: (<span><VerticalAlignTopOutlined style={{ marginRight: 10 }} />{isLeft ? '✓ ' : ''}{t('Pin Left')}</span>) },
                      { key: 'pin-right', label: (<span><VerticalAlignBottomOutlined style={{ marginRight: 10 }} />{isRight ? '✓ ' : ''}{t('Pin Right')}</span>) },
                    ],
                  } as any);
                }
                items.push({ key: 'autosize-this', label: (<span><ColumnWidthOutlined style={{ marginRight: 10 }} />{t('Autosize This Column')}</span>) });
                items.push({ key: 'autosize-all', label: (<span><ColumnWidthOutlined style={{ marginRight: 10 }} />{t('Autosize All Columns')}</span>) });
                if (enableColumnVisibility) {
                  items.push({
                    key: 'choose-columns',
                    label: (<span><CheckSquareOutlined style={{ marginRight: 10 }} />{t('Choose Columns')}</span>) as any,
                    children: [
                      { key: 'choose-__select_all__', label: (<span>{t('Select All')}</span>) },
                      { key: 'choose-__deselect_all__', label: (<span>{t('Deselect All')}</span>) },
                      { key: 'choose-__divider__', type: 'divider' as const },
                      ...visibleColumnsMeta.map((c: any) => {
                        const ck = String(c.key);
                        const allKeys = visibleColumnsMeta.map((cc: any) => String(cc.key));
                        const current = new Set(visibleColumnKeys || allKeys);
                        const checked = current.has(ck);
                        return {
                          key: `choose-${ck}`,
                          label: (
                            <span>
                              <input
                                type="checkbox"
                                readOnly
                                checked={checked}
                                style={{ marginRight: 6, pointerEvents: 'none' }}
                              />
                              {String(c.label || ck)}
                            </span>
                          ),
                        };
                      }),
                      { key: 'choose-__divider2__', type: 'divider' as const },
                      { key: 'choose-__close__', label: (<span style={{ fontWeight: 500, color: theme.colorPrimary }}>{t('Done')}</span>) },
                    ],
                  } as any);
                }
                items.push({ key: 'reset-columns', label: (<span><ReloadOutlined style={{ marginRight: 10 }} />{t('Reset Columns')}</span>) });
                return items;
              })(),
              onClick: ({ key: actionKey, domEvent }: any) => {
                // Check if this is a column selection action - don't close menu for these
                const isColumnSelectionAction = String(actionKey || '').startsWith('choose-');

                // Prevent default menu close behavior for column selections
                if (isColumnSelectionAction) {
                  try {
                    domEvent?.preventDefault?.();
                    domEvent?.stopPropagation?.();
                  } catch {}
                } else {
                  try { domEvent?.stopPropagation?.(); } catch {}
                }

                const k = String(colKey);
                if (actionKey === 'sort-asc') {
                  try { col.toggleSortBy(false); } catch {}
                  setOpenHeaderMenuKey(null);
                } else if (actionKey === 'sort-desc') {
                  try { col.toggleSortBy(true); } catch {}
                  setOpenHeaderMenuKey(null);
                } else if (actionKey === 'pin-none') {
                  const left = pinnedLeftKeys.filter((x: string) => x !== k);
                  const right = pinnedRightKeys.filter((x: string) => x !== k);
                  savePinned(left, right);
                  setOpenHeaderMenuKey(null);
                } else if (actionKey === 'pin-left') {
                  const left = Array.from(new Set([...(pinnedLeftKeys.filter((x: string) => x !== k)), k]));
                  const right = pinnedRightKeys.filter((x: string) => x !== k);
                  savePinned(left, right);
                  setOpenHeaderMenuKey(null);
                } else if (actionKey === 'pin-right') {
                  const right = Array.from(new Set([...(pinnedRightKeys.filter((x: string) => x !== k)), k]));
                  const left = pinnedLeftKeys.filter((x: string) => x !== k);
                  savePinned(left, right);
                  setOpenHeaderMenuKey(null);
                } else if (actionKey === 'autosize-this') {
                  try {
                    const headerLen = String(label || colKey).length;
                    let maxLen = headerLen;
                    try {
                      (data as any[]).slice(0, 200).forEach((r: any) => {
                        const val = r?.[colKey];
                        const text = String((val ?? ''));
                        maxLen = Math.max(maxLen, text.length);
                      });
                    } catch {}
                    const widthPx = Math.max(60, Math.min(400, Math.round(maxLen * 8 + 24)));
                    setTableColWidthsByKey((prev: any) => {
                      const updated = { ...(prev || {}), [String(colKey)]: widthPx } as Record<string, number>;
                      try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
                      return updated;
                    });
                  } catch {}
                  setOpenHeaderMenuKey(null);
                } else if (actionKey === 'autosize-all') {
                  try {
                    const updated: Record<string, number> = { ...(tableColWidthsByKey || {}) };
                    (appliedVisibleColumnsMeta || []).forEach((m: any) => {
                      let maxLen = String(m.label || m.key).length;
                      try {
                        (data as any[]).slice(0, 200).forEach((r: any) => {
                          const val = r?.[m.key];
                          const text = String((val ?? ''));
                          maxLen = Math.max(maxLen, text.length);
                        });
                      } catch {}
                      const widthPx = Math.max(60, Math.min(400, Math.round(maxLen * 8 + 24)));
                      updated[String(m.key)] = widthPx;
                    });
                    setTableColWidthsByKey(() => {
                      try { if (sliceId) localStorage.setItem(`columnWidths_${sliceId}`, JSON.stringify(updated)); } catch {}
                      return updated;
                    });
                  } catch {}
                  setOpenHeaderMenuKey(null);
                } else if (isColumnSelectionAction) {
                  try {
                    const targetKey = String(actionKey).replace('choose-','');

                    // Handle "Done" button - close the menu
                    if (targetKey === '__close__') {
                      setOpenHeaderMenuKey(null);
                      setOpenSubmenuKeys([]);
                      return;
                    }

                    // Skip dividers
                    if (targetKey === '__divider__' || targetKey === '__divider2__') {
                      return;
                    }

                    // Force the submenu to stay open by ensuring 'choose-columns' is in the open keys
                    if (!openSubmenuKeys.includes('choose-columns')) {
                      setOpenSubmenuKeys(['choose-columns']);
                    }

                    const allKeys = visibleColumnsMeta.map((c: any) => String(c.key));
                    const current = new Set(visibleColumnKeys || allKeys);
                    if (targetKey === '__select_all__') {
                      saveVisibleColumns(null);
                    } else if (targetKey === '__deselect_all__') {
                      // cannot hide all
                    } else {
                      const next = new Set(current);
                      if (next.has(targetKey)) next.delete(targetKey); else next.add(targetKey);
                      if (next.size > 0) saveVisibleColumns(Array.from(next));
                    }
                  } catch (err) {
                    console.error('Column selection error:', err);
                  }
                  // Don't close menu - keep it open for multi-select
                  // The return statement prevents further execution including default close behavior
                  return;
                } else if (actionKey === 'reset-columns') {
                  try {
                    saveVisibleColumns(null);
                    setTableColWidthsByKey({});
                    try { if (sliceId) localStorage.removeItem(`columnWidths_${sliceId}`); } catch {}
                    savePinned([], []);
                    try { if (chartId) localStorage.removeItem(`columnOrder_${chartId}`); } catch {}
                  } catch {}
                  setOpenHeaderMenuKey(null);
                }
              },
            }}
            trigger={["click"]}
            open={openHeaderMenuKey === String(colKey)}
            onOpenChange={(v) => {
              if (v) {
                setOpenHeaderMenuKey(String(colKey));
              } else {
                // Close the menu when dropdown wants to close
                setOpenHeaderMenuKey(null);
                // Also reset submenu state
                setOpenSubmenuKeys([]);
              }
            }}
          >
            <span className="dt-ellipsis-button" title={t('Column menu') as any}>
              <MoreOutlined />
            </span>
          </Dropdown>
          </div>
        </div>
      ) : (
        <div data-column-name={col?.id} css={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div css={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span data-column-name={col?.id}>{label}</span>
            <SortIcon column={col} />
          </div>
          <div css={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
          {enableAdvancedColumnFilters && (
            <Dropdown
              trigger={["click"]}
              open={openFilterKey === colKey}
              onOpenChange={(v: boolean) => setOpenFilterKey(v ? colKey : null)}
              {...({
                overlayStyle: { boxShadow: 'none', filter: 'none' },
                dropdownRender: () => (
                  <div
                    className="ant-dropdown-menu ant-dropdown-menu-root ant-dropdown-menu-vertical ant-dropdown-menu-light dt-filter-panel"
                    style={{ boxShadow: 'none', filter: 'none' }}
                    onClick={(e: any) => e.stopPropagation?.()}
                  >
                    {renderFilterPanel()}
                  </div>
                ),
                getPopupContainer: () => document.body,
              } as any)}
            >
              <span
                className={['dt-filter-icon', (advancedFilters[colKey]?.conditions?.length ? 'active' : '')].join(' ')}
                role="button"
                aria-label={t('Filter column') as any}
                onClick={(e: any) => { e.stopPropagation?.(); }}
              >
                <FilterOutlined />
                {((advancedFilters[colKey]?.conditions?.length || 0) > 0) ? (
                  <span className="dt-filter-count">{advancedFilters[colKey]?.conditions?.length}</span>
                ) : null}
              </span>
            </Dropdown>
          )}
          </div>
        </div>
      )}
      {false && enableAdvancedColumnFilters && openFilterKey === colKey ? (
        <div className="dt-filter-panel" onClick={e => e.stopPropagation?.()}>
          {(() => {
            const ops: { value: any; label: string }[] = isNumeric
              ? [
                  { value: 'equals', label: t('Equals') as any },
                  { value: 'not_equals', label: t('Not equals') as any },
                  { value: 'gt', label: '>' },
                  { value: 'gte', label: '>=' },
                  { value: 'lt', label: '<' },
                  { value: 'lte', label: '<=' },
                  { value: 'between', label: t('Between') as any },
                  { value: 'in', label: t('In list') as any },
                  { value: 'not_in', label: t('Not in list') as any },
                  { value: 'is_null', label: t('Is null') as any },
                  { value: 'is_not_null', label: t('Is not null') as any },
                ]
              : [
                  { value: 'contains', label: t('Contains') as any },
                  { value: 'not_contains', label: t('Does not contain') as any },
                  { value: 'equals', label: t('Equals') as any },
                  { value: 'not_equals', label: t('Not equals') as any },
                  { value: 'starts_with', label: t('Starts with') as any },
                  { value: 'ends_with', label: t('Ends with') as any },
                  { value: 'in', label: t('In list') as any },
                  { value: 'not_in', label: t('Not in list') as any },
                  { value: 'is_empty', label: t('Is empty') as any },
                  { value: 'is_not_empty', label: t('Is not empty') as any },
                  { value: 'is_null', label: t('Is null') as any },
                  { value: 'is_not_null', label: t('Is not null') as any },
                ];
            const DEFAULT_OP = String(ops?.[0]?.value || 'equals');
            let selectedOp: any = DEFAULT_OP;
            let v1: any; let v2: any;
            return (
              <>
                <div className="row">
                  <select
                    aria-label={t('Operator') as any}
                    defaultValue={DEFAULT_OP}
                    onChange={e => { selectedOp = e.target.value; }}
                    style={{ width: '100%' }}
                  >
                    {ops.map(op => (
                      <option value={op.value} key={String(op.value)}>{op.label}</option>
                    ))}
                  </select>
                </div>
                {String(selectedOp) === 'between' ? (
                  <div className="row" style={{ display: 'flex', gap: 6 }}>
                    <input type="number" placeholder={t('Min') as any} onChange={e => { v1 = e.target.value; }} style={{ width: '50%' }} />
                    <input type="number" placeholder={t('Max') as any} onChange={e => { v2 = e.target.value; }} style={{ width: '50%' }} />
                  </div>
                ) : (['gt','gte','lt','lte','equals','not_equals'].includes(String(selectedOp)) && isNumeric) ? (
                  <div className="row">
                    <input type="number" placeholder={t('Value') as any} onChange={e => { v1 = e.target.value; }} style={{ width: '100%' }} />
                  </div>
                ) : (!['is_null','is_not_null','is_empty','is_not_empty'].includes(String(selectedOp))) ? (
                  <div className="row">
                    <input placeholder={t('Value(s)') as any} onChange={e => { v1 = e.target.value; }} style={{ width: '100%' }} />
                    <div style={{ fontSize: 11, color: theme.colorTextTertiary }}>{t('Use comma to separate values for list')}</div>
                  </div>
                ) : null}
                <div className="row" style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  <Button size="small" onClick={() => {
                    setAdvancedFilters((prev: any) => {
                      const prevCfg = prev[colKey] || { logic: 'AND', conditions: [] };
                      const next = { ...prevCfg, conditions: [...(prevCfg.conditions || []), { op: selectedOp, value: v1, value2: v2 }] };
                      return { ...prev, [colKey]: next };
                    });
                  }}>{t('Add')}</Button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button size="small" onClick={() => setOpenFilterKey(null)}>{t('Close')}</Button>
                  </div>
                </div>
                {(advancedFilters[colKey]?.conditions?.length ? (
                  <div className="row" style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>{t('Combine with')}</span>
                      <select
                        value={advancedFilters[colKey]?.logic || 'AND'}
                        onChange={e => setAdvancedFilters((prev: any) => ({ ...prev, [colKey]: { ...(prev[colKey] || { conditions: [] }), logic: (e.target.value as any) } }))}
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                      <Button size="small" onClick={() => setAdvancedFilters((prev: any) => ({ ...prev, [colKey]: { logic: (prev[colKey]?.logic || 'AND'), conditions: [] } }))}>{t('Clear')}</Button>
                    </div>
                    <div>
                      {(advancedFilters[colKey]?.conditions || []).map((c: any, idx: number) => (
                        <span key={`c-${idx}`} className="dt-filter-chip">
                          <span>{String(c.op)}</span>
                          {c.value !== undefined && <span>{String(c.value)}</span>}
                          {c.value2 !== undefined && <span>- {String(c.value2)}</span>}
                  <span
                    className="dt-chip-close"
                    role="button"
                    tabIndex={0}
                    title={t('Remove condition') as any}
                    onClick={() => setAdvancedFilters((prev: any) => {
                      const cfg = prev[colKey];
                      const nextConds = (cfg?.conditions || []).slice();
                      nextConds.splice(idx, 1);
                      const next = { ...(cfg || { logic: 'AND', conditions: [] }), conditions: nextConds };
                      return { ...prev, [colKey]: next };
                    })}
                    onKeyDown={(e: any) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault?.();
                        setAdvancedFilters((prev: any) => {
                          const cfg = prev[colKey];
                          const nextConds = (cfg?.conditions || []).slice();
                          nextConds.splice(idx, 1);
                          const next = { ...(cfg || { logic: 'AND', conditions: [] }), conditions: nextConds };
                          return { ...prev, [colKey]: next };
                        });
                      }
                    }}
                  >
                    <CloseOutlined />
                  </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null)}
              </>
            );
          })()}
        </div>
      ) : null}
      {props.enableQuickFilters && !serverPagination ? (
        <div style={{ marginTop: 4 }}>
          <input
            aria-label={`Filter ${label}`}
            placeholder={t('Filter') as any}
            style={{ width: '95%', fontSize: 10 }}
            value={quickFilters[column.key] || ''}
            onChange={e => setQuickFilters((prev: any) => ({ ...prev, [column.key]: e.target.value }))}
          />
        </div>
      ) : null}
    </th>
  );
};

export default HeaderCell;
