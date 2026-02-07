import React, { memo } from 'react';
import { Dropdown } from '@superset-ui/chart-controls';
import { Button, Space, Tag } from '@superset-ui/core/components';
import { useTheme } from '@apache-superset/core/ui';
import { DownOutlined } from '@ant-design/icons';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  LinkOutlined,
  CheckOutlined,
  KeyOutlined,
  TagOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { BulkAction } from '.';

// Helper: read RLS extra rules primarily from window; fallback to decoding a stored JWT
const getRlsExtraRules = (): Record<string, any> => {
  try {
    const fromWindow = (window as any).rls_extra_rules;
    if (fromWindow && typeof fromWindow === 'object') return fromWindow;

    const storedToken =
      (typeof localStorage !== 'undefined' && localStorage.getItem('access_token')) ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('access_token')) ||
      '';
    if (storedToken && storedToken.includes('.')) {
      try {
        const parts = storedToken.split('.');
        let payload = parts[1] || '';
        // Handle base64url -> base64 conversion
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4) payload += '=';
        const decoded = JSON.parse(atob(payload));
        if (decoded && typeof decoded === 'object' && decoded.rls_extra_rules) {
          return decoded.rls_extra_rules as Record<string, any>;
        }
      } catch {
        // ignore token decode errors
      }
    }
  } catch {
    // no-op
  }
  return {};
};

// Evaluate RLS visibility conditions (ALL must pass - AND logic)
const evaluateRlsVisibilityConditions = (
  conditions: Array<{ rlsKey: string; operator: string; value: any }> | undefined,
): boolean => {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means visible
  }

  const rlsRules = getRlsExtraRules();

  for (const condition of conditions) {
    const { rlsKey, operator, value: condValue } = condition;
    const rlsValue = rlsRules[rlsKey];

    let passes = false;
    switch (operator) {
      case "==":
        passes = rlsValue == condValue;
        break;
      case "!=":
        passes = rlsValue != condValue;
        break;
      case "IN": {
        const list = String(condValue).split(",").map((s) => s.trim());
        passes = list.includes(String(rlsValue));
        break;
      }
      case "NOT IN": {
        const list = String(condValue).split(",").map((s) => s.trim());
        passes = !list.includes(String(rlsValue));
        break;
      }
      default:
        passes = true;
    }

    // If any condition fails, return false (AND logic)
    if (!passes) {
      return false;
    }
  }

  return true; // All conditions passed
};

const styles = `
  .bulk-actions-container {
    display: flex;
    width: fit-content;
    align-items: center;
    padding: 8px;
    justify-content: flex-end;
  }

  .btn-group { display: flex; gap: 8px; align-items: center; }
  .selection-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    margin-right: 2px;
    border-radius: 8px;
    font-size: 12px;
    background-color: #eee;
    color: #666666;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease, transform 0.2s ease;
  }
  
  .selection-badge:hover {
    background-color: #ddd;
    color: #333;
    transform: scale(1.05);
  }
  
  .selection-badge:active {
    transform: scale(0.95);
    background-color: #ccc;
  }

  .btn { margin-left: 4px; }
`;

export interface BulkActionProps {
  initialSelectedRows: Map<string, any>;
  bulkActionLabel?: string;
  actions: {
    split: Set<BulkAction>;
    nonSplit: Set<BulkAction>;
  };
  onActionClick: (actionKey: string) => void;
  onClearSelection?: () => void;
  showSplitInSliceHeader: boolean;
  value?: string;
  rowId?: string | number;
  sliceId?: string | number;
  onInvertSelection?: () => void;
}

export const BulkActions: React.FC<BulkActionProps> = memo(({
                                                         initialSelectedRows,
                                                         bulkActionLabel,
                                                         actions,
                                                         onActionClick,
                                                         onClearSelection,
                                                         showSplitInSliceHeader,
                                                         sliceId,
                                                         onInvertSelection,
                                                       }) => {
  // ✅ FIX: Use props directly instead of copying to local state
  // This eliminates race conditions between parent and child state updates
  const selectedRows = initialSelectedRows;
  const hasSelection = selectedRows?.size > 0;

  // Convert Sets to Arrays for filtering.
  const splitActions = actions?.split ? Array.from(actions.split) : [];
  const nonSplitActions = actions?.nonSplit ? Array.from(actions.nonSplit) : [];

  const theme = useTheme();

  // Filter actions that should be visible
  // Split actions: show in table only if NOT globally moved to slice header
  // Non-split actions: show in table only if individually NOT marked for slice header
  const visibleActions = {
    // Split actions: controlled by global showSplitInSliceHeader flag
    dropdown: !showSplitInSliceHeader
      ? splitActions.filter(action => {
          // Check selection-based visibility
          const selectionVisible = action.visibilityCondition === 'all' ||
            action.visibilityCondition === 'selected' ||
            (action.visibilityCondition === 'unselected' && !hasSelection) ||
            !action.visibilityCondition;

          // Check RLS visibility conditions (ALL must pass)
          const rlsVisible = evaluateRlsVisibilityConditions(action.rlsVisibilityConditions);

          return selectionVisible && rlsVisible;
        })
      : [],

    // Non-split actions: controlled by individual showInSliceHeader property
    buttons: nonSplitActions.filter(action => {
      // Check if should show in slice header
      if (action.showInSliceHeader) return false;

      // Check selection-based visibility
      const selectionVisible = action.visibilityCondition === 'all' ||
        action.visibilityCondition === 'selected' ||
        (action.visibilityCondition === 'unselected' && !hasSelection) ||
        !action.visibilityCondition;

      // Check RLS visibility conditions (ALL must pass)
      const rlsVisible = evaluateRlsVisibilityConditions(action.rlsVisibilityConditions);

      return selectionVisible && rlsVisible;
    })
  };

  // Only non-split actions are rendered as inline buttons; split actions remain in the dropdown
  const headerButtons = visibleActions.buttons;
  const renderIcon = (name?: string) => {
    switch (name) {
      case 'plus':
        return <PlusOutlined />;
      case 'edit':
        return <EditOutlined />;
      case 'delete':
        return <DeleteOutlined />;
      case 'eye':
        return <EyeOutlined />;
      case 'link':
        return <LinkOutlined />;
      case 'check':
        return <CheckOutlined />;
      case 'key':
        return <KeyOutlined />;
      case 'tag':
        return <TagOutlined />;
      case 'more':
        return <MoreOutlined />;
      default:
        return undefined;
    }
  };
  const handleActionClick = (e?: any, action?: BulkAction) => {
    if (e) {
      try {
        typeof e.preventDefault === 'function' && e.preventDefault();
        typeof e.stopPropagation === 'function' && e.stopPropagation();
      } catch (eventError) {
        // ignore
      }
    }
    try {
      // DataTable expects a string action key; it will provide selected rows to the parent
      const key = action?.key ?? String(action);
      onActionClick?.(key as string);
    } catch (actionError) {
      // ignore handler errors to not break UI
    }
  };
  // Determine if dropdown should be shown (only shows actions NOT in slice header)
  const shouldShowDropdown = visibleActions.dropdown.length > 0;

  // Check if all dropdown actions require selection
  // Bulk actions publish even with no selection; keep dropdown enabled
  const allDropdownActionsRequireSelection = false;
  const isDropdownDisabled = false;

  const handleClearSelection = () => {
    // ✅ FIX: Only call parent callback - no local state to update
    // Parent (TableChart) will update via reducer, triggering re-render with new props
    if (typeof onClearSelection === 'function') {
      onClearSelection();
    }
  };

  return (
    <>
      <span className="bulk-actions-container">
        <div className="btn-group">
          <Space>
            <Tag
              style={selectedRows.size > 0 ? ({ backgroundColor: (theme as any).colorPrimary, color: (theme as any).colorBgContainer, border: 'none' } as React.CSSProperties) : undefined}
              closable
              onClose={e => {
                // prevent default close behavior to ensure state is cleared consistently
                try { e?.preventDefault?.(); } catch {}
                handleClearSelection();
              }}
              title={onInvertSelection ? 'Selection scope: current page' : undefined}
            >
              {selectedRows.size} Selected
            </Tag>
            {onInvertSelection ? (
              <Tag color="default" title="Current page scope">Page</Tag>
            ) : null}
            {typeof onInvertSelection === 'function' && (
              <Button size="small" onClick={() => onInvertSelection?.()}>
                Invert
              </Button>
            )}
          </Space>

          {/* Dropdown for split actions (excluding slice header actions) */}
          {visibleActions.dropdown.length > 0 && (
            <Dropdown
              menu={{
                items: visibleActions.dropdown.map(action => ({
                  key: String(action.key),
                  icon: renderIcon(action.icon) as any,
                  label: action.label,
                  disabled: false,
                })),
                onClick: ({ key, domEvent }: any) => {
                  const act = visibleActions.dropdown.find(a => String(a.key) === String(key));
                  if (act) handleActionClick(domEvent, act);
                },
              }}
              disabled={isDropdownDisabled}
            >
              <Button disabled={isDropdownDisabled} size="small">
                {bulkActionLabel} <DownOutlined />
              </Button>
            </Dropdown>
          )}

          {/* Standalone buttons for non-split actions and (optionally) split actions */}
          {headerButtons.map(action => (
            <Button
              key={action.key}
              type={action.style === 'primary' ? 'primary' : 'link'}
              danger={action.style === 'danger'}
              size="small"
              icon={renderIcon(action.icon)}
              title={action.tooltip}
              onClick={(e) => handleActionClick(e, action)}
              disabled={false}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </span>
    </>
  );
});

BulkActions.displayName = 'BulkActions';
