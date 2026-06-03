/** IRS Uniform Lifetime Table (2022 revision, Pub. 590-B). */
const UNIFORM_LIFETIME_DIVISOR = {
  72: 26.6, 73: 25.5, 74: 24.6, 75: 23.6, 76: 22.7, 77: 21.8, 78: 20.9, 79: 20.0,
  80: 19.1, 81: 18.2, 82: 17.4, 83: 16.5, 84: 15.7, 85: 14.8, 86: 14.0, 87: 13.2,
  88: 12.4, 89: 11.7, 90: 11.1, 91: 10.5, 92: 9.9, 93: 9.4, 94: 8.9, 95: 8.4,
  96: 7.9, 97: 7.4, 98: 7.0, 99: 6.6, 100: 6.2, 101: 5.8, 102: 5.4, 103: 5.1,
  104: 4.8, 105: 4.5, 106: 4.2, 107: 4.0, 108: 3.7, 109: 3.5, 110: 3.3, 111: 3.1,
  112: 2.9, 113: 2.8, 114: 2.6, 115: 2.5, 116: 2.3, 117: 2.2, 118: 2.1, 119: 1.9, 120: 1.8,
};

const RMD_ACCOUNT_TYPES = new Set(['ira_traditional', '401k_traditional']);

function uniformLifetimeDivisor(age) {
  if (age == null || !Number.isInteger(age)) return null;
  if (age < 72) return null;
  if (age > 120) return UNIFORM_LIFETIME_DIVISOR[120];
  return UNIFORM_LIFETIME_DIVISOR[age] ?? null;
}

function rmdStartAgeFromBirthYear(birthYear) {
  if (birthYear == null || !Number.isInteger(birthYear)) return null;
  if (birthYear <= 1950) return 72;
  if (birthYear <= 1959) return 73;
  return 75;
}

function computeRmdForBalance(balance, age) {
  const div = uniformLifetimeDivisor(age);
  if (div == null || div <= 0 || balance <= 0) return { rmd: 0, divisor: null };
  const rmd = Math.min(balance, balance / div);
  return { rmd, divisor: div };
}

module.exports = {
  RMD_ACCOUNT_TYPES,
  UNIFORM_LIFETIME_DIVISOR,
  uniformLifetimeDivisor,
  rmdStartAgeFromBirthYear,
  computeRmdForBalance,
};
