export function isMarriedFilingJointly(filingStatus) {
  return filingStatus === 'married_filing_jointly';
}

/** Mirror backend capHsaHousehold — caps planned HSA by filing status and household total. */
export function capHsaHousehold(hsaP1, hsaP2, p1IndLimit, p2IndLimit, familyLimit, filingStatus) {
  const mfj = isMarriedFilingJointly(filingStatus);
  const p1Cap =
    mfj && familyLimit > 0
      ? familyLimit
      : p1IndLimit > 0
        ? p1IndLimit
        : Math.max(0, hsaP1 || 0);
  const p2Cap =
    mfj && familyLimit > 0
      ? familyLimit
      : p2IndLimit > 0
        ? p2IndLimit
        : Math.max(0, hsaP2 || 0);
  let p1 = Math.min(Math.max(0, hsaP1 || 0), p1Cap);
  let p2 = Math.min(Math.max(0, hsaP2 || 0), p2Cap);
  const total = p1 + p2;
  if (mfj && familyLimit != null && familyLimit > 0 && total > familyLimit) {
    if (total <= 0) return { p1: 0, p2: 0 };
    const ratio = familyLimit / total;
    p1 = Math.round(p1 * ratio * 100) / 100;
    p2 = Math.round((familyLimit - p1) * 100) / 100;
  }
  return { p1, p2 };
}

export function buildLimitKeys(filingStatus) {
  const mfj = isMarriedFilingJointly(filingStatus);
  const keys = [
    { key: 'ira_limit', label: 'IRA (traditional + Roth combined)' },
    { key: '401k_elective_limit', label: '401(k) elective deferral (incl. catch-up if 50+ at EOY)' },
  ];
  if (mfj) {
    keys.push({
      key: 'hsa_effective_limit',
      label: 'HSA family coverage (MFJ cap per person)',
      plannedRole: 'person',
    });
    keys.push({
      key: 'hsa_family_limit',
      label: 'HSA household total (MFJ combined cap)',
      plannedRole: 'household',
      p1Only: true,
    });
  } else {
    keys.push({
      key: 'hsa_individual_limit',
      label: 'HSA individual (incl. catch-up if 55+ at EOY)',
      plannedRole: 'person',
    });
  }
  return keys;
}
