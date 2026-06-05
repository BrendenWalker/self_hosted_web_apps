const {
  UNIFORM_LIFETIME_DIVISOR,
  uniformLifetimeDivisor,
  rmdStartAgeFromBirthYear,
  computeRmdForBalance,
} = require('../services/rmdEngine');

const RMD_ACCOUNT_TYPES = new Set(['ira_traditional', '401k_traditional']);

module.exports = {
  RMD_ACCOUNT_TYPES,
  UNIFORM_LIFETIME_DIVISOR,
  uniformLifetimeDivisor,
  rmdStartAgeFromBirthYear,
  computeRmdForBalance,
};
