import React, { useState } from 'react';
import DvtButton from 'src/components/DvtButton';
import DvtPagination from 'src/components/DvtPagination';
import DvtTable from 'src/components/DvtTable';
import { StyledButtons, StyledDvtDatasets } from './dvt-datasets.module';

const data = [
  { id: 1, name: 'Dataset 1', date: '2023-01-01 12:30:45' },
  { id: 2, name: 'Dataset 2', date: '2023-01-01 12:30:45' },
];

const header = [
  { id: 1, title: 'ID', field: 'id', checkbox: true, flex: 1 },
  { id: 2, title: 'Name', field: 'name' },
  { id: 3, title: 'Date', field: 'date' },
];

function DvtDatasets() {
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = 100;
  const itemPerPage = 10;

  return (
    <StyledDvtDatasets>
      <div>
        <DvtTable
          data={data}
          header={header}
          selected={[]}
          setSelected={() => {}}
          checkboxActiveField="id"
        />
      </div>
      <StyledButtons>
        <DvtButton
          label="Create a New Dataset"
          onClick={() => {}}
          colour="grayscale"
          typeColour="basic"
          size="small"
        />
        <DvtPagination
          page={currentPage}
          setPage={setCurrentPage}
          itemSize={totalItems}
          pageItemSize={itemPerPage}
        />
      </StyledButtons>
    </StyledDvtDatasets>
  );
}

export default DvtDatasets;
