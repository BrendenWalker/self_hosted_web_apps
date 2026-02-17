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
            <h2>Shopping</h2>
            <p>
              Use your current list in-store, organized by store zones so the next item you need is always near the top.
            </p>
          </Link>
          <Link to="/list" className="home-card">
            <h2>Modify List</h2>
            <p>
              Add and manage items in your master list, then push items onto the active shopping list with quantities.
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
            Your items live in the master list on the <strong>Modify List</strong> page. When you are planning a trip,
            you add items from that list into the shopping list. On the <strong>Shopping</strong> page, those items are
            grouped and ordered according to the zones you configure per store on the <strong>Stores &amp; Layouts</strong> page.
          </p>
        </div>
        <div className="home-detail-card">
          <h3>Next steps</h3>
          <ul>
            <li>Set up your primary store and its zones under <strong>Stores &amp; Layouts</strong>.</li>
            <li>Add your common items on the <strong>Modify List</strong> page.</li>
            <li>Head to <strong>Shopping</strong> when you are in the store to walk the aisles in order.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default HomePage;

