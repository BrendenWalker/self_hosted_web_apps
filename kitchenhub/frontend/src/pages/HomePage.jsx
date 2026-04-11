import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-page page-scroll">
      <section className="home-hero">
        <h1>Welcome to KitchenHub</h1>
        <p className="home-subtitle">
          A simple hub to manage your pantry, build shopping lists, and keep store layouts in sync.
        </p>
        <div className="home-quick-links">
          <Link to="/shopping" className="home-card">
            <h2>Shopping List</h2>
            <p>
              Use your current list in-store, organized by store zones so the next item you need is always near the top.
            </p>
          </Link>
          <Link to="/list" className="home-card">
            <h2>Items</h2>
            <p>
              Browse and manage your full item catalog, adjust how much is on your list, and add new items.
            </p>
          </Link>
          <Link to="/recipes" className="home-card">
            <h2>Recipes</h2>
            <p>
              Browse recipes by category, view ingredients with quantities and optional notes, and see shopping measures for future list building.
            </p>
          </Link>
          <Link to="/stores" className="home-card">
            <h2>Stores & Layouts</h2>
            <p>
              Define stores, store zones, and which departments belong to each zone so shopping order matches the aisles.
            </p>
          </Link>
        </div>
      </section>

      <section className="home-details">
        <div className="home-detail-card">
          <h3>How it all fits together</h3>
          <p>
            Your items live in the master catalog on the <strong>Items</strong> page. When you are planning a trip,
            you add items from that catalog onto your list. On the <strong>Shopping List</strong> page, those items are
            grouped and ordered according to the zones you configure per store on the <strong>Stores &amp; Layouts</strong> page.
          </p>
        </div>
        <div className="home-detail-card">
          <h3>Next steps</h3>
          <ul>
            <li>Set up your primary store and its zones under <strong>Stores &amp; Layouts</strong>.</li>
            <li>Add your common items on the <strong>Items</strong> page.</li>
            <li>Head to <strong>Shopping List</strong> when you are in the store to walk the aisles in order.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default HomePage;

