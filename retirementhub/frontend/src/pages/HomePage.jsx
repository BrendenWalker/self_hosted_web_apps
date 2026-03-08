import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page page-scroll">
      <section className="home-hero">
        <h1>RetirementHub</h1>
        <p className="home-subtitle">
          Budget and plan for retirement with P1 and P2: household, income, expenses, and savings targets.
        </p>
        <div className="home-quick-links">
          <Link to="/household" className="home-card">
            <h2>Household</h2>
            <p>
              Set P1 and P2 display names, birth years, and tax filing status. Used for ages and future projections.
            </p>
          </Link>
          <Link to="/income" className="home-card">
            <h2>Income</h2>
            <p>
              Gross salary, expected raise %, bonus, and 401(k) contribution for budget context.
            </p>
          </Link>
          <Link to="/accounts" className="home-card">
            <h2>Accounts</h2>
            <p>
              Add any number of accounts: savings, checking, HSA, IRA (traditional/Roth), 401(k) (traditional/Roth), taxable. Your names; balances in Stage 3.
            </p>
          </Link>
          <Link to="/expenses" className="home-card">
            <h2>Expenses</h2>
            <p>
              Current and retirement expenses by category, mortgage, and 25× annual targets.
            </p>
          </Link>
          <Link to="/projections" className="home-card">
            <h2>Projections</h2>
            <p>
              Net worth over time and income vs expenses by year. Charts and 25× target.
            </p>
          </Link>
        </div>
      </section>
      <section className="home-details">
        <div className="home-detail-card">
          <h3>Stage 1 — Budget</h3>
          <p>
            This release focuses on the <strong>budget</strong>: household (P1/P2), income inputs, and expense categories with current vs retirement amounts and mortgage. Stage 2 adds tax-leveraged limits, Stage 3 savings tracking, Stage 4 projections and charts.
          </p>
        </div>
      </section>
    </div>
  );
}
