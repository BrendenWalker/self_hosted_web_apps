function yearFromDate(value) {
  if (value == null) return null;
  if (typeof value.getFullYear === 'function') return value.getFullYear();
  const s = String(value).trim();
  const fourDigit = s.match(/^(\d{4})/);
  if (fourDigit) return parseInt(fourDigit[1], 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.getFullYear();
  return null;
}

function ageAtEoy(birthYear, year) {
  if (birthYear == null || !Number.isInteger(birthYear)) return null;
  return year - birthYear;
}

module.exports = { yearFromDate, ageAtEoy };
