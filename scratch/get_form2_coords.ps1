$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
try {
    $wb = $excel.Workbooks.Open('c:\Users\judej\ScholarDoc\assets\Annex 5-TES New Form 2.xlsx')
    $ws = $wb.Sheets.Item(1)
    
    $rangeHeader = $ws.Range("B4:Q6")
    Write-Host ("Form 2 Header Range B4:Q6 Left=" + $rangeHeader.Left + " Width=" + $rangeHeader.Width + " Right=" + ($rangeHeader.Left + $rangeHeader.Width) + " Center=" + ($rangeHeader.Left + $rangeHeader.Width / 2))
    Write-Host ("Form 2 Header Range B4 Top=" + $ws.Range("B4").Top + " B6 Bottom=" + ($ws.Range("B6").Top + $ws.Range("B6").Height))
    
    foreach ($shape in $ws.Shapes) {
        if ($shape.Type -eq 13) { # msoPicture
            Write-Host ("Picture: " + $shape.Name + " Left=" + $shape.Left + " Top=" + $shape.Top + " Width=" + $shape.Width + " Height=" + $shape.Height)
        }
    }
    
    $wb.Close($false)
} finally {
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}
