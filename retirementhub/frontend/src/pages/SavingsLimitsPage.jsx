import React, { useState, useEffect } from 'react';
import { getSavingsLimits, getIncome } from '../api/api';
import {
  buildLimitKeys,
  capHsaHousehold,
  isMarriedFilingJointly,
} from '../utils/hsaContributions';

function filingStatusLabel(filingStatus) {
  switch (filingStatus) {
    case 'married_filing_jointly':
      return 'Married filing jointly';
    case 'married_filing_separately':
      return 'Married filing separately';
    case 'head_of_household':
      return 'Head of household';
    case 'single':
      return 'Single';
    default:
      return filingStatus?.replace(/_/g, ' ') || 'Unknown';
  }
}

function PartyLimitsTable({
  partyKey,
  displayName,
  yearsData,
  yearList,
  filingStatus,
  planned401k,
  plannedIra,
  plannedHsa,
  cappedHsa,
}) {
  if (!yearsData || yearList.length === 0) return null;

  const mfj = isMarriedFilingJointly(filingStatus);

  const getPartyForYear = (y) => {
    const data = yearsData[y];
    return partyKey === 'p1' ? data?.p1 : data?.p2;
  };

  const limitRows = buildLimitKeys(filingStatus);

  const hasPlannedColumn = planned401k != null || plannedIra != null || plannedHsa != null;

  const latestYear = yearList.length > 0 ? yearList[yearList.length - 1] : null;
  const latestParty = latestYear != null ? getPartyForYear(latestYear) : null;

  const renderPlannedCell = (limitKey, plannedRole) => {
    if (!hasPlannedColumn) return null;

    if (limitKey === '401k_elective_limit') {
      const limit = latestParty?.['401k_elective_limit'];
      const raw = planned401k;
      const display = limit != null && raw != null && raw > limit ? limit : raw;
      return renderAmountCell(display, raw, limit);
    }
    if (limitKey === 'ira_limit') {
      const limit = latestParty?.ira_limit;
      const raw = plannedIra;
      const display = limit != null && raw != null && raw > limit ? limit : raw;
      return renderAmountCell(display, raw, limit);
    }
    if (plannedRole === 'person') {
      const raw = plannedHsa;
      if (raw == null) return <td>—</td>;
      const display = cappedHsa?.[partyKey] ?? raw;
      const limit = mfj ? latestParty?.hsa_effective_limit : latestParty?.hsa_individual_limit;
      return renderAmountCell(display, raw, limit);
    }
    return <td>—</td>;
  };

  const renderAmountCell = (displayVal, rawVal, limit) => {
    if (displayVal == null) return <td>—</td>;
    const isCapped = rawVal != null && Math.abs(rawVal - displayVal) > 0.01;
    return (
      <td>
        ${displayVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        {isCapped && (
          <span className="over-limit" title={limit != null ? `Capped at IRS max ($${limit.toLocaleString('en-US')}) in projections` : 'Capped at IRS max in projections'}>
            {' '}
            (capped at max)
          </span>
        )}
      </td>
    );
  };

  return (
    <div className="card limits-party-card">
      <h3 className="limits-party-title">
        {displayName || partyKey.toUpperCase()}
      </h3>
      <p className="limits-age-note">
        {yearList.some((y) => getPartyForYear(y)?.age_at_eoy != null)
          ? `Age at end of year: ${yearList.map((y) => {
            const p = getPartyForYear(y);
            return p?.age_at_eoy != null ? `${y}: ${p.age_at_eoy}` : `${y}: —`;
          }).join(' · ')}`
          : 'Set birth year on Household to see age at EOY and catch-up eligibility.'}
      </p>
      <div className="table-responsive">
        <table className="limits-table">
          <thead>
            <tr>
              <th>Limit</th>
              {yearList.map((y) => (
                <th key={y}>{y}</th>
              ))}
              {hasPlannedColumn && <th>Your planned</th>}
            </tr>
          </thead>
          <tbody>
            {limitRows.map(({ key, label, plannedRole }) => (
              <tr key={key}>
                <td>{label}</td>
                {yearList.map((y) => {
                  const val = getPartyForYear(y)?.[key];
                  return (
                    <td key={y}>
                      {typeof val === 'number' ? `$${val.toLocaleString('en-US')}` : '—'}
                    </td>
                  );
                })}
                {key === '401k_elective_limit' && renderPlannedCell(key, plannedRole)}
                {key === 'ira_limit' && renderPlannedCell(key, plannedRole)}
                {(key === 'hsa_individual_limit' || key === 'hsa_effective_limit' || key === 'hsa_family_limit') &&
                  renderPlannedCell(key, plannedRole)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SavingsLimitsPage() {
  const [apiData, setApiData] = useState(null);
  const [income, setIncome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [limitsRes, incomeRes] = await Promise.all([
        getSavingsLimits(),
        getIncome().catch(() => ({ data: null })),
      ]);
      const data = limitsRes.data;
      if (data?.years) {
        setApiData({ household: data.household, years: data.years });
      } else if (data?.year != null && data?.p1 != null) {
        setApiData({
          household: data.household,
          years: { [data.year]: { p1: data.p1, p2: data.p2, base: data.limits } },
        });
      } else {
        setApiData(null);
      }
      setIncome(incomeRes.data || null);
      setMessage(null);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to load savings limits');
    } finally {
      setLoading(false);
    }
  };

  const filingStatus = apiData?.household?.filing_status || 'married_filing_jointly';
  const mfj = isMarriedFilingJointly(filingStatus);

  const planned401kP1 = income
    ? (parseFloat(income.gross_salary) || 0) * ((parseFloat(income.four_o_one_k_pct) || 0) + (parseFloat(income.four_o_one_k_match_pct) || 0)) / 100
    : null;
  const planned401kP2 = income
    ? (parseFloat(income.gross_salary_p2) || 0) * ((parseFloat(income.four_o_one_k_pct_p2) || 0) + (parseFloat(income.four_o_one_k_match_pct_p2) || 0)) / 100
    : null;
  const plannedIraP1 = income
    ? (parseFloat(income.ira_traditional_annual_p1) || 0) + (parseFloat(income.ira_roth_annual_p1) || 0)
    : null;
  const plannedIraP2 = income
    ? (parseFloat(income.ira_traditional_annual_p2) || 0) + (parseFloat(income.ira_roth_annual_p2) || 0)
    : null;
  const plannedHsaP1 = income ? parseFloat(income.hsa_annual_p1) || null : null;
  const plannedHsaP2 = income ? parseFloat(income.hsa_annual_p2) || null : null;
  const hasPlanned =
    (planned401kP1 != null && planned401kP1 > 0) ||
    (planned401kP2 != null && planned401kP2 > 0) ||
    (plannedIraP1 != null && plannedIraP1 > 0) ||
    (plannedIraP2 != null && plannedIraP2 > 0) ||
    (plannedHsaP1 != null && plannedHsaP1 > 0) ||
    (plannedHsaP2 != null && plannedHsaP2 > 0);

  const years = apiData?.years ? Object.keys(apiData.years).map(Number).sort((a, b) => a - b) : [];
  const latestYear = years.length > 0 ? years[years.length - 1] : null;
  const latestLimits = latestYear != null ? apiData?.years?.[latestYear] : null;

  let cappedHsa = null;
  if (latestLimits && (plannedHsaP1 != null || plannedHsaP2 != null)) {
    cappedHsa = capHsaHousehold(
      plannedHsaP1 ?? 0,
      plannedHsaP2 ?? 0,
      latestLimits.p1?.hsa_individual_limit ?? 0,
      latestLimits.p2?.hsa_individual_limit ?? 0,
      latestLimits.p1?.hsa_family_limit ?? latestLimits.p1?.hsa_effective_limit ?? 0,
      filingStatus
    );
  }

  if (loading && !apiData) {
    return <p className="loading-message">Loading savings limits…</p>;
  }

  return (
    <div className="page-scroll">
      <h1 className="page-title">Savings limits</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        IRS tax-leveraged contribution maximums by year, broken down by party. Catch-up amounts are included when that
        person is 50+ (IRA, 401k) or 55+ (HSA) at the end of each year. Set birth years on the Household page for
        age-based limits. Filing status ({filingStatusLabel(filingStatus)}) is from the Household page
        {mfj
          ? ' — MFJ households share one HSA family coverage cap across both spouses (shown on each party; combined contributions cannot exceed this amount).'
          : '.'}
      </p>
      {message && <div className="error-message">{message}</div>}

      {years.length === 0 ? (
        <div className="card">
          <p className="muted">No limit data available.</p>
        </div>
      ) : (
        <>
          <PartyLimitsTable
            partyKey="p1"
            displayName={apiData?.household?.p1_display_name ? `P1 (${apiData.household.p1_display_name})` : 'P1'}
            yearsData={years.length > 0 ? apiData.years : null}
            yearList={years}
            filingStatus={filingStatus}
            planned401k={planned401kP1 != null && planned401kP1 > 0 ? planned401kP1 : null}
            plannedIra={plannedIraP1 != null && plannedIraP1 > 0 ? plannedIraP1 : null}
            plannedHsa={plannedHsaP1 != null && plannedHsaP1 > 0 ? plannedHsaP1 : null}
            cappedHsa={cappedHsa}
          />
          <PartyLimitsTable
            partyKey="p2"
            displayName={apiData?.household?.p2_display_name ? `P2 (${apiData.household.p2_display_name})` : 'P2'}
            yearsData={years.length > 0 ? apiData.years : null}
            yearList={years}
            filingStatus={filingStatus}
            planned401k={planned401kP2 != null && planned401kP2 > 0 ? planned401kP2 : null}
            plannedIra={plannedIraP2 != null && plannedIraP2 > 0 ? plannedIraP2 : null}
            plannedHsa={plannedHsaP2 != null && plannedHsaP2 > 0 ? plannedHsaP2 : null}
            cappedHsa={cappedHsa}
          />
        </>
      )}

      {hasPlanned && (
        <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          Your planned amounts are from the Income page. 401(k) uses (contribution % + match %) × gross salary.
          IRA shows traditional + Roth combined (same IRS cap as projections).
          {mfj
            ? ' HSA shows each person\'s planned amount; if both spouses contribute, the combined total is capped at the family coverage limit (matching projections).'
            : ' HSA shows each person\'s planned annual amount capped at the individual limit.'}
        </p>
      )}
    </div>
  );
}
