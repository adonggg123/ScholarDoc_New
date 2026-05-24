import openpyxl

file_path = r"c:\Users\judej\ScholarDoc\0_Annex 5 - TES New Billing Form (1).xlsx"
wb = openpyxl.load_workbook(file_path, data_only=False)
sheet = wb['Annex 5-TES New Form 2']
print("===== Annex 5-TES New Form 2 Row 48 to 52 (all cols) =====")
for r in range(48, 53):
    row_vals = [(col_idx, sheet.cell(row=r, column=col_idx).value) for col_idx in range(1, 28)]
    row_filtered = [(col, val) for col, val in row_vals if val is not None]
    print(f"Row {r:02d}: {row_filtered}")
