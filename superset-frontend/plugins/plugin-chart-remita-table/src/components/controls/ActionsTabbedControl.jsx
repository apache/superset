import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { ControlHeader } from '@superset-ui/chart-controls';
import { Collapse, Checkbox, Select, Input, Space, Alert, Typography, Badge, Form, Button, message } from 'antd';
import { Tooltip } from '@superset-ui/core/components';
import { InfoCircleOutlined } from '@ant-design/icons';
import SplitActionsControlBase from './SplitActionsControl';
import NonSplitActionsControlBase from './NonSplitActionsControl';
import TableActionFormControlBase from './TableActionFormControl';

// Wrap child controls with React.memo to prevent unnecessary re-renders
const SplitActionsControl = React.memo(SplitActionsControlBase);
const NonSplitActionsControl = React.memo(NonSplitActionsControlBase);
const TableActionFormControl = React.memo(TableActionFormControlBase);

const { Panel } = Collapse;
const { Option } = Select;

const DEFAULT_BULK_LABEL = 'Bulk Action';

// Compact styling for collapsible sections
// Keep custom CSS minimal to allow theme defaults to drive typography and spacing
const renderingStyles = `
  .remita-action-setup .remita-action-section { padding: 8px; width: 100%; }
`;

const toBool = (v, fallback = false) => (typeof v === 'boolean' ? v : !!v ?? fallback);
const toStr = (v, fallback = '') => (v == null ? fallback : String(v));

function coerceConfig(value, columns, valueColumn) {
  const v = (value && typeof value === 'object') ? value : {};
  // Consolidate ID columns with backward compatibility
  const rowIdColumn = v.row_id_column || v.bulk_action_id_column || v.table_actions_id_column || valueColumn || (columns?.[0] ?? '');
  return {
    // header bulk actions
    enable_bulk_actions: toBool(v.enable_bulk_actions, false),
    // Back-compat: if selection_enabled is missing but bulk actions are enabled, default to true
    selection_enabled: typeof v.selection_enabled === 'boolean'
      ? v.selection_enabled
      : (toBool(v.enable_bulk_actions, false) ? true : false),
    selection_mode: ['single', 'multiple'].includes(v.selection_mode) ? v.selection_mode : 'multiple',
    row_id_column: rowIdColumn,
    bulk_action_label: toStr(v.bulk_action_label, DEFAULT_BULK_LABEL),
    show_split_buttons_in_slice_header: toBool(v.show_split_buttons_in_slice_header, false),
    split_actions: v.split_actions ?? [],
    non_split_actions: v.non_split_actions ?? [],
    // row actions
    enable_table_actions: toBool(v.enable_table_actions, false),
    hide_row_id_column: toBool(v.hide_row_id_column || v.hide_table_actions_id_column, false),
    table_actions: v.table_actions ?? [],
    // retention
    retain_selection_across_navigation: toBool(v.retain_selection_across_navigation, false),
  };
}

// Memoize inline styles to prevent object recreation
const formStyle = { width: '100%' };
const marginBottom8 = { marginBottom: 8 };

const ActionsTabbedControl = ({ value, onChange, columns = [], valueColumn, selectionEnabledLegacy = false, bulkEnabledLegacy = false, tableActionsEnabledLegacy = false, ...rest }) => {
  const initial = useMemo(() => coerceConfig(value, columns, valueColumn), [value, columns, valueColumn]);
  const [cfg, setCfg] = useState(initial);

  // Memoize columns transformation to prevent creating new arrays on every render
  const mappedColumns = useMemo(() => (columns || []).map(c => [c]), [columns]);

  // Debounce timer ref for onChange propagation
  const onChangeTimerRef = useRef(null);

  useEffect(() => {
    // If parent provides legacy flags (from mapState) and no explicit values in cfg, merge them once
    setCfg(prev => {
      const mergedEnableBulk = prev.enable_bulk_actions ?? !!bulkEnabledLegacy;
      const mergedSelection = (prev.selection_enabled !== undefined)
        ? prev.selection_enabled
        : (selectionEnabledLegacy !== undefined
            ? !!selectionEnabledLegacy
            // Back-compat: if bulk actions are enabled but selection_enabled missing, default to true
            : (mergedEnableBulk ? true : false));
      return {
        ...prev,
        enable_bulk_actions: mergedEnableBulk,
        selection_enabled: mergedSelection,
        enable_table_actions: prev.enable_table_actions ?? !!tableActionsEnabledLegacy,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current);
      }
    };
  }, []);

  // Use functional setState with debounced onChange to reduce parent re-renders
  const updateConfig = useCallback((updates) => {
    setCfg(prev => {
      const next = { ...prev, ...updates };

      // Debounce onChange calls to reduce parent component updates
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current);
      }
      onChangeTimerRef.current = setTimeout(() => {
        onChange?.(next);
      }, 150); // 150ms debounce

      return next;
    });
  }, [onChange]);

  // Memoized handlers using functional updates - no cfg dependency
  const handleEnableBulkActionsChange = useCallback((e) => {
    updateConfig({ enable_bulk_actions: e.target.checked });
  }, [updateConfig]);

  const handleEnableTableActionsChange = useCallback((e) => {
    updateConfig({ enable_table_actions: e.target.checked });
  }, [updateConfig]);

  const handleSelectionEnabledChange = useCallback((e) => {
    updateConfig({ selection_enabled: e.target.checked });
  }, [updateConfig]);

  const handleSelectionModeChange = useCallback((v) => {
    updateConfig({ selection_mode: v });
  }, [updateConfig]);

  const handleRetainSelectionChange = useCallback((e) => {
    updateConfig({ retain_selection_across_navigation: e.target.checked });
  }, [updateConfig]);

  const handleRowIdColumnChange = useCallback((v) => {
    updateConfig({ row_id_column: v });
  }, [updateConfig]);

  const handleBulkActionLabelChange = useCallback((e) => {
    updateConfig({ bulk_action_label: e.target.value });
  }, [updateConfig]);

  const handleShowSplitButtonsChange = useCallback((e) => {
    updateConfig({ show_split_buttons_in_slice_header: e.target.checked });
  }, [updateConfig]);

  const handleSplitActionsChange = useCallback((v) => {
    updateConfig({ split_actions: v });
  }, [updateConfig]);

  const handleNonSplitActionsChange = useCallback((v) => {
    updateConfig({ non_split_actions: v });
  }, [updateConfig]);

  const handleHideRowIdColumnChange = useCallback((e) => {
    updateConfig({ hide_row_id_column: e.target.checked });
  }, [updateConfig]);

  const handleTableActionsChange = useCallback((v) => {
    updateConfig({ table_actions: v });
  }, [updateConfig]);

  // Copy helper for examples in tooltip
  const copyText = useCallback((text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      try {
        if (rest?.actions?.addSuccessToast) {
          rest.actions.addSuccessToast('Copied!');
        } else {
          message.success('Copied!');
        }
      } catch {}
    } catch (e) {
      // swallow copy errors silently in control UI
    }
  }, []);

  // JSON examples shown in tooltip
  const exampleBulk = `[
  {
    "key": "export-selected",
    "label": "Export Selected",
    "publishEvent": true,
    "boundToSelection": true,
    "valueColumns": ["id", "customer"]
  }
]`;
  const exampleRow = `[
  {
    "key": "approve",
    "label": "Approve",
    "publishEvent": true,
    "valueColumns": ["id", "status"]
  }
]`;
  const exampleNavigate = `[
  {
    "key": "open-report",
    "label": "Open Report",
    "publishEvent": false,
    "actionUrl": "https://example.com/report?id={id}"
  }
]`;

  return (
    <div>
      <ControlHeader />
      <style>{renderingStyles}</style>
      <div style={{ marginBottom: 8 }}>
        <Space size={6} align="start">
          <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
          <Typography.Text type="secondary">
            <Tooltip
              title={
                <div>
                  <div><strong>Header Split</strong>: Dropdown of actions in the table header.</div>
                  <div><strong>Header Buttons</strong>: Individual buttons in the table header.</div>
                  <div><strong>Row Actions</strong>: Actions in each row’s ⋮ menu.</div>
                  <div style={{ marginTop: 6 }}>Defaults: <code>publishEvent=true</code>, server pagination ON (50 rows), humanized headers ON.</div>
                  <div>Bulk actions publish even without selection. When selection mode is <code>single</code> the event contains at most one row; when <code>multiple</code> it includes all selected rows. <code>valueColumns</code> trims each row to specific keys.</div>
                  <div>Row actions publish a single row in <code>value</code>; to navigate instead, set <code>publishEvent=false</code> and provide a URL.</div>
                  <div style={{ marginTop: 8 }}><strong>Examples</strong>:</div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>Bulk (Header Split) — publish selected rows</div>
                      <Button size="small" onClick={() => copyText(exampleBulk)}>Copy</Button>
                    </div>
                    <pre style={{ background: '#fafafa', padding: 8, border: '1px solid #eee' }}>{exampleBulk}</pre>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>Row Action — publish a row</div>
                      <Button size="small" onClick={() => copyText(exampleRow)}>Copy</Button>
                    </div>
                    <pre style={{ background: '#fafafa', padding: 8, border: '1px solid #eee' }}>{exampleRow}</pre>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>Navigate instead of publishing</div>
                      <Button size="small" onClick={() => copyText(exampleNavigate)}>Copy</Button>
                    </div>
                    <pre style={{ background: '#fafafa', padding: 8, border: '1px solid #eee' }}>{exampleNavigate}</pre>
                  </div>
                </div>
              }
            >
              <span>Actions help & defaults</span>
            </Tooltip>
          </Typography.Text>
        </Space>
      </div>
      {/* Selection controls - foundational settings that apply to all bulk actions */}
      <div style={{ marginBottom: 8 }}>
        <Form layout="vertical" style={{ width: '100%' }}>
          <Form.Item>
            <Checkbox
              checked={cfg.selection_enabled}
              onChange={handleSelectionEnabledChange}
            >Selection Enabled</Checkbox>
          </Form.Item>
          {cfg.selection_enabled && (
            <>
              <Form.Item label="Selection Mode">
                <Select
                  value={cfg.selection_mode}
                  onChange={handleSelectionModeChange}
                  style={{ width: '100%' }}
                >
                  <Option value="multiple">Multiple Selection</Option>
                  <Option value="single">Single Selection</Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Checkbox
                  checked={cfg.retain_selection_across_navigation}
                  onChange={handleRetainSelectionChange}
                >Retain Selection Across Navigation</Checkbox>
              </Form.Item>
            </>
          )}
        </Form>
      </div>
      {/* Global toggle for bulk actions */}
      <div style={{ marginBottom: 8 }}>
        <Form layout="vertical" style={{ width: '100%' }}>
          <Form.Item>
            <Checkbox
              checked={cfg.enable_bulk_actions}
              onChange={handleEnableBulkActionsChange}
            >Enable Bulk Actions</Checkbox>
          </Form.Item>
        </Form>
      </div>
      <Collapse
        defaultActiveKey={["split"]}
        ghost
        className="remita-action-setup"
        expandIconPosition="end"
        expandIcon={({ isActive }) => (
          <span
            style={{ display: 'inline-block', transform: isActive ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }}
          >
            <svg viewBox="64 64 896 896" focusable="false" data-icon="right" width="1em" height="1em" fill="currentColor" aria-hidden="true">
              <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"></path>
            </svg>
          </span>
        )}
      >
        {cfg.enable_bulk_actions && (
        <Panel header={<SectionHeader title="Header Split" count={Array.isArray(cfg.split_actions) ? cfg.split_actions.length : 0} />} key="split">
          <Space direction="vertical" className="remita-action-section" size={8}>
            <Form layout="vertical" style={{ width: '100%' }}>
              <Form.Item label="Row ID Column">
                <Select
                  value={cfg.row_id_column}
                  onChange={handleRowIdColumnChange}
                  style={{ width: '100%' }}
                >
                  {(columns || []).map(c => (
                    <Option key={c} value={c}>{c}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Bulk Action Label">
                <Input
                  value={cfg.bulk_action_label}
                  onChange={handleBulkActionLabelChange}
                  style={{ width: '100%' }}
                  placeholder={DEFAULT_BULK_LABEL}
                />
              </Form.Item>
            </Form>
            <Checkbox
              checked={cfg.show_split_buttons_in_slice_header}
              onChange={handleShowSplitButtonsChange}
            >Show Split In Slice Header</Checkbox>

            {!cfg.enable_bulk_actions && (
              <Alert type="info" showIcon message="Enable Bulk Actions to activate split actions" />
            )}

            <SplitActionsControl
              value={cfg.split_actions}
              onChange={handleSplitActionsChange}
              columns={mappedColumns}
              valueColumn={cfg.row_id_column}
              selectionEnabled={cfg.selection_enabled}
              offerEditInModal
              {...rest}
            />
          </Space>
        </Panel>
        )}
        {cfg.enable_bulk_actions && (
        <Panel header={<SectionHeader title="Header Buttons" count={Array.isArray(cfg.non_split_actions) ? cfg.non_split_actions.length : 0} />} key="buttons">
          <Space direction="vertical" className="remita-action-section" size={8}>
            <NonSplitActionsControl
              value={cfg.non_split_actions}
              onChange={handleNonSplitActionsChange}
              columns={mappedColumns}
              valueColumn={cfg.row_id_column}
              selectionEnabled={cfg.selection_enabled}
              offerEditInModal
              {...rest}
            />
          </Space>
        </Panel>
        )}
      </Collapse>

      {/* Global toggle for table actions */}
      <div style={{ marginBottom: 8, marginTop: 8 }}>
        <Form layout="vertical" style={{ width: '100%' }}>
          <Form.Item>
            <Checkbox
              checked={cfg.enable_table_actions}
              onChange={handleEnableTableActionsChange}
            >Enable Table Actions</Checkbox>
          </Form.Item>
        </Form>
      </div>

      <Collapse
        defaultActiveKey={["row"]}
        ghost
        className="remita-action-setup"
        expandIconPosition="end"
        expandIcon={({ isActive }) => (
          <span
            style={{ display: 'inline-block', transform: isActive ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }}
          >
            <svg viewBox="64 64 896 896" focusable="false" data-icon="right" width="1em" height="1em" fill="currentColor" aria-hidden="true">
              <path d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"></path>
            </svg>
          </span>
        )}
      >
        {cfg.enable_table_actions && (
        <Panel header={<SectionHeader title="Row Actions" count={Array.isArray(cfg.table_actions) ? cfg.table_actions.length : 0} />} key="row">
          <Space direction="vertical" className="remita-action-section" size={8}>
            <Form layout="vertical" style={{ width: '100%' }}>
              <Form.Item>
                <Checkbox
                  checked={cfg.hide_row_id_column}
                  onChange={handleHideRowIdColumnChange}
                >Hide Row ID Column</Checkbox>
              </Form.Item>
            </Form>

            {!cfg.enable_table_actions && (
              <Alert type="info" showIcon message="Enable Table Actions to activate row actions" />
            )}

            <TableActionFormControl
              value={cfg.table_actions}
              onChange={handleTableActionsChange}
              columns={columns}
              valueColumn={cfg.row_id_column}
              offerEditInModal
              {...rest}
            />
          </Space>
        </Panel>
        )}
      </Collapse>
    </div>
  );
};

const SectionHeader = React.memo(({ title, count }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
    <span>{title}</span>
    <Badge
      count={count}
      style={{
        padding: '0 8px',
        marginLeft: '8px',
        borderRadius: '4px',
        backgroundColor: '#eee',
        color: '#666',
        fontWeight: 500,
      }}
    />
  </div>
));

ActionsTabbedControl.propTypes = {
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  onChange: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.string),
  valueColumn: PropTypes.string,
  selectionEnabledLegacy: PropTypes.bool,
  bulkEnabledLegacy: PropTypes.bool,
  tableActionsEnabledLegacy: PropTypes.bool,
};

export default ActionsTabbedControl;
