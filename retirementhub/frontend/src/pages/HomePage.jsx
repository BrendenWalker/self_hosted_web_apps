import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page page-scroll">
      <section className="home-hero">
        <h1>RetirementHub</h1>
        <p className="home-subtitle">
          Plan retirement for P1 and P2: household profile, income and expenses, account balances, tax-aware scenarios, and long-range projections.
        </p>
        <div className="home-quick-links">
          <Link to="/household" className="home-card">
            <h2>Household</h2>
            <p>
              P1/P2 names, birth years, filing status, Social Security estimates, and projection horizon defaults.
            </p>
          </Link>
          <Link to="/income" className="home-card">
            <h2>Income</h2>
            <p>
              Salary, raises, bonus, and 401(k) contributions for each person while still working.
            </p>
          </Link>
          <Link to="/expenses" className="home-card">
            <h2>Expenses</h2>
            <p>
              Current and retirement spending by category, mortgage, and 25× annual targets.
            </p>
          </Link>
          <Link to="/accounts" className="home-card">
            <h2>Accounts</h2>
            <p>
              Savings, checking, HSA, IRA, 401(k), and taxable accounts with balance history over time.
            </p>
          </Link>
          <Link to="/savings-limits" className="home-card">
            <h2>Savings limits</h2>
            <p>
              IRS contribution limits by year for 401(k), IRA, and HSA — per person and combined household view.
            </p>
          </Link>
          <Link to="/saving-projections" className="home-card">
            <h2>Saving projections</h2>
            <p>
              Project savings growth from today until retirement using income, expenses, 401(k), and account balances.
            </p>
          </Link>
          <Link to="/tax-details" className="home-card">
            <h2>Tax details</h2>
            <p>
              Edit federal brackets, standard deductions, and Medicare Part B for published and future years.
            </p>
          </Link>
          <Link to="/scenarios" className="home-card">
            <h2>Scenarios</h2>
            <p>
              Model retirement ages, Social Security claiming, spending, withdrawal order, and Roth conversions. Compare side by side.
            </p>
          </Link>
          <Link to="/projections" className="home-card">
            <h2>Projections</h2>
            <p>
              Net worth, income vs expenses, federal tax estimates, spending sources, and planning insights for the active scenario.
            </p>
          </Link>
        </div>
      </section>
      <section className="home-details">
        <div className="home-detail-card">
          <h3>Getting started</h3>
          <ol className="home-usage-steps">
            <li>
              <strong>Set up your household</strong> — names, birth years, and filing status drive ages and tax treatment in every projection year.
            </li>
            <li>
              <strong>Enter income and expenses</strong> — working-year wages and retirement spending targets, including mortgage and category-level detail.
            </li>
            <li>
              <strong>Track accounts</strong> — add each account and record balances over time so projections start from real numbers.
            </li>
            <li>
              <strong>Build a scenario</strong> — choose retirement timing, Social Security claiming ages, growth assumptions, withdrawal strategy, and optional Roth conversions.
            </li>
            <li>
              <strong>Review projections</strong> — pick a scenario on the Projections page to see charts, year-by-year tables, and tax estimates. Compare scenarios to stress-test your plan.
            </li>
          </ol>
          <p className="home-usage-note">
            Optional: adjust <Link to="/tax-details">tax parameters</Link> for years beyond published IRS tables, or use <Link to="/import">Import</Link> to load data from a spreadsheet.
          </p>
        </div>
      </section>
    </div>
  );
}
