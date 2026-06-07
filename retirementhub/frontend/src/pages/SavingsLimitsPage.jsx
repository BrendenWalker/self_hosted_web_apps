import React, { useState, useEffect } from 'react';
import { getSavingsLimits, getIncome } from '../api/api';

const LIMIT_KEYS = [
  { key: 'ira_limit', label: 'IRA (traditional + Roth combined)' },
  { key: '401k_elective_limit', label: '401(k) elective deferral (incl. catch-up if 50+ at EOY)' },
  { key: 'hsa_individual_limit', label: 'HSA individual (incl. catch-up if 55+ at EOY)' },
  { key: 'hsa_family_limit', label: 'HSA family (incl. catch-up if 55+ at EOY, household — P1 only)' },
];

function PartyLimitsTable({ partyKey, displayName, yearsData, yearList, planned401k, plannedIra, plannedHsa }) {
  if (!yearsData || yearList.length === 0) return null;

  const getPartyForYear = (y) => {
    const data = yearsData[y];
    return partyKey === 'p1' ? data?.p1 : data?.p2;
  };

  const limitRows = LIMIT_KEYS.filter(({ key }) => {
    if (key === 'hsa_family_limit' && partyKey === 'p2') return false;
    return true;
  });

  const hasPlannedColumn = planned401k != null || plannedIra != null || plannedHsa != null;

  const renderPlannedCell = (key, plannedVal) => {
    if (!hasPlannedColumn) return null;
    if (plannedVal == null) return <td>—</td>;
    if (yearList.length === 0) {
      return (
        <td>
          ${plannedVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </td>
      );
    }
    const limit = getPartyForYear(yearList[yearList.length - 1])?.[key];
    const displayVal = limit != null && plannedVal > limit ? limit : plannedVal;
    const isCapped = limit != null && plannedVal > limit;
    return (
      <td>
        ${displayVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        {isCapped && (
          <span className="over-limit" title="Capped at IRS max in projections">
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
            {limitRows.map(({ key, label }) => (
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
                {key === '401k_elective_limit' && renderPlannedCell(key, planned401k)}
                {key === 'ira_limit' && renderPlannedCell(key, plannedIra)}
                {key === 'hsa_individual_limit' && renderPlannedCell(key, plannedHsa)}
                {key === 'hsa_family_limit' && hasPlannedColumn && <td>—</td>}
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

  if (loading && !apiData) {
    return <p className="loading-message">Loading savings limits…</p>;
  }

  const years = apiData?.years ? Object.keys(apiData.years).map(Number).sort((a, b) => a - b) : [];

  return (
    <div className="page-scroll">
      <h1 className="page-title">Savings limits</h1>
      <p style={{ marginBottom: '1rem', color: '#5a6b64', fontSize: '0.95rem' }}>
        IRS tax-leveraged contribution maximums by year, broken down by party. Catch-up amounts are included when that person is 50+ (IRA, 401k) or 55+ (HSA) at the end of each year. Set birth years on the Household page for age-based limits.
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
            planned401k={planned401kP1 != null && planned401kP1 > 0 ? planned401kP1 : null}
            plannedIra={plannedIraP1 != null && plannedIraP1 > 0 ? plannedIraP1 : null}
            plannedHsa={plannedHsaP1 != null && plannedHsaP1 > 0 ? plannedHsaP1 : null}
          />
          <PartyLimitsTable
            partyKey="p2"
            displayName={apiData?.household?.p2_display_name ? `P2 (${apiData.household.p2_display_name})` : 'P2'}
            yearsData={years.length > 0 ? apiData.years : null}
            yearList={years}
            planned401k={planned401kP2 != null && planned401kP2 > 0 ? planned401kP2 : null}
            plannedIra={plannedIraP2 != null && plannedIraP2 > 0 ? plannedIraP2 : null}
            plannedHsa={plannedHsaP2 != null && plannedHsaP2 > 0 ? plannedHsaP2 : null}
          />
        </>
      )}

      {hasPlanned && (
        <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
          Your planned amounts are from the Income page. 401(k) uses (contribution % + match %) × gross salary.
          IRA shows traditional + Roth combined (same IRS cap as projections). HSA shows each person&apos;s planned
          annual amount; projections also cap total household HSA at the family limit.
        </p>
      )}
    </div>
  );
}
