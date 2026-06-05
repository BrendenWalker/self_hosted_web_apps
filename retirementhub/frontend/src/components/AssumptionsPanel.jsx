import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const INCLUDED = [
  'Federal income tax (ordinary brackets)',
  'Standard deduction',
  'RMDs (Uniform Lifetime Table)',
  'Social Security taxation (Pub. 915 tiers)',
  'Medicare Part B premiums',
  'Named scenarios with withdrawal strategy and Roth conversion modeling',
  'Side-by-side scenario comparison (lifetime tax, peak RMD, ending net worth)',
];

const EXCLUDED = [
  'State income tax',
  'NIIT',
  'AMT',
  'IRMAA surcharges',
  'Capital gains rates',
  'Tax credits',
  'Estate tax',
  'Tax lots / cost basis tracking',
  'Custom withdrawal bucket ordering (advanced)',
];

export default function AssumptionsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="card assumptions-panel">
      <button
        type="button"
        className="assumptions-panel-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Assumptions &amp; limitations
        <span className="assumptions-panel-chevron" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="assumptions-panel-body">
          <div className="assumptions-panel-columns">
            <div>
              <h3>Included</h3>
              <ul>
                {INCLUDED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Not included</h3>
              <ul>
                {EXCLUDED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="assumptions-panel-footer">
            Edit IRS values on the <Link to="/tax-details">Tax details</Link> page.
          </p>
        </div>
      )}
    </div>
  );
}
