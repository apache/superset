/**
 * AlertDataTableContainer - Container component for AlertDataTable
 * Renders the alert data table in the dashboard
 */
import React from 'react';
import AlertDataTable from './AlertDataTable';

interface AlertDataTableContainerProps {
  id: string;
  component: any;
  parentComponent: any;
  index: number;
  depth: number;
  editMode: boolean;
  onDrop: any;
  deleteComponent: any;
}

const AlertDataTableContainer: React.FC<AlertDataTableContainerProps> = () => {
  return (
    <div
      className="dashboard-component dashboard-component-chart-holder"
      data-test="dashboard-component-alert-data-table"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
      }}
    >
      <AlertDataTable />
    </div>
  );
};

export default AlertDataTableContainer;
