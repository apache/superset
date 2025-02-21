import React from 'react';
import {t} from '@superset-ui/core';
import {Dropdown, Menu} from '@superset-ui/chart-controls';
import {DownOutlined} from '@ant-design/icons';
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
  const splitActions = actions?.split?Array.from(actions.split):null;
  const nonSplitActions = actions?.nonSplit?Array.from(actions.nonSplit):null;
  const splitInSliceHeader = showSplitInSliceHeader;

  const dropdownActions = splitActions?.filter(action => {
    if (action.showInSliceHeader) return false;
    if (action.visibilityCondition === 'all') return true;
    if (action.visibilityCondition === 'selected') return true;
    if (action.visibilityCondition === 'unselected') return !hasSelection;
    return true;
  });

  const buttonActions = nonSplitActions?.filter(action => {
    if (action.showInSliceHeader) return false;
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
          {dropdownActions && dropdownActions?.length > 0 && !splitInSliceHeader && (
            <Dropdown
              overlay={
                <Menu>
                  {Array.from(dropdownActions).map(action => (
                    <Menu.Item
                      key={action.key}
                      onClick={() => {
                          action.value= Array.from(selectedRows);
                          onActionClick(action);
                        }
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
                dropdownActions?.every(a => a.boundToSelection)
              }
            >
              <button
                className="btn btn-default"
                disabled={
                  !hasSelection &&
                  dropdownActions?.every(a => a.boundToSelection)
                }
              >
                {bulkActionLabel} <DownOutlined/>
              </button>
            </Dropdown>
          )}
          {/* Render button actions */}
          {
            buttonActions && (Array.from(buttonActions)
              .map(action => (
                <button
                  key={action.key}
                  className={`btn btn-${action.style || 'default'}`}
                  onClick={() => {
                    action.value= Array.from(selectedRows);
                    onActionClick(action);
                  }
                  }
                  disabled={action.boundToSelection && !hasSelection}
                >
                  {action.label}
                </button>
              )))}
        </div>
      </span>
    </>
  );
};
