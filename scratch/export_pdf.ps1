$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$xlsxPath = (Resolve-Path "scratch\live_tested_form3.xlsx").Path
$pdfPath = [System.IO.Path]::ChangeExtension($xlsxPath, ".pdf")

$wb = $excel.Workbooks.Open($xlsxPath)
$ws = $wb.Sheets.Item(1)

# Fit to 1 page wide
$ws.PageSetup.Zoom = $false
$ws.PageSetup.FitToPagesWide = 1
$ws.PageSetup.FitToPagesTall = 1

$ws.ExportAsFixedFormat(0, $pdfPath) # 0 = xlTypePDF
Write-Output "Exported PDF to: $pdfPath"

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
