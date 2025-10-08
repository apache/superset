import os
import re
import sys

# Pattern to match theme-related imports from @superset-ui/core
theme_exports = [
    'css', 'styled', 'useTheme', 'ThemeProvider', 'Theme', 'ThemeMode', 
    'themeObject', 'supersetTheme', 'theme', 'SupersetTheme',
    'AnyThemeConfig', 'SupersetThemeConfig', 'ThemeControllerOptions',
    'ThemeStorage', 'isThemeConfigDark', 'ThemeContextType',
    'ThemeAlgorithm', 'SerializableThemeConfig'
]

def update_imports(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Find all imports from @superset-ui/core
    pattern = r"import\s+\{([^}]+)\}\s+from\s+['\"]@superset-ui/core['\"]"
    
    def process_import(match):
        imports = match.group(1)
        import_items = [item.strip() for item in imports.split(',')]
        
        theme_items = []
        other_items = []
        
        for item in import_items:
            # Handle type imports and aliases
            base_item = item.split(' as ')[0].strip()
            if 'type ' in base_item:
                base_item = base_item.replace('type ', '').strip()
            
            if base_item in theme_exports:
                theme_items.append(item)
            else:
                other_items.append(item)
        
        result = []
        if other_items:
            result.append(f"import {{ {', '.join(other_items)} }} from '@superset-ui/core'")
        if theme_items:
            result.append(f"import {{ {', '.join(theme_items)} }} from '@apache-superset/core/ui'")
        
        return ';'.join(result) if result else match.group(0)
    
    content = re.sub(pattern, process_import, content)
    
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

# Find all TypeScript/JavaScript files
for root, dirs, files in os.walk('.'):
    # Skip node_modules and other irrelevant directories
    if 'node_modules' in root or '.git' in root:
        continue
    
    for file in files:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            file_path = os.path.join(root, file)
            if update_imports(file_path):
                print(f"Updated: {file_path}")

print("Done!")
