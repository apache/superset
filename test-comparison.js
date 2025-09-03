// Simple test to verify our comparison logic works
function testComparisonLogic() {
  console.log('🧪 Testing BigNumber Comparison Logic');
  
  // Test case 1: Positive change
  const test1 = {
    queriesResponse: [{
      data: [{ 'Gross Sale': 120, 'Gross Sale__1 day ago': 100 }],
      colnames: ['Gross Sale', 'Gross Sale__1 day ago']
    }],
    formData: { viz_type: 'big_number_total', metric: 'Gross Sale' }
  };
  
  // Test case 2: Negative change (from your logs)
  const test2 = {
    queriesResponse: [{
      data: [{ 'Gross Sale': 42324187.71, 'Gross Sale__1 day ago': 65945361.96 }],
      colnames: ['Gross Sale', 'Gross Sale__1 day ago']
    }],
    formData: { viz_type: 'big_number_total', metric: 'Gross Sale' }
  };
  
  // Test case 3: Non-BigNumber chart
  const test3 = {
    queriesResponse: [{
      data: [{ 'Value': 100, 'Value__1 day ago': 80 }],
      colnames: ['Value', 'Value__1 day ago']
    }],
    formData: { viz_type: 'table', metric: 'Value' }
  };
  
  function extractComparisonData(queriesResponse, formData) {
    let bigNumberComparisonData = null;

    if (queriesResponse && queriesResponse.length > 0 && formData) {
      const { data = [], colnames = [] } = queriesResponse[0];
      const vizType = formData?.viz_type;
      
      if (data.length > 0 && vizType && vizType.includes('big_number')) {
        const hasTimeOffsetColumns = colnames?.some(
          (col) => col.includes('__') && col !== formData.metric
        );
        
        if (hasTimeOffsetColumns) {
          const metricName = formData.metric || 'value';
          const currentValue = data[0][metricName];
          
          let previousPeriodValue = null;
          for (const col of colnames) {
            if (col.includes('__') && col !== metricName) {
              const rawValue = data[0][col];
              if (rawValue !== null && rawValue !== undefined) {
                previousPeriodValue = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
                break;
              }
            }
          }
          
          if (currentValue !== null && previousPeriodValue !== null && !isNaN(previousPeriodValue)) {
            let percentageChange = 0;
            let comparisonIndicator = 'neutral';
            
            if (previousPeriodValue === 0) {
              percentageChange = currentValue > 0 ? 1 : currentValue < 0 ? -1 : 0;
              comparisonIndicator = currentValue > 0 ? 'positive' : currentValue < 0 ? 'negative' : 'neutral';
            } else if (currentValue === 0) {
              percentageChange = -1;
              comparisonIndicator = 'negative';
            } else {
              percentageChange = (currentValue - previousPeriodValue) / Math.abs(previousPeriodValue);
              comparisonIndicator = percentageChange > 0 ? 'positive' : percentageChange < 0 ? 'negative' : 'neutral';
            }
            
            bigNumberComparisonData = {
              percentageChange,
              comparisonIndicator,
              previousPeriodValue,
              currentValue,
            };
          }
        }
      }
    }
    
    return bigNumberComparisonData;
  }
  
  console.log('Test 1 (Positive change):', extractComparisonData(test1.queriesResponse, test1.formData));
  console.log('Test 2 (Negative change):', extractComparisonData(test2.queriesResponse, test2.formData));
  console.log('Test 3 (Non-BigNumber):', extractComparisonData(test3.queriesResponse, test3.formData));
  
  console.log('✅ Test completed');
}

testComparisonLogic();
