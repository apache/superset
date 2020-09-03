import extractExtras from '@superset-ui/core/src/query/extractExtras';

describe('extractExtras', () => {
  const baseQueryFormData = {
    datasource: '1__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'PT1M',
    viz_type: 'my_viz',
    filters: [
      {
        col: 'gender',
        op: '==',
        val: 'girl',
      },
    ],
  };

  it('should populate time range endpoints and override formData with double underscored date options', () => {
    expect(
      extractExtras({
        ...baseQueryFormData,
        time_range_endpoints: ['inclusive', 'exclusive'],
        extra_filters: [
          {
            col: '__time_col',
            op: '==',
            val: 'ds2',
          },
          {
            col: '__time_grain',
            op: '==',
            val: 'PT5M',
          },
          {
            col: '__time_range',
            op: '==',
            val: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
          },
        ],
      }),
    ).toEqual({
      extras: {
        time_grain_sqla: 'PT5M',
        time_range_endpoints: ['inclusive', 'exclusive'],
      },
      filters: [
        {
          col: 'gender',
          op: '==',
          val: 'girl',
        },
      ],
      granularity: 'ds2',
      time_range: '2009-07-17T00:00:00 : 2020-07-17T00:00:00',
    });
  });

  it('should create regular filters from non-reserved columns', () => {
    expect(
      extractExtras({
        ...baseQueryFormData,
        extra_filters: [
          {
            col: 'name',
            op: 'IN',
            val: ['Eve', 'Evelyn'],
          },
        ],
      }),
    ).toEqual({
      extras: {
        time_grain_sqla: 'PT1M',
      },
      filters: [
        {
          col: 'gender',
          op: '==',
          val: 'girl',
        },
        {
          col: 'name',
          op: 'IN',
          val: ['Eve', 'Evelyn'],
        },
      ],
      granularity: 'ds',
    });
  });
});
