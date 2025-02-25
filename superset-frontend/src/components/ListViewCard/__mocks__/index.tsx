import React from 'react';

const ListViewCard = ({
  title,
  description,
  cover,
  url,
  actions,
}: any) => (
  <div data-test="list-view-card">
    {cover && <div data-test="card-cover">{cover}</div>}
    <div data-test="card-body">
      <div data-test="card-title">{title}</div>
      <div data-test="card-description">{description}</div>
      {actions && <div data-test="card-actions">{actions}</div>}
    </div>
  </div>
);

ListViewCard.Actions = ({ children }: any) => (
  <div data-test="list-view-card-actions">{children}</div>
);

export default ListViewCard;