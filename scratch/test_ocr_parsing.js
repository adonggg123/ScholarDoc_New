const rawOcrText = `
USTP
OROQUIETA
1* Semester A.Y. 2026 - 2027
_alpedh
RIZALYN P. ALPANTE, LPI
Campus Registrar - Designate
VALIDO
`;

function extractYear(text) {
  const ayRegex = /(?:(?:A\.?\s*Y\.?|S\.?\s*Y\.?|Academic\s*Year|School\s*Year)\s*[:\.]?\s*)?(20\d{2})\s*[\u2013\u2014\u2212\-/]\s*(20\d{2}|\d{2})/i;
  const match = text.match(ayRegex);
  if (match) {
    let start = match[1];
    let end = match[2];
    if (end.length === 2) end = start.substring(0, 2) + end;
    return `${start}-${end}`;
  }
  return null;
}

function extractSemester(text) {
  const lower = text.toLowerCase();
  if (/\b(?:1[\*stST]{1,2}|1st|first|1)\s*(?:sem(?:ester)?)?\b/i.test(lower) || /\bsem(?:ester)?\s*1\b/i.test(lower)) {
    return '1st Semester';
  }
  if (/\b(?:2[\*ndND]{1,2}|2nd|second|2)\s*(?:sem(?:ester)?)?\b/i.test(lower) || /\bsem(?:ester)?\s*2\b/i.test(lower)) {
    return '2nd Semester';
  }
  if (/\b(?:mid-?year|summer)\b/i.test(lower)) {
    return 'Summer / Midyear';
  }
  return null;
}

console.log('Extracted Year:', extractYear(rawOcrText));
console.log('Extracted Sem:', extractSemester(rawOcrText));
