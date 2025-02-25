import React from 'react';

const FilterScopeModal = ({ filter, onSave, onClose }: any) => (
  <div data-test="filter-scope-modal">
    <div data-test="filter-scope-modal-header">
      Filter Scope
    </div>
    <div data-test="filter-scope-modal-body">
      {filter?.name}
    </div>
    <div data-test="filter-scope-modal-footer">
      <button onClick={onClose}>Cancel</button>
      <button onClick={() => onSave(filter)}>Save</button>
    </div>
  </div>
);

export default FilterScopeModal;