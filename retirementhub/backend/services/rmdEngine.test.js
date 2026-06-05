'use strict';

const {
  rmdStartAge,
  rmdStartAgeFromBirthYear,
  uniformLifetimeDivisor,
  rmdForAccount,
  computeRmdForBalance,
} = require('./rmdEngine');

describe('rmdStartAge', () => {
  test('birth year 1949 → RMD age 72', () => expect(rmdStartAge(1949)).toBe(72));
  test('birth year 1955 → RMD age 73', () => expect(rmdStartAge(1955)).toBe(73));
  test('birth year 1965 → RMD age 75', () => expect(rmdStartAge(1965)).toBe(75));
  test('invalid birth year → null', () => expect(rmdStartAge(null)).toBeNull());
  test('rmdStartAgeFromBirthYear alias', () => expect(rmdStartAgeFromBirthYear(1955)).toBe(73));
});

describe('uniformLifetimeDivisor', () => {
  test('divisor at 73 is 25.5 (Pub 590-B 2022 table)', () => {
    expect(uniformLifetimeDivisor(73)).toBeCloseTo(25.5, 1);
  });

  test('divisor below RMD start age returns null', () => {
    expect(uniformLifetimeDivisor(71)).toBeNull();
  });

  test('age above 120 uses age-120 divisor', () => {
    expect(uniformLifetimeDivisor(125)).toBe(1.8);
  });

  test('non-integer age returns null', () => {
    expect(uniformLifetimeDivisor(73.5)).toBeNull();
  });
});

describe('rmdForAccount', () => {
  test('rmdForAccount(100000, age 73) → 100000 / 25.5', () => {
    expect(rmdForAccount(100000, 73)).toBeCloseTo(100000 / 25.5, 2);
  });

  test('rmdForAccount below start age → 0', () => {
    expect(rmdForAccount(100000, 65)).toBe(0);
  });

  test('zero balance → 0', () => {
    expect(rmdForAccount(0, 73)).toBe(0);
  });
});

describe('computeRmdForBalance', () => {
  test('returns rmd and divisor at eligible age', () => {
    const r = computeRmdForBalance(100000, 73);
    expect(r.divisor).toBe(25.5);
    expect(r.rmd).toBeCloseTo(100000 / 25.5, 2);
  });

  test('below start age → zero rmd', () => {
    expect(computeRmdForBalance(100000, 65)).toEqual({ rmd: 0, divisor: null });
  });
});
