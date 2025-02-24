import React from 'react';
import { t } from '@superset-ui/core';
import { Dropdown, Menu } from '@superset-ui/chart-controls';
import { DownOutlined } from '@ant-design/icons';
import { BulkAction } from '.';

const styles = `
  .bulk-actions-container {
    display: flex;
    width: fit-content;
    align-items: center;
    padding: 8px;
    justify-content: flex-end;
  }

  .btn-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .selection-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    margin-right: 8px;
    border-radius: 4px;
    font-size: 12px;
    background-color: #eee;
    color: #666666;
    font-weight: 500;
  }

  .btn {
    margin-left: 4px;
  }
`;

export interface BulkActionProps {
  selectedRows: Set<any>;
  bulkActionLabel?: string;
  actions: {
    split: Set<BulkAction>;
    nonSplit: Set<BulkAction>;
  };
  onActionClick: (action: any) => void;
  showSplitInSliceHeader: boolean;
  value?: string;
  rowId?: string;
}

export const BulkActions: React.FC<BulkActionProps> = ({
                                                         selectedRows,
                                                         bulkActionLabel,
                                                         actions,
                                                         onActionClick,
                                                         showSplitInSliceHeader,
                                                       }) => {
  const hasSelection = selectedRows.size > 0;

  // Convert Sets to Arrays for filtering.
  const splitActions = actions?.split ? Array.from(actions.split) : [];
  const nonSplitActions = actions?.nonSplit ? Array.from(actions.nonSplit) : [];
  const splitInSliceHeader = showSplitInSliceHeader;

  // Filter actions that should be visible
  const visibleActions = {
    // Only include dropdown actions that aren't shown in slice header
    dropdown: splitActions.filter(action =>
      !action.showInSliceHeader &&
      (action.visibilityCondition === 'all' ||
        action.visibilityCondition === 'selected' ||
        (action.visibilityCondition === 'unselected' && !hasSelection) ||
        !action.visibilityCondition)),

    // Only include button actions that aren't shown in slice header
    buttons: nonSplitActions.filter(action =>
      !action.showInSliceHeader &&
      (action.visibilityCondition === 'all' ||
        action.visibilityCondition === 'selected' ||
        (action.visibilityCondition === 'unselected' && !hasSelection) ||
        !action.visibilityCondition))
  };

  const handleActionClick = (action:any) => {
    // Create a new copy of the action with the selectedRows
    const actionWithValue = {
      ...action,
      value: Array.from(selectedRows)
    };

    // Call the onActionClick with the new object
    onActionClick(actionWithValue);
  };

  // Only show dropdown if we have dropdown actions and aren't showing split in slice header
  const shouldShowDropdown = visibleActions.dropdown.length > 0 && !splitInSliceHeader;

  // Check if all dropdown actions require selection
  const allDropdownActionsRequireSelection =
    visibleActions.dropdown.every(a => a.boundToSelection);

  // Dropdown should be disabled if no selection and all actions require selection
  const isDropdownDisabled = !hasSelection && allDropdownActionsRequireSelection;

  return (
    <>
      <style>{styles}</style>
      <span className="bulk-actions-container">
        <div className="btn-group">
          <span className="selection-badge">
            {selectedRows.size} {t('selected')}
          </span>

          {/* Dropdown for split actions */}
          {shouldShowDropdown && (
            <Dropdown
              overlay={
                <Menu>
                  {visibleActions.dropdown.map(action => (
                    <Menu.Item
                      key={action.key}
                      onClick={() => handleActionClick(action)}
                      disabled={action.boundToSelection && !hasSelection}
                    >
                      {action.label}
                    </Menu.Item>
                  ))}
                </Menu>
              }
              trigger={['click']}
              disabled={isDropdownDisabled}
            >
              <button
                className="btn btn-default"
                disabled={isDropdownDisabled}
              >
                {bulkActionLabel} <DownOutlined/>
              </button>
            </Dropdown>
          )}

          {/* Standalone buttons for non-split actions */}
          {visibleActions.buttons.map(action => (
            <button
              key={action.key}
              className={`btn btn-${action.style || 'default'}`}
              onClick={() => handleActionClick(action)}
              disabled={action.boundToSelection && !hasSelection}
            >
              {action.label}
            </button>
          ))}
        </div>
      </span>
    </>
  );
};
