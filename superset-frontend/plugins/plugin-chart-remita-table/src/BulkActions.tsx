import React from 'react';
import {t} from '@superset-ui/core';
import {Dropdown, Menu} from '@superset-ui/chart-controls';
import {DownOutlined} from '@ant-design/icons';

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
  actions: {
    split: Set<{
      key: string;
      label: string;
      boundToSelection: boolean;
      visibilityCondition: 'all' | 'selected' | 'unselected';
    }>;
    nonSplit: Set<{
      key: string;
      label: string;
      style?: 'default' | 'primary' | 'danger';
      boundToSelection: boolean;
      visibilityCondition: 'all' | 'selected' | 'unselected';
    }>;
  };
  onActionClick: (actionKey: any, selectedIds: any[]) => void;
}

export const BulkActions: React.FC<BulkActionProps> = ({
                                                         selectedRows,
                                                         actions,
                                                         onActionClick,
                                                       }) => {
  const hasSelection = selectedRows.size > 0;

  // Convert Sets to Arrays for filtering.
  const splitActions = Array.from(actions.split);
  const nonSplitActions = Array.from(actions.nonSplit);

  const dropdownActions = splitActions.filter(action => {
    if (action.visibilityCondition === 'all') return true;
    if (action.visibilityCondition === 'selected') return true;
    if (action.visibilityCondition === 'unselected') return !hasSelection;
    return true;
  });

  const buttonActions = nonSplitActions.filter(action => {
    if (action.visibilityCondition === 'all') return true;
    if (action.visibilityCondition === 'selected') return true;
    if (action.visibilityCondition === 'unselected') return !hasSelection;
    return true;
  });


  return (
    <>
      <style>{styles}</style>
      <span className="bulk-actions-container">
        <div className="btn-group">
          <span className="selection-badge">
            {selectedRows.size} {t('selected')}
          </span>

          {/* Show dropdown if there are dropdown actions */}
          {dropdownActions.length > 0 && (
            <Dropdown
              overlay={
                <Menu>
                  {Array.from(dropdownActions).map(action => (
                    <Menu.Item
                      key={action.key}
                      onClick={() =>
                        onActionClick(action, Array.from(selectedRows))
                      }
                      disabled={action.boundToSelection && !hasSelection}
                    >
                      {action.label}
                    </Menu.Item>
                  ))}

                </Menu>
              }
              trigger={['click']}
              disabled={
                !hasSelection &&
                dropdownActions.every(a => a.boundToSelection)
              }
            >
              <button
                className="btn btn-default"
                disabled={
                  !hasSelection &&
                  dropdownActions.every(a => a.boundToSelection)
                }
              >
                {t('Actions')} <DownOutlined/>
              </button>
            </Dropdown>
          )}
          {/* Render button actions */}
          {
            Array.from(buttonActions).map(action => (
              <button
                key={action.key}
                className={`btn btn-${action.style || 'default'}`}
                onClick={() =>
                  onActionClick(action.key, Array.from(selectedRows))
                }
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
