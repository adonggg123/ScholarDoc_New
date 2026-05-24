import openpyxl

file_path = r"c:\Users\judej\ScholarDoc\0_Annex 5 - TES New Billing Form (1).xlsx"
wb = openpyxl.load_workbook(file_path, data_only=False)
sheet = wb['Annex 5-TES New Form 2']
print("===== Annex 5-TES New Form 2 bottom formulas =====")
for r in range(48, 54):
    row_vals = [sheet.cell(row=r, column=col_idx).value for col_idx in range(1, 20)]
    print(f"Row {r:02d}: {[str(v) if v is not None else '' for v in row_vals]}")
