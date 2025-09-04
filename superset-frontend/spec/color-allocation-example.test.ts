/**
 * Example: Color Allocation for Pie Chart with a=10, b=9, c=1
 */

describe('Color Allocation Example: a=10, b=9, c=1', () => {
  const exampleData = [
    { category: 'a', metric: 10 },
    { category: 'b', metric: 9 },
    { category: 'c', metric: 1 },
  ];

  describe('Categorical Colors (valueBasedColors = false)', () => {
    it('should assign colors based on category names, not values', () => {
      // This is the DEFAULT behavior
      const mockCategoricalColors = {
        'a': '#1f77b4', // Blue
        'b': '#ff7f0e', // Orange  
        'c': '#2ca02c', // Green
      };

      const result = exampleData.map(item => ({
        ...item,
        color: mockCategoricalColors[item.category],
      }));

      console.log('CATEGORICAL COLORS (Default):');
      console.log('a (value: 10) → #1f77b4 (Blue)');
      console.log('b (value: 9)  → #ff7f0e (Orange)');
      console.log('c (value: 1)  → #2ca02c (Green)');
      
      expect(result[0].color).toBe('#1f77b4'); // a gets blue
      expect(result[1].color).toBe('#ff7f0e'); // b gets orange
      expect(result[2].color).toBe('#2ca02c'); // c gets green
      
      // Colors are assigned by NAME, not by VALUE
      // The highest value (a=10) doesn't necessarily get the "first" color
    });
  });

  describe('Value-Based Colors (valueBasedColors = true)', () => {
    it('should assign colors based on metric values - darker for higher values', () => {
      // Calculate min/max values
      const values = exampleData.map(d => d.metric);
      const minValue = Math.min(...values); // 1
      const maxValue = Math.max(...values); // 10
      
      console.log(`Value range: ${minValue} to ${maxValue}`);
      
      // Sequential color scheme (light to dark)
      const sequentialColors = [
        '#f7fcf0', // Lightest
        '#e0f3db',
        '#ccebc5', 
        '#a8ddb5',
        '#7bccc4',
        '#4eb3d3',
        '#2b8cbe',
        '#0868ac',
        '#084081',
        '#042142'  // Darkest
      ];

      const getSequentialColor = (value: number) => {
        const normalized = (value - minValue) / (maxValue - minValue);
        const colorIndex = Math.floor(normalized * (sequentialColors.length - 1));
        return sequentialColors[Math.min(colorIndex, sequentialColors.length - 1)];
      };

      const result = exampleData.map(item => ({
        ...item,
        normalizedValue: (item.metric - minValue) / (maxValue - minValue),
        color: getSequentialColor(item.metric),
      }));

      console.log('\nVALUE-BASED COLORS:');
      result.forEach(item => {
        console.log(`${item.category} (value: ${item.metric}, normalized: ${item.normalizedValue.toFixed(2)}) → ${item.color}`);
      });

      // Verify the color assignments
      expect(result.find(r => r.category === 'a')?.color).toBe('#042142'); // Darkest (highest value: 10)
      expect(result.find(r => r.category === 'b')?.color).toBe('#084081'); // Second darkest (value: 9)  
      expect(result.find(r => r.category === 'c')?.color).toBe('#f7fcf0'); // Lightest (lowest value: 1)
    });

    it('should show the exact normalization calculations', () => {
      const minValue = 1;
      const maxValue = 10;
      const range = maxValue - minValue; // 9

      const calculations = exampleData.map(item => {
        const normalized = (item.metric - minValue) / range;
        const colorIndex = Math.floor(normalized * 9); // 9 = sequentialColors.length - 1
        
        return {
          category: item.category,
          value: item.metric,
          calculation: `(${item.metric} - ${minValue}) / ${range} = ${normalized.toFixed(3)}`,
          colorIndex: colorIndex,
          normalized: normalized,
        };
      });

      console.log('\nDETAILED CALCULATIONS:');
      calculations.forEach(calc => {
        console.log(`${calc.category}: ${calc.calculation} → colorIndex: ${calc.colorIndex}`);
      });

      // a: (10 - 1) / 9 = 1.000 → colorIndex: 9 (darkest)
      expect(calculations.find(c => c.category === 'a')?.normalized).toBe(1.0);
      expect(calculations.find(c => c.category === 'a')?.colorIndex).toBe(9);

      // b: (9 - 1) / 9 = 0.889 → colorIndex: 8 (second darkest)
      expect(calculations.find(c => c.category === 'b')?.normalized).toBeCloseTo(0.889, 3);
      expect(calculations.find(c => c.category === 'b')?.colorIndex).toBe(8);

      // c: (1 - 1) / 9 = 0.000 → colorIndex: 0 (lightest)
      expect(calculations.find(c => c.category === 'c')?.normalized).toBe(0.0);
      expect(calculations.find(c => c.category === 'c')?.colorIndex).toBe(0);
    });
  });

  describe('Visual Comparison', () => {
    it('should show the difference between the two approaches', () => {
      console.log('\n=== COMPARISON ===');
      console.log('Data: a=10, b=9, c=1');
      console.log('');
      console.log('CATEGORICAL (Default):');
      console.log('├─ a (10) → Blue    (based on name "a")');
      console.log('├─ b (9)  → Orange  (based on name "b")');
      console.log('└─ c (1)  → Green   (based on name "c")');
      console.log('');
      console.log('VALUE-BASED (New Feature):');
      console.log('├─ a (10) → Darkest  (highest value)');
      console.log('├─ b (9)  → Dark     (second highest)');
      console.log('└─ c (1)  → Lightest (lowest value)');
      console.log('');
      console.log('KEY DIFFERENCE:');
      console.log('• Categorical: Color = f(category name)');
      console.log('• Value-based: Color = f(metric value)');
      
      expect(true).toBe(true); // This test is for demonstration
    });
  });
});
