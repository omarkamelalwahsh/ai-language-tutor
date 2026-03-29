import zipfile
import xml.etree.ElementTree as ET

file_path = r'E:\ai-language-tutor\Data\CEFR Descriptors (2020).xlsx'

try:
    with zipfile.ZipFile(file_path, 'r') as z:
        # Check sharedStrings
        if 'xl/sharedStrings.xml' in z.namelist():
            with z.open('xl/sharedStrings.xml') as f:
                content = f.read().decode('utf-8')
                print("--- Shared Strings (first 500 chars) ---")
                print(content[:500])
        
        # Check sheet1
        if 'xl/worksheets/sheet1.xml' in z.namelist():
            with z.open('xl/worksheets/sheet1.xml') as f:
                print("\n--- Sheet 1 (first 500 chars) ---")
                print(f.read().decode('utf-8')[:500])
except Exception as e:
    print("Error:", e)
