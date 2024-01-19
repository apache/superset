import React from 'react';
import { SupersetTheme } from '@superset-ui/core';
import Icon from '../Icons/Icon';
import DvtPopper from '../DvtPopper';
import {
  StyledInputDrop,
  StyledInputDropField,
  StyledInputDropFieldColumn,
  StyledInputDropFieldIcon,
  StyledInputDropIcon,
  StyledInputDropInputGroup,
  StyledInputDropLabel,
} from './dvt-input-drop.module';

export interface DvtInputDropProps {
  label?: string;
  popoverLabel?: string;
  popoverDirection?: 'top' | 'bottom' | 'left' | 'right';
  placeholder?: string;
  onDrop?: (data: any) => void;
  addIconClick: () => void;
  multiple?: boolean;
  droppedData: any[] | null;
  setDroppedData: (newDroppedData: any[] | any) => void;
}

const DvtInputDrop = ({
  label,
  popoverLabel,
  popoverDirection = 'top',
  placeholder,
  onDrop,
  addIconClick,
  multiple,
  droppedData,
  setDroppedData,
}: DvtInputDropProps) => {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const droppedDataString = e.dataTransfer.getData('drag-drop');
    const droppedData = JSON.parse(droppedDataString);

    if (droppedData) {
      setDroppedData((prevData: any | any[]) => {
        const newData = multiple
          ? Array.isArray(prevData)
            ? [...prevData, droppedData]
            : [droppedData]
          : [droppedData];
        return newData;
      });

      onDrop?.([droppedData]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setDroppedData((prevData: any[]) => {
      const newData = [...prevData];
      newData.splice(index, 1);
      return newData;
    });
  };

  return (
    <StyledInputDrop>
      <StyledInputDropLabel>
        {label}
        {popoverLabel && (
          <DvtPopper label={popoverLabel} direction={popoverDirection}>
            <Icon
              fileName="warning"
              css={(theme: SupersetTheme) => ({
                color: theme.colors.dvt.primary.base,
              })}
              iconSize="l"
            />
          </DvtPopper>
        )}
      </StyledInputDropLabel>
      <StyledInputDropInputGroup
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <StyledInputDropFieldColumn>
          {droppedData?.map((item, index) => (
            <StyledInputDropFieldIcon key={index}>
              <StyledInputDropIcon
                onClick={() =>
                  multiple ? handleRemoveItem(index) : setDroppedData(null)
                }
              >
                <Icon fileName="close" iconSize="l" style={{ marginTop: 9 }} />
              </StyledInputDropIcon>
              <StyledInputDropField
                placeholder={placeholder}
                type="text"
                readOnly
                value={item?.name}
              />
            </StyledInputDropFieldIcon>
          ))}
          {multiple ? (
            <StyledInputDropFieldIcon>
              <StyledInputDropField
                placeholder={placeholder}
                type="text"
                readOnly
              />
              <StyledInputDropIcon onClick={addIconClick}>
                <Icon fileName="dvt-add_square" iconSize="xl" />
              </StyledInputDropIcon>
            </StyledInputDropFieldIcon>
          ) : (
            !droppedData && (
              <StyledInputDropFieldIcon>
                <StyledInputDropField
                  placeholder={placeholder}
                  type="text"
                  readOnly
                />
                <StyledInputDropIcon onClick={addIconClick}>
                  <Icon fileName="dvt-add_square" iconSize="xl" />
                </StyledInputDropIcon>
              </StyledInputDropFieldIcon>
            )
          )}
        </StyledInputDropFieldColumn>
      </StyledInputDropInputGroup>
    </StyledInputDrop>
  );
};

export default DvtInputDrop;
