/**
 * Test script to verify dashboard menu controls implementation
 */

// Test 1: Check if shared controls are defined
try {
  const sharedControls = require('./packages/superset-ui-chart-controls/src/shared-controls/sharedControls.tsx');
  console.log('✅ Shared controls import successful');
  
  if (sharedControls.default.show_fullscreen_menu) {
    console.log('✅ show_fullscreen_menu control exists');
    console.log('   Label:', sharedControls.default.show_fullscreen_menu.label);
    console.log('   Default:', sharedControls.default.show_fullscreen_menu.default);
  } else {
    console.log('❌ show_fullscreen_menu control not found');
  }
  
  if (sharedControls.default.show_data_menu) {
    console.log('✅ show_data_menu control exists');
    console.log('   Label:', sharedControls.default.show_data_menu.label);
    console.log('   Default:', sharedControls.default.show_data_menu.default);
  } else {
    console.log('❌ show_data_menu control not found');
  }
} catch (error) {
  console.log('❌ Error importing shared controls:', error.message);
}

// Test 2: Check datasourceAndVizType section
try {
  const sections = require('./src/explore/controlPanels/sections.tsx');
  console.log('✅ Sections import successful');
  
  const datasourceSection = sections.datasourceAndVizType;
  if (datasourceSection && datasourceSection.controlSetRows) {
    const hasMenuControls = datasourceSection.controlSetRows.some(row => 
      Array.isArray(row) && row.includes('show_fullscreen_menu') && row.includes('show_data_menu')
    );
    
    if (hasMenuControls) {
      console.log('✅ Dashboard menu controls found in datasourceAndVizType section');
    } else {
      console.log('❌ Dashboard menu controls not found in datasourceAndVizType section');
      console.log('   Control rows:', JSON.stringify(datasourceSection.controlSetRows, null, 2));
    }
  } else {
    console.log('❌ datasourceAndVizType section not found or invalid');
  }
} catch (error) {
  console.log('❌ Error importing sections:', error.message);
}

console.log('\n🧪 Testing Summary:');
console.log('- Dashboard menu controls should appear in ALL chart editors');
console.log('- Controls should be in the "Data" tab after "Enable AI insights"');
console.log('- Default values: show_fullscreen_menu=true, show_data_menu=true');
console.log('- When unchecked, respective menu options should disappear from dashboard 3-dot menu');
