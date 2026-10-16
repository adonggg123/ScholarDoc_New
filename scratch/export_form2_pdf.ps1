$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$xlsxPath = (Resolve-Path "assets\Annex 5-TES New Form 2.xlsx").Path
$pdfPath = (Resolve-Path "scratch").Path + "\form2.pdf"

$wb = $excel.Workbooks.Open($xlsxPath)
$ws = $wb.Sheets.Item(1)

$ws.PageSetup.Zoom = $false
$ws.PageSetup.FitToPagesWide = 1
$ws.PageSetup.FitToPagesTall = 1

$ws.ExportAsFixedFormat(0, $pdfPath)
Write-Output "Exported Form 2 PDF to: $pdfPath"

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
