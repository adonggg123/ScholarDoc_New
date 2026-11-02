// js/services/billing_service.js

export class BillingService {
    /**
     * Parses an uploaded file (CSV or Excel) and returns an array of objects.
     */
    static async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                    resolve(json);
                } catch (error) {
                    console.error('BillingService: Error parsing file:', error);
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    static _getValue(row, keys) {
        for (let key of keys) {
            if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
                return row[key];
            }
            // Case insensitive search
            const actualKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
            if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null && String(row[actualKey]).trim() !== '') {
                return row[actualKey];
            }
        }
        return '';
    }

    static _fillIfEmpty(resultRow, match, targetKey, sourceKeys) {
        const existingValue = this._getValue(resultRow, [targetKey]);
        const cleanVal = String(existingValue).trim().toUpperCase();
        if (cleanVal !== '' && cleanVal !== 'N/A') return;

        for (let skey of sourceKeys) {
            if (match[skey] !== undefined && match[skey] !== null && String(match[skey]).trim() !== '') {
                const actualKey = Object.keys(resultRow).find(k => k.toLowerCase() === targetKey.toLowerCase()) || targetKey;
                resultRow[actualKey] = String(match[skey]);
                return;
            }
        }
    }

    /**
     * Matches uploaded records with master list.
     */
    static processBillingData(uploadedData, masterList) {
        let matchedCount = 0;
        let unmatchedCount = 0;
        let duplicateCount = 0;
        const processedData = [];
        const processedIds = new Set();

        for (let row of uploadedData) {
            const studentId = String(this._getValue(row, ['Student ID', 'ID Number', 'Student No', 'ID'])).trim();
            const fullName = String(this._getValue(row, ['Full Name', 'Name', 'Student Name'])).trim();
            const scholarship = String(this._getValue(row, ['Scholarship Type', 'Scholarship', 'Type'])).trim();

            const uniqueKey = studentId !== '' ? studentId : fullName;
            if (uniqueKey !== '' && processedIds.has(uniqueKey)) {
                duplicateCount++;
            }
            if (uniqueKey !== '') processedIds.add(uniqueKey);

            let match = null;

            // 1. Try Student ID match
            if (studentId !== '') {
                match = masterList.find(s => String(s.studentId || '').trim() === studentId);
            }

            // 2. Try Name match
            if (!match && fullName !== '') {
                match = masterList.find(s => String(s.fullName || '').trim().toLowerCase() === fullName.toLowerCase());
            }

            if (!match && fullName !== '' && scholarship !== '') {
                match = masterList.find(s =>
                    String(s.fullName || '').trim().toLowerCase() === fullName.toLowerCase() &&
                    (String(s.scholarship_name || s.scholarshipName || s.scholarship || '').trim().toLowerCase() === scholarship.toLowerCase() ||
                        String(s.scholarshipType || '').trim().toLowerCase() === scholarship.toLowerCase())
                );
            }

            const resultRow = { ...row };

            if (match) {
                matchedCount++;
                resultRow['matchStatus'] = 'matched';

                // Auto-fill missing fields
                this._fillIfEmpty(resultRow, match, 'Student ID', ['studentId']);
                this._fillIfEmpty(resultRow, match, 'Full Name', ['fullName']);
                this._fillIfEmpty(resultRow, match, 'Scholarship Type', ['scholarship_name', 'scholarshipName', 'scholarship', 'scholarshipType']);

                this._fillIfEmpty(resultRow, match, 'Course/Program', ['course']);
                this._fillIfEmpty(resultRow, match, 'Degree/Program', ['course']);

                this._fillIfEmpty(resultRow, match, 'Year Level', ['year', 'scholarYearLevel']);
                this._fillIfEmpty(resultRow, match, 'Year', ['year', 'scholarYearLevel']);

                this._fillIfEmpty(resultRow, match, 'Semester', ['semester']);
                this._fillIfEmpty(resultRow, match, 'Academic Year', ['academicYear', 'ay']);

                const family = match.familyDetails || {};
                this._fillIfEmpty(resultRow, match, 'SA Number', ['saNumber', () => family.saNumber]); // Function trick not supported like this, so just mapping to string below
                if (!resultRow['SA Number'] && family.saNumber) resultRow['SA Number'] = family.saNumber;

                this._fillIfEmpty(resultRow, match, 'Sex at Birth (M/F)', ['gender']);
                this._fillIfEmpty(resultRow, match, 'Sex', ['gender']);
                this._fillIfEmpty(resultRow, match, 'Gender', ['gender']);

                this._fillIfEmpty(resultRow, match, 'Birthdate (mm/dd/yyyy)', ['birthdate']);
                this._fillIfEmpty(resultRow, match, 'Birthdate', ['birthdate']);
                this._fillIfEmpty(resultRow, match, 'Birth Date', ['birthdate']);
                this._fillIfEmpty(resultRow, match, 'Birthday', ['birthdate']);

                this._fillIfEmpty(resultRow, match, 'E-mail address', ['email']);
                this._fillIfEmpty(resultRow, match, 'Email', ['email']);
                this._fillIfEmpty(resultRow, match, 'Email Address', ['email']);

                this._fillIfEmpty(resultRow, match, 'Phone Number', ['contactNumber']);
                this._fillIfEmpty(resultRow, match, 'Phone', ['contactNumber']);
                this._fillIfEmpty(resultRow, match, 'Contact Number', ['contactNumber']);

                this._fillIfEmpty(resultRow, match, 'Status', ['status']);
            } else {
                unmatchedCount++;
                resultRow['matchStatus'] = 'unmatched';
            }

            processedData.push(resultRow);
        }

        return {
            processedData,
            stats: {
                total: uploadedData.length,
                matched: matchedCount,
                unmatched: unmatchedCount,
                duplicates: duplicateCount,
            }
        };
    }

    /**
     * Exports processed data to Excel or CSV.
     */
    static async exportFile(data, originalFileName, asCsv = false) {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]).filter(k => k !== 'matchStatus');

        if (asCsv) {
            const rows = [headers];
            for (let row of data) {
                rows.push(headers.map(h => {
                    let val = String(row[h] || '').replace(/"/g, '""');
                    return `"${val}"`;
                }));
            }
            const csvData = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
            const fileName = `AutoFilled_${originalFileName.replace(/\.[^/.]+$/, "")}.csv`;
            saveAs(blob, fileName);
        } else {
            const exportData = data.map(row => {
                const newRow = {};
                headers.forEach(h => newRow[h] = row[h]);
                return newRow;
            });
            const worksheet = XLSX.utils.json_to_sheet(exportData, { header: headers });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `AutoFilled_${originalFileName.replace(/\.[^/.]+$/, "")}.xlsx`;
            saveAs(blob, fileName);
        }
    }

    // --- XML Manipulation Helpers for Annex 5 ---

    static _splitFullName(fullName) {
        fullName = String(fullName || '').trim();
        if (fullName === '') {
            return { lastName: '', givenName: '', middleInitial: '' };
        }

        if (fullName.includes(',')) {
            const parts = fullName.split(',');
            const lastName = parts[0].trim();
            const rest = parts.slice(1).join(',').trim();
            const restParts = rest.split(/\s+/);
            let givenName = '';
            let middleInitial = '';

            if (restParts.length > 1) {
                const lastPart = restParts[restParts.length - 1];
                middleInitial = lastPart.charAt(0).toUpperCase();
                givenName = restParts.slice(0, restParts.length - 1).join(' ').trim();
            } else {
                givenName = rest;
            }
            return { lastName, givenName, middleInitial };
        } else {
            const parts = fullName.split(/\s+/);
            if (parts.length === 1) {
                return { lastName: parts[0], givenName: '', middleInitial: '' };
            } else if (parts.length === 2) {
                return { lastName: parts[1], givenName: parts[0], middleInitial: '' };
            } else {
                const lastPart = parts[parts.length - 1];
                const secondToLast = parts[parts.length - 2];
                const middleInitial = secondToLast.charAt(0).toUpperCase();
                const givenName = parts.slice(0, parts.length - 2).join(' ').trim();
                return { lastName: lastPart, givenName, middleInitial };
            }
        }
    }

    static _colLetter(idx) {
        let r = '';
        let n = idx;
        do {
            r = String.fromCharCode(65 + (n % 26)) + r;
            n = Math.floor(n / 26) - 1;
        } while (n >= 0);
        return r;
    }

    static _colIndexFromAddr(addr) {
        const letters = addr.replace(/[0-9]/g, '');
        let index = 0;
        for (let i = 0; i < letters.length; i++) {
            index = index * 26 + (letters.charCodeAt(i) - 64);
        }
        return index - 1;
    }

    static _defaultStyle(colIdx, isForm2) {
        if (isForm2) {
            switch (colIdx) {
                case 1: return '23';  // B: Control No
                case 2: return '32';  // C: Student No
                case 3: return '32';  // D: TES App No
                case 4: return '29';  // E: Last Name
                case 5: return '29';  // F: Given Name
                case 6: return '23';  // G: Middle Initial
                case 7: return '23';  // H: Sex
                case 8: return '23';  // I: Birthdate
                case 9: return '23';  // J: Degree Program
                case 10: return '23'; // K: Year Level
                case 11: return '23'; // L: Email
                case 12: return '23'; // M: Phone
                case 13: return '23'; // N: TES Batch
                case 14: return '34'; // O: TES Amount
                case 15: return '33'; // P: PWD Amount
                case 16: return '33'; // Q: Total Amount
                default: return '23';
            }
        } else {
            // Form 3 column styles:
            // Centered: Control No (1), Student No (2), TES App No (3), MI (6), Sex (7), Birthdate (8), Year (10)
            // Left-aligned: Last Name (4), Given Name (5), Degree Program (9), Remarks (12)
            // Status: (11)
            switch (colIdx) {
                case 4:
                case 5:
                case 9:
                case 12:
                    return '9';
                case 11:
                    return '14';
                default:
                    return '16';
            }
        }
    }

    static _extractRowStyles(doc, rowNum) {
        const row = Array.from(doc.getElementsByTagName("row")).find(r => r.getAttribute("r") === String(rowNum));
        const styles = {};
        if (row) {
            const cells = Array.from(row.getElementsByTagName("c"));
            for (let c of cells) {
                const r = c.getAttribute("r") || "";
                const col = r.replace(/[0-9]/g, "");
                if (col && c.getAttribute("s")) {
                    styles[col] = c.getAttribute("s");
                }
            }
        }
        return styles;
    }

    static _escapeXml(unsafe) {
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static _getOrCreateRow(doc, sheetData, rowNum) {
        let existing = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(rowNum));
        if (existing) return existing;

        const ns = sheetData.namespaceURI;
        const newRow = ns ? doc.createElementNS(ns, 'row') : doc.createElement('row');
        newRow.setAttribute('r', String(rowNum));

        const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
        let insertBeforeNode = null;
        for (let r of allRows) {
            const rn = parseInt(r.getAttribute('r') || '0', 10);
            if (rn > rowNum) {
                insertBeforeNode = r;
                break;
            }
        }
        if (insertBeforeNode) {
            sheetData.insertBefore(newRow, insertBeforeNode);
        } else {
            sheetData.appendChild(newRow);
        }
        return newRow;
    }

    static _fillCell(doc, rowEl, addr, value, isNumeric, defaultStyle) {
        const escaped = this._escapeXml(value);
        let cell = Array.from(rowEl.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === addr);
        const ns = rowEl.namespaceURI;

        if (!cell) {
            cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
            cell.setAttribute('r', addr);
            if (defaultStyle) {
                cell.setAttribute('s', defaultStyle);
            }

            const targetIdx = this._colIndexFromAddr(addr);
            const cells = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
            let insertBeforeNode = null;
            for (let c of cells) {
                if (this._colIndexFromAddr(c.getAttribute('r') || '') > targetIdx) {
                    insertBeforeNode = c;
                    break;
                }
            }
            if (insertBeforeNode) {
                rowEl.insertBefore(cell, insertBeforeNode);
            } else {
                rowEl.appendChild(cell);
            }
        } else if (defaultStyle) {
            cell.setAttribute('s', defaultStyle);
        }

        while (cell.firstChild) {
            cell.removeChild(cell.firstChild);
        }

        if (isNumeric) {
            cell.removeAttribute('t');
            const v = ns ? doc.createElementNS(ns, 'v') : doc.createElement('v');
            v.textContent = value;
            cell.appendChild(v);
        } else {
            cell.setAttribute('t', 'inlineStr');
            const is = ns ? doc.createElementNS(ns, 'is') : doc.createElement('is');
            const t = ns ? doc.createElementNS(ns, 't') : doc.createElement('t');
            t.textContent = value;
            is.appendChild(t);
            cell.appendChild(is);
        }
    }

    static _injectForm2Rows(xmlStr, students, metadata = {}) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "application/xml");
        const sheetData = doc.getElementsByTagName("sheetData")[0];
        const startRow = 42;
        const templateCapacity = 6;
        const footerStartRow = 48;
        const shiftCount = students.length > templateCapacity ? students.length - templateCapacity : 0;

        const row42Styles = this._extractRowStyles(doc, startRow);
        const row48Styles = this._extractRowStyles(doc, 48);
        const row49Styles = this._extractRowStyles(doc, 49);
        const row50Styles = this._extractRowStyles(doc, 50);
        const row51Styles = this._extractRowStyles(doc, 51);
        const row52Styles = this._extractRowStyles(doc, 52);

        // Header Title (Row 10 B10: "TES Batch [Batch] - [Semester] and Academic Year [AY]")
        if (metadata && (metadata.batch || metadata.academicYear || metadata.semester)) {
            const rawBatch = String(metadata.batch || '1').trim();
            const cleanBatch = rawBatch.replace(/^batch\s*/i, '').trim() || '1';
            const academicYear = metadata.academicYear || '2024-2025';
            const semester = metadata.semester || '1st Semester';
            const titleVal = `TES Batch ${cleanBatch} - ${semester} and Academic Year ${academicYear}`;
            let row10 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === '10');
            if (!row10) row10 = this._getOrCreateRow(doc, sheetData, 10);
            this._fillCell(doc, row10, 'B10', titleVal, false, '308');

            // Reference Number (Row 11 O11): If standalone template (has external reference [1] or no formula)
            let row11 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === '11');
            if (row11) {
                const o11Cell = Array.from(row11.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === 'O11');
                if (o11Cell) {
                    const fTag = o11Cell.getElementsByTagName('f')[0];
                    const fText = fTag ? fTag.textContent : '';
                    if (!fTag || fText.includes('[')) {
                        const ayMatch = academicYear.match(/\b(20\d\d)\b/);
                        const ayStartYear = ayMatch ? parseInt(ayMatch[1], 10) : new Date().getFullYear();
                        let termCode = '1';
                        if (semester.toLowerCase().includes('2nd') || semester.includes('2')) termCode = '2';
                        else if (semester.toLowerCase().includes('summer') || semester.toLowerCase().includes('midyear')) termCode = '3';
                        const regionalCode = metadata.regionalCode || '10';
                        const heiCode = metadata.heiCode || 'USTP';
                        const tranch = metadata.tranch || '1';
                        const billingRefNo = `${regionalCode}-${heiCode}-${ayStartYear}-${termCode}-${tranch}:${cleanBatch}`;
                        this._fillCell(doc, row11, 'O11', billingRefNo, false, o11Cell.getAttribute('s') || '120');
                    }
                }
            }

            // Date (Row 12 O12)
            let row12 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === '12');
            if (row12) {
                const o12Cell = Array.from(row12.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === 'O12');
                if (o12Cell) {
                    const now = new Date();
                    const formattedDate = metadata.date || now.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    this._fillCell(doc, row12, 'O12', formattedDate, false, o12Cell.getAttribute('s') || '119');
                }
            }
        }

        if (shiftCount > 0) {
            // 1. Shift mergeCells with rows >= footerStartRow
            const mergeCells = doc.getElementsByTagName("mergeCell");
            for (let mc of Array.from(mergeCells)) {
                const ref = mc.getAttribute("ref") || "";
                const shiftedRef = ref.split(':').map(part => {
                    const col = part.replace(/[0-9]/g, '');
                    const row = parseInt(part.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(row) && row >= footerStartRow) {
                        return `${col}${row + shiftCount}`;
                    }
                    return part;
                }).join(':');
                if (shiftedRef !== ref) {
                    mc.setAttribute("ref", shiftedRef);
                }
            }

            // 2. Shift existing rows >= footerStartRow in descending order
            const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
            const footerRows = allRows
                .map(rowEl => ({ rowEl, rNum: parseInt(rowEl.getAttribute('r') || '0', 10) }))
                .filter(item => item.rNum >= footerStartRow)
                .sort((a, b) => b.rNum - a.rNum);

            for (const { rowEl, rNum } of footerRows) {
                const newR = rNum + shiftCount;
                rowEl.setAttribute('r', String(newR));
                const cellNodes = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
                for (const cell of cellNodes) {
                    const oldAddr = cell.getAttribute('r') || '';
                    const col = oldAddr.replace(/[0-9]/g, '');
                    if (col) {
                        cell.setAttribute('r', `${col}${newR}`);
                    }
                }
            }

            // 3. Pre-create inserted student rows (footerStartRow to footerStartRow + shiftCount - 1)
            const ns = sheetData.namespaceURI;
            for (let r = footerStartRow; r < footerStartRow + shiftCount; r++) {
                const newRow = this._getOrCreateRow(doc, sheetData, r);
                newRow.setAttribute('spans', '1:24');
                newRow.setAttribute('ht', '15.75');
                newRow.setAttribute('customHeight', '1');
                newRow.setAttribute('thickBot', '1');

                const addCell = (col, style) => {
                    const addr = `${col}${r}`;
                    let cell = Array.from(newRow.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === addr);
                    if (!cell) {
                        cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
                        cell.setAttribute('r', addr);
                        cell.setAttribute('s', style);
                        newRow.appendChild(cell);
                    }
                    return cell;
                };

                addCell('A', row42Styles['A'] || '31');
                for (let c = 1; c <= 16; c++) {
                    const colLet = this._colLetter(c);
                    addCell(colLet, row42Styles[colLet] || this._defaultStyle(c, true));
                }
                for (let col of ['R', 'S', 'T', 'U', 'V', 'W', 'X']) {
                    addCell(col, row42Styles[col] || '1');
                }
            }
        }

        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const rowNum = startRow + i;
            const ctrl = String(i + 1).padStart(5, '0');

            let lastName = String(s.lastName || s.last_name || '').trim();
            let givenName = String(s.firstName || s.first_name || '').trim();
            let middleName = String(s.middleName || s.middle_name || '').trim();
            let middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';

            if (!lastName || !givenName) {
                const parsed = this._splitFullName(s.fullName || s.name || '');
                if (!lastName) lastName = parsed.lastName;
                if (!givenName) givenName = parsed.givenName;
                if (!middleInitial) middleInitial = parsed.middleInitial;
            }

            let gender = String(s.gender || s.sex || 'M').toUpperCase();
            gender = gender.startsWith('F') ? 'F' : 'M';

            let rawYear = String(s.year || s.yearLevel || s.scholarYearLevel || '1');
            let year = rawYear.includes('1') ? '1' :
                rawYear.includes('2') ? '2' :
                    rawYear.includes('3') ? '3' :
                        rawYear.includes('4') ? '4' : rawYear;

            const family = s.familyDetails || {};
            const sa = String(s.saNumber || family.saNumber || s.tesAppNumber || s.tesApplicationNumber || '').trim();
            const course = String(s.course || s.program || s.degreeProgram || '').trim();

            let bdate = String(s.birthdate || s.birthday || '').trim();
            if (bdate === '' || bdate.toUpperCase() === 'N/A') {
                bdate = '01/01/2000';
            } else if (/^\d{4}-\d{2}-\d{2}/.test(bdate)) {
                const [y, m, d] = bdate.split('T')[0].split('-');
                bdate = `${m}/${d}/${y}`;
            }

            const studId = String(s.studentId || s.student_id || s.studentNumber || '').trim();
            const email = String(s.email || s.authEmail || s.emailAddress || '').trim();
            const phone = String(s.contactNumber || s.phone || s.phoneNumber || '').trim();
            const rawBatchStr = String(s.batch || metadata.batch || '1').replace(/^batch\s*/i, '').trim();
            const parsedBatchNum = parseFloat(rawBatchStr);
            const isBatchNum = !isNaN(parsedBatchNum) && isFinite(parsedBatchNum);

            const rowEl = this._getOrCreateRow(doc, sheetData, rowNum);
            const addr = (colIdx) => `${this._colLetter(colIdx)}${rowNum}`;

            const str = (colIdx, val) => {
                const cLet = this._colLetter(colIdx);
                this._fillCell(doc, rowEl, addr(colIdx), val, false, row42Styles[cLet] || this._defaultStyle(colIdx, true));
            };
            const num_ = (colIdx, val) => {
                const cLet = this._colLetter(colIdx);
                this._fillCell(doc, rowEl, addr(colIdx), val, true, row42Styles[cLet] || this._defaultStyle(colIdx, true));
            };

            // Template Row 41 Headers:
            // B: 5-digit Control Number (1)
            // C: Student Number (2)
            // D: TES Application Number (3)
            // E: Last Name (4)
            // F: Given Name (5)
            // G: Middle Initial (6)
            // H: Sex at Birth (M/F) (7)
            // I: Birthdate (mm/dd/yyyy) (8)
            // J: Degree Program (9)
            // K: Year Level (10)
            // L: E-mail address (11)
            // M: Phone Number (12)
            // N: TES Batch (13)
            // O: TES Amount (14)
            // P: TES-3A Person with Disability (15)
            // Q: TOTAL AMOUNT (16)
            str(1, ctrl);                            // B: 5-digit Control Number
            str(2, studId !== '' ? studId : 'N/A');   // C: Student Number
            str(3, sa !== '' ? sa : 'N/A');          // D: TES Application Number
            str(4, lastName);                        // E: Last Name
            str(5, givenName);                       // F: Given Name
            str(6, middleInitial);                   // G: Middle Initial
            str(7, gender);                          // H: Sex at Birth (M/F)
            str(8, bdate);                           // I: Birthdate (mm/dd/yyyy)
            str(9, course);                          // J: Degree Program
            str(10, year);                           // K: Year Level
            str(11, email);                          // L: E-mail address
            str(12, phone);                          // M: Phone Number
            if (isBatchNum) {
                num_(13, parsedBatchNum);                // N: TES Batch
            } else {
                str(13, rawBatchStr || '1');             // N: TES Batch
            }
            num_(14, 10000);                         // O: TES Amount
            num_(15, 0);                             // P: TES-3A Person with Disability
            num_(16, 10000);                         // Q: TOTAL AMOUNT
        }

        // Summary totals at bottom (shifted dynamically when rows expand)
        const totalTesAmount = students.length * 10000;
        const totalPwdAmount = 0;
        const totalAmount = totalTesAmount + totalPwdAmount;
        const mgmtFee = Math.round(totalAmount * 0.01);
        const campusTotal = totalAmount + mgmtFee;

        const targetRow48 = 48 + shiftCount;
        const targetRow49 = 49 + shiftCount;
        const targetRow50 = 50 + shiftCount;
        const targetRow51 = 51 + shiftCount;
        const targetRow52 = 52 + shiftCount;

        const row48 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow48));
        if (row48) {
            this._fillCell(doc, row48, `O${targetRow48}`, totalTesAmount, true, row48Styles['O'] || '25');
            this._fillCell(doc, row48, `P${targetRow48}`, totalPwdAmount, true, row48Styles['P'] || '24');
            this._fillCell(doc, row48, `Q${targetRow48}`, totalAmount, true, row48Styles['Q'] || '23');
        }
        const row49 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow49));
        if (row49) {
            this._fillCell(doc, row49, `Q${targetRow49}`, totalAmount, true, row49Styles['Q'] || '12');
        }
        const row50 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow50));
        if (row50) {
            this._fillCell(doc, row50, `Q${targetRow50}`, mgmtFee, true, row50Styles['Q'] || '17');
        }
        const row51 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow51));
        if (row51) {
            this._fillCell(doc, row51, `Q${targetRow51}`, campusTotal, true, row51Styles['Q'] || '12');
        }
        const row52 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(targetRow52));
        if (row52) {
            this._fillCell(doc, row52, `Q${targetRow52}`, campusTotal, true, row52Styles['Q'] || '7');
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    static _injectForm3Rows(xmlStr, students, metadata = {}) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "application/xml");
        const sheetData = doc.getElementsByTagName("sheetData")[0];
        const startRow = 34;
        const templateCapacity = 6;
        const footerStartRow = 40;
        const shiftCount = students.length > templateCapacity ? students.length - templateCapacity : 0;

        const row34Styles = this._extractRowStyles(doc, startRow);

        // Header Title (Row 9 B9: "TES Batch [Batch] - [Semester] and Academic Year [AY]")
        if (metadata && (metadata.batch || metadata.academicYear || metadata.semester)) {
            const rawBatch = String(metadata.batch || '1').trim();
            const cleanBatch = rawBatch.replace(/^batch\s*/i, '').trim() || '1';
            const academicYear = metadata.academicYear || '2024-2025';
            const semester = metadata.semester || '1st Semester';
            const titleVal = `TES Batch ${cleanBatch} - ${semester} and Academic Year ${academicYear}`;

            let row9 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === '9');
            if (!row9) row9 = this._getOrCreateRow(doc, sheetData, 9);
            const b9Cell = Array.from(row9.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === 'B9');
            const hasFormula = b9Cell && b9Cell.getElementsByTagName('f').length > 0;
            if (!hasFormula) {
                this._fillCell(doc, row9, 'B9', titleVal, false, b9Cell ? b9Cell.getAttribute('s') || '35' : '35');
            }

            // Date (Row 11 L11)
            let row11 = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === '11');
            if (row11) {
                const l11Cell = Array.from(row11.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === 'L11');
                if (l11Cell) {
                    const now = new Date();
                    const formattedDate = metadata.date || now.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    this._fillCell(doc, row11, 'L11', formattedDate, false, l11Cell.getAttribute('s') || '21');
                }
            }
        }

        if (shiftCount > 0) {
            // 1. Shift mergeCells with rows >= footerStartRow
            const mergeCells = doc.getElementsByTagName("mergeCell");
            for (let mc of Array.from(mergeCells)) {
                const ref = mc.getAttribute("ref") || "";
                const shiftedRef = ref.split(':').map(part => {
                    const col = part.replace(/[0-9]/g, '');
                    const row = parseInt(part.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(row) && row >= footerStartRow) {
                        return `${col}${row + shiftCount}`;
                    }
                    return part;
                }).join(':');
                if (shiftedRef !== ref) {
                    mc.setAttribute("ref", shiftedRef);
                }
            }

            // 2. Shift existing rows >= footerStartRow in descending order
            const allRows = Array.from(sheetData.childNodes).filter(n => n.nodeName === 'row');
            const footerRows = allRows
                .map(rowEl => ({ rowEl, rNum: parseInt(rowEl.getAttribute('r') || '0', 10) }))
                .filter(item => item.rNum >= footerStartRow)
                .sort((a, b) => b.rNum - a.rNum);

            for (const { rowEl, rNum } of footerRows) {
                const newR = rNum + shiftCount;
                rowEl.setAttribute('r', String(newR));
                const cellNodes = Array.from(rowEl.childNodes).filter(n => n.nodeName === 'c');
                for (const cell of cellNodes) {
                    const oldAddr = cell.getAttribute('r') || '';
                    const col = oldAddr.replace(/[0-9]/g, '');
                    if (col) {
                        cell.setAttribute('r', `${col}${newR}`);
                    }
                }
            }

            // 3. Pre-create inserted student rows (footerStartRow to footerStartRow + shiftCount - 1)
            const ns = sheetData.namespaceURI;
            for (let r = footerStartRow; r < footerStartRow + shiftCount; r++) {
                const newRow = this._getOrCreateRow(doc, sheetData, r);
                newRow.setAttribute('spans', '1:27');
                newRow.setAttribute('ht', '15.75');
                newRow.setAttribute('customHeight', '1');
                newRow.setAttribute('thickBot', '1');

                const addCell = (col, style) => {
                    const addr = `${col}${r}`;
                    let cell = Array.from(newRow.childNodes).find(n => n.nodeName === 'c' && n.getAttribute('r') === addr);
                    if (!cell) {
                        cell = ns ? doc.createElementNS(ns, 'c') : doc.createElement('c');
                        cell.setAttribute('r', addr);
                        cell.setAttribute('s', style);
                        newRow.appendChild(cell);
                    }
                    return cell;
                };

                addCell('A', row34Styles['A'] || '13');
                for (let c = 1; c <= 12; c++) {
                    const colLet = this._colLetter(c);
                    addCell(colLet, row34Styles[colLet] || this._defaultStyle(c, false));
                }
                for (let col of ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA']) {
                    addCell(col, row34Styles[col] || '1');
                }
            }
        }

        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            const rowNum = startRow + i;
            const ctrl = String(i + 1).padStart(5, '0');

            let lastName = String(s.lastName || s.last_name || '').trim();
            let givenName = String(s.firstName || s.first_name || '').trim();
            let middleName = String(s.middleName || s.middle_name || '').trim();
            let middleInitial = middleName ? middleName.charAt(0).toUpperCase() : '';

            if (!lastName || !givenName) {
                const parsed = this._splitFullName(s.fullName || s.name || '');
                if (!lastName) lastName = parsed.lastName;
                if (!givenName) givenName = parsed.givenName;
                if (!middleInitial) middleInitial = parsed.middleInitial;
            }

            let gender = String(s.gender || s.sex || 'M').toUpperCase();
            gender = gender.startsWith('F') ? 'F' : 'M';

            let rawYear = String(s.year || s.yearLevel || s.scholarYearLevel || '1');
            let year = rawYear.includes('1') ? '1' :
                rawYear.includes('2') ? '2' :
                    rawYear.includes('3') ? '3' :
                        rawYear.includes('4') ? '4' : rawYear;

            const family = s.familyDetails || {};
            const sa = String(s.saNumber || family.saNumber || s.tesAppNumber || s.tesApplicationNumber || '').trim();
            const course = String(s.course || s.program || s.degreeProgram || '').trim();

            let bdate = String(s.birthdate || s.birthday || '').trim();
            if (bdate === '' || bdate.toUpperCase() === 'N/A') {
                bdate = '01/01/2000';
            } else if (/^\d{4}-\d{2}-\d{2}/.test(bdate)) {
                const [y, m, d] = bdate.split('T')[0].split('-');
                bdate = `${m}/${d}/${y}`;
            }

            const studId = String(s.studentId || s.student_id || s.studentNumber || '').trim();
            const rawStatus = String(s.status || s.specialStatusReason || s.submissionStatus || 'Not enrolled');
            const status = rawStatus;
            const remarks = String(s.remarks || s.adminRemarks || (status === 'On Leave of Absence (LOA)' ? 'On approved Leave of Absence' : `Categorized: ${status}`));

            const rowEl = this._getOrCreateRow(doc, sheetData, rowNum);
            rowEl.setAttribute('spans', '1:27');
            rowEl.setAttribute('ht', '15.75');
            rowEl.setAttribute('customHeight', '1');
            rowEl.setAttribute('thickBot', '1');
            const addr = (colIdx) => `${this._colLetter(colIdx)}${rowNum}`;

            const str = (colIdx, val) => {
                const cLet = this._colLetter(colIdx);
                this._fillCell(doc, rowEl, addr(colIdx), val, false, row34Styles[cLet] || this._defaultStyle(colIdx, false));
            };

            // Template Row 33 Headers:
            // B: 5-digit Control Number (1)
            // C: Student Number (2)
            // D: TES Application Number (3)
            // E: Last Name (4)
            // F: Given Name (5)
            // G: Middle Initial (6)
            // H: Sex at Birth (M/F) (7)
            // I: Birthdate (mm/dd/yyyy) (8)
            // J: Degree Program (9)
            // K: Year Level (10)
            // L: Status (11)
            // M: Remarks (12)
            str(1, ctrl);                            // B: 5-digit Control Number
            str(2, studId !== '' ? studId : 'N/A');   // C: Student Number
            str(3, sa !== '' ? sa : 'N/A');          // D: TES Application Number
            str(4, lastName);                        // E: Last Name
            str(5, givenName);                       // F: Given Name
            str(6, middleInitial);                   // G: Middle Initial
            str(7, gender);                          // H: Sex at Birth (M/F)
            str(8, bdate);                           // I: Birthdate (mm/dd/yyyy)
            str(9, course);                          // J: Degree Program
            str(10, year);                           // K: Year Level
            str(11, status);                         // L: Status
            str(12, remarks);                        // M: Remarks
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    /**
     * Injects Form 1 statement values:
     * 1. TES Batch Number: Row 9 (B9) and Billing Reference No in Row 11 (U11)
     * 2. Date: Row 12 (U12)
     * 3. PHP Amount: Row 19 (W19) & summary breakdown in Rows 24-29 (U24-U29)
     * 4. Fiscal Year & Academic Year: Rows 17-19 (E17, E18, E19)
     */
    static _injectForm1Summary(xmlStr, form2Count, totalTesAmount, totalPwdAmount, totalAmount, mgmtFee, campusTotal, metadata = {}) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlStr, "application/xml");
        const sheetData = doc.getElementsByTagName("sheetData")[0];

        const setCell = (rowNum, addr, val, isNumeric, defaultStyle) => {
            let rowEl = Array.from(sheetData.childNodes).find(n => n.nodeName === 'row' && n.getAttribute('r') === String(rowNum));
            if (!rowEl) rowEl = this._getOrCreateRow(doc, sheetData, rowNum);
            this._fillCell(doc, rowEl, addr, val, isNumeric, defaultStyle);
        };

        // 1. TES Batch Number
        const rawBatch = String(metadata.batch || '1').trim();
        const cleanBatch = rawBatch.replace(/^batch\s*/i, '').trim() || '1';

        // Academic Year & Semester
        const academicYear = metadata.academicYear || '2024-2025';
        const semester = metadata.semester || '1st Semester';
        const ayMatch = academicYear.match(/\b(20\d\d)\b/);
        const ayStartYear = ayMatch ? parseInt(ayMatch[1], 10) : new Date().getFullYear();

        let termCode = '1';
        if (semester.toLowerCase().includes('2nd') || semester.includes('2')) {
            termCode = '2';
        } else if (semester.toLowerCase().includes('summer') || semester.toLowerCase().includes('midyear')) {
            termCode = '3';
        }

        // 4. Fiscal Year (applicable budget year under GAA)
        let fiscalYear = metadata.fiscalYear;
        if (!fiscalYear) {
            fiscalYear = (termCode === '2') ? String(ayStartYear + 1) : String(ayStartYear);
        }

        // 2. Date: Current formatted date
        const now = new Date();
        const formattedDate = metadata.date || now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // 3. PHP Amount: Formatted with currency prefix, commas, and two decimals
        const formattedPhpAmount = 'PhP ' + totalTesAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        // Billing Reference No: REGIONAL_CODE-HEI_CODE-AY-TERM-TRANCH:BATCH
        const regionalCode = metadata.regionalCode || '10';
        const heiCode = metadata.heiCode || 'USTP';
        const tranch = metadata.tranch || '1';
        const billingRefNo = `${regionalCode}-${heiCode}-${ayStartYear}-${termCode}-${tranch}:${cleanBatch}`;

        // Top Header Fields Automation:
        // Row 9 (B9:Y9): "TES Batch [Batch] - [Semester] and Academic Year [AY]"
        setCell(9, 'B9', `TES Batch ${cleanBatch} - ${semester} and Academic Year ${academicYear}`, false, '291');

        // Row 11 (U11): TES Billing Statement Reference No.
        setCell(11, 'U11', billingRefNo, false, '20');

        // Row 12 (U12:Y12): Date
        setCell(12, 'U12', formattedDate, false, '292');

        // Responsibility Center description with Term, AY, and Fiscal Year:
        // Row 17 (E17)
        setCell(17, 'E17', `Request for payment of the Tertiary Education Subsidy (TES) grant for ${semester},  `, false, '38');
        // Row 18 (E18)
        setCell(18, 'E18', `Academic Year ${academicYear} to be charged against the funds for Universal Access to Quality `, false, '38');
        // Row 19 (E19)
        setCell(19, 'E19', `Tertiary Education (UAQTE) under General Appropriation Act (GAA)  for Fiscal Year ${fiscalYear}, `, false, '38');

        // Row 19 (W19:Y19): PHP Amount Box under Amount Column
        setCell(19, 'W19', formattedPhpAmount, false, '297');

        // Breakdown Table (Rows 24-29)
        setCell(24, 'U24', form2Count, true, '270');
        setCell(25, 'U25', totalTesAmount, true, '272');
        setCell(26, 'U26', totalPwdAmount, true, '274');
        setCell(27, 'U27', totalAmount, true, '274');
        setCell(28, 'U28', mgmtFee, true, '274');
        setCell(29, 'U29', campusTotal, true, '274');

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
    }

    /**
     * Resolves the worksheet XML path in the zip for a given sheet name.
     */
    static async _resolveSheetPath(zip, sheetName, defaultPath) {
        try {
            const wbFile = zip.file('xl/workbook.xml');
            const relsFile = zip.file('xl/_rels/workbook.xml.rels');
            if (!wbFile || !relsFile) return defaultPath;

            const wbXml = await wbFile.async('string');
            const relsXml = await relsFile.async('string');

            const parser = new DOMParser();
            const wbDoc = parser.parseFromString(wbXml, 'application/xml');
            const relsDoc = parser.parseFromString(relsXml, 'application/xml');

            const sheets = Array.from(wbDoc.getElementsByTagName('sheet'));
            const targetSheet = sheets.find(s => (s.getAttribute('name') || '').trim().toLowerCase() === sheetName.trim().toLowerCase());
            if (!targetSheet) return defaultPath;

            const rId = targetSheet.getAttribute('r:id');
            if (!rId) return defaultPath;

            const rels = Array.from(relsDoc.getElementsByTagName('Relationship'));
            const rel = rels.find(r => r.getAttribute('Id') === rId);
            if (!rel) return defaultPath;

            let target = rel.getAttribute('Target') || '';
            if (target.startsWith('/')) target = target.slice(1);
            if (!target.startsWith('xl/')) target = 'xl/' + target;
            return target;
        } catch (e) {
            console.warn(`Could not resolve sheet path for "${sheetName}":`, e);
            return defaultPath;
        }
    }

    /**
     * Fills Consolidated Annex 5 (0_Annex_5_TES_New_Billing_Form.xlsx)
     * containing Form 1 (Statement), Form 2 (Grantees & Billing), and Form 3 (Not Included).
     */
    static async fillConsolidatedAnnex5(templateBytes, studentsForm2 = [], studentsForm3 = [], metadata = {}) {
        const zip = await JSZip.loadAsync(templateBytes);

        // 1. Resolve sheet XML paths
        const sheetPath1 = await this._resolveSheetPath(zip, 'Annex 5-TES New Form 1', 'xl/worksheets/sheet1.xml');
        const sheetPath2 = await this._resolveSheetPath(zip, 'Annex 5-TES New Form 2', 'xl/worksheets/sheet2.xml');
        const sheetPath3 = await this._resolveSheetPath(zip, 'Annex 5-TES New Form 3', 'xl/worksheets/sheet3.xml');

        // 2. Populate Form 2 (Enrolled Grantees & Billing)
        if (zip.file(sheetPath2)) {
            let sheet2Xml = await zip.file(sheetPath2).async("string");
            sheet2Xml = this._injectForm2Rows(sheet2Xml, studentsForm2, metadata);
            zip.file(sheetPath2, sheet2Xml);
        }

        // 3. Populate Form 3 (Not Included Students)
        if (zip.file(sheetPath3)) {
            let sheet3Xml = await zip.file(sheetPath3).async("string");
            sheet3Xml = this._injectForm3Rows(sheet3Xml, studentsForm3, metadata);
            zip.file(sheetPath3, sheet3Xml);
        }

        // 4. Calculate Billing Totals from Form 2
        const totalTesAmount = studentsForm2.length * 10000;
        const totalPwdAmount = 0;
        const totalAmount = totalTesAmount + totalPwdAmount;
        const mgmtFee = Math.round(totalAmount * 0.01);
        const campusTotal = totalAmount + mgmtFee;

        // 5. Populate Form 1 (Consolidated Summary Statement)
        if (zip.file(sheetPath1)) {
            let sheet1Xml = await zip.file(sheetPath1).async("string");
            sheet1Xml = this._injectForm1Summary(
                sheet1Xml,
                studentsForm2.length,
                totalTesAmount,
                totalPwdAmount,
                totalAmount,
                mgmtFee,
                campusTotal,
                metadata
            );
            zip.file(sheetPath1, sheet1Xml);
        }

        // 6. Generate compressed Excel (.xlsx) file
        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return {
            blob,
            form2Count: studentsForm2.length,
            form3Count: studentsForm3.length,
            totalAmount: campusTotal
        };
    }

    /**
     * Fills Annex 5 - Form 2 template (.xlsx)
     */
    static async fillAnnex5Form2(templateBytes, students, metadata = {}) {
        const zip = await JSZip.loadAsync(templateBytes);
        if (zip.file('xl/worksheets/sheet1.xml')) {
            let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async("string");
            sheet1Xml = this._injectForm2Rows(sheet1Xml, students, metadata);
            zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
        }
        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        return { blob, count: students.length };
    }

    /**
     * Fills Annex 5 - Form 3 template (.xlsx)
     */
    static async fillAnnex5Form3(templateBytes, students, metadata = {}) {
        const zip = await JSZip.loadAsync(templateBytes);
        if (zip.file('xl/worksheets/sheet1.xml')) {
            let sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async("string");
            sheet1Xml = this._injectForm3Rows(sheet1Xml, students, metadata);
            zip.file('xl/worksheets/sheet1.xml', sheet1Xml);
        }
        const blob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        return { blob, count: students.length };
    }

    /**
     * Legacy / Direct Annex 5 Template filler
     */
    static async fillAnnex5Template(templateBytes, students) {
        return this.fillAnnex5Form2(templateBytes, students);
    }
}
