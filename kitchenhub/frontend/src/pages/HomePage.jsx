import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <h1>Welcome to KitchenHub</h1>
        <p className="home-subtitle">
          A simple hub to manage your pantry, build shopping lists, and keep store layouts in sync.
        </p>
        <div className="home-quick-links">
          <Link to="/shopping" className="home-card">
            <h2>In-Store Shopping</h2>
            <p>
              Use your current shopping list in-store, organized by store zones so the next item you need is always near the top.
            </p>
          </Link>
          <Link to="/list" className="home-card">
            <h2>Shopping List &amp; Items</h2>
            <p>
              View your shopping list and manage the full catalog of items, adjusting quantities and adding new items as needed.
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
            Your items live in the master list on the <strong>Shopping List &amp; Items</strong> page. When you are planning a trip,
            you add items from that list into the shopping list. On the <strong>In-Store Shopping</strong> page, those items are
            grouped and ordered according to the zones you configure per store on the <strong>Stores &amp; Layouts</strong> page.
          </p>
        </div>
        <div className="home-detail-card">
          <h3>Next steps</h3>
          <ul>
            <li>Set up your primary store and its zones under <strong>Stores &amp; Layouts</strong>.</li>
            <li>Add your common items on the <strong>Shopping List &amp; Items</strong> page.</li>
            <li>Head to <strong>In-Store Shopping</strong> when you are in the store to walk the aisles in order.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default HomePage;

