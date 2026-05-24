import openpyxl

file_path = r"c:\Users\judej\ScholarDoc\0_Annex 5 - TES New Billing Form (1).xlsx"
wb = openpyxl.load_workbook(file_path, data_only=False) # Load with formulas to see them!

for name in ['Annex 5-TES New Form 2', 'Annex 5-TES New Form 3']:
    sheet = wb[name]
    print(f"\n===== {name} (Formula view) =====")
    for row_idx in range(32, 53):
        row_vals = [sheet.cell(row=row_idx, column=col_idx).value for col_idx in range(1, 25)]
        if any(row_vals):
            print(f"Row {row_idx:02d}: {[str(v) if v is not None else '' for v in row_vals]}")
