import openpyxl

file_path = r"c:\Users\judej\ScholarDoc\0_Annex 5 - TES New Billing Form (1).xlsx"
wb = openpyxl.load_workbook(file_path, data_only=True)

for name in ['Annex 5-TES New Form 2', 'Annex 5-TES New Form 3']:
    sheet = wb[name]
    print(f"\n===== {name} =====")
    rows = list(sheet.iter_rows(values_only=True))
    # Let's search for headers. Headers usually start with sequential numbers or specific labels like "Control Number" or "Student ID".
    # Let's print rows 10 to 30.
    for i, row in enumerate(rows[10:35], start=11):
        if any(row):
            print(f"Row {i:02d}: {[str(c)[:25] if c is not None else '' for c in row[:25]]}")
