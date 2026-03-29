import pandas as pd

file_path = r'E:\ai-language-tutor\Data\CEFR Descriptors (2020).xlsx'

print("Loading Excel file...")
xl = pd.ExcelFile(file_path)
print("Sheet names:", xl.sheet_names)

for sheet in xl.sheet_names:
    print(f"\n--- Sheet: {sheet} ---")
    try:
        df = xl.parse(sheet)
        print("Columns:", df.columns.tolist())
        print("Sample data:")
        print(df.head(2))
    except Exception as e:
        print("Error parsing sheet:", e)
