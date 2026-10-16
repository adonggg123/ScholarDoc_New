$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
    $wb = $excel.Workbooks.Open('c:\Users\judej\ScholarDoc\scratch\test_logo_form3.xlsx')
    $ws = $wb.Sheets.Item(1)
    
    Write-Host ("Workbook opened cleanly! Shapes count: " + $ws.Shapes.Count)
    for ($i = 1; $i -le $ws.Shapes.Count; $i++) {
        $shape = $ws.Shapes.Item($i)
        Write-Host ("Shape $i : Name=" + $shape.Name + " Left=" + $shape.Left + " Top=" + $shape.Top + " Width=" + $shape.Width + " Height=" + $shape.Height)
    }
    
    $pdfPath = 'c:\Users\judej\ScholarDoc\scratch\test_logo_form3.pdf'
    if (Test-Path $pdfPath) { Remove-Item $pdfPath -Force }
    $ws.ExportAsFixedFormat(0, $pdfPath)
    Write-Host ("Exported to " + $pdfPath)
    $wb.Close($false)
} catch {
    Write-Host ("Error: " + $_.Exception.Message)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
