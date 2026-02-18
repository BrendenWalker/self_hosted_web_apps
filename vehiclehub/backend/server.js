const express = require('express');
const cors = require('cors');
const { createDbPool, testConnection } = require('../../common/database/db-config');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 80;

// App readiness state
let isReady = false;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = createDbPool({
  database: process.env.DB_NAME || 'vehiclehub',
});

// Test database connection (non-blocking, doesn't affect readiness)
testConnection(pool);

// ==================== VEHICLES ====================

// Get all vehicles
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicle ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Get single vehicle
app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicle WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Create vehicle
app.post('/api/vehicles', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO vehicle (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Vehicle with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  }
});

// Update vehicle
app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE vehicle SET name = $1, modified = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Vehicle with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update vehicle' });
    }
  }
});

// Delete vehicle
app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM vehicle WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// ==================== SERVICE TYPES ====================

// Get all service types
app.get('/api/service-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM servicetype ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

// Get single service type
app.get('/api/service-types/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM servicetype WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service type not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching service type:', error);
    res.status(500).json({ error: 'Failed to fetch service type' });
  }
});

// Create service type
app.post('/api/service-types', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO servicetype (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service type:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Service type with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create service type' });
    }
  }
});

// Update service type
app.put('/api/service-types/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'UPDATE servicetype SET name = $1, modified = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service type not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service type:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Service type with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update service type' });
    }
  }
});

// Delete service type
app.delete('/api/service-types/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM servicetype WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service type not found' });
    }
    res.json({ message: 'Service type deleted successfully' });
  } catch (error) {
    console.error('Error deleting service type:', error);
    res.status(500).json({ error: 'Failed to delete service type' });
  }
});

// ==================== SERVICE INTERVALS ====================

// Get service intervals for a vehicle
app.get('/api/vehicles/:vehicleId/service-intervals', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.*, st.name as service_name
       FROM service_intervals si
       JOIN servicetype st ON si.serviceid = st.id
       WHERE si.vehicleid = $1
       ORDER BY st.name`,
      [req.params.vehicleId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service intervals:', error);
    res.status(500).json({ error: 'Failed to fetch service intervals' });
  }
});

// Create or update service interval
app.post('/api/vehicles/:vehicleId/service-intervals', async (req, res) => {
  try {
    const { serviceid, months, miles, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO service_intervals (vehicleid, serviceid, months, miles, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (vehicleid, serviceid)
       DO UPDATE SET months = $3, miles = $4, notes = $5, modified = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.vehicleId, serviceid, months || null, miles || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service interval:', error);
    res.status(500).json({ error: 'Failed to create service interval' });
  }
});

// Update service interval
app.put('/api/vehicles/:vehicleId/service-intervals/:serviceId', async (req, res) => {
  try {
    const { months, miles, notes, nextdate, nextmiles } = req.body;
    const result = await pool.query(
      `UPDATE service_intervals
       SET months = $1, miles = $2, notes = $3, nextdate = $4, nextmiles = $5, modified = CURRENT_TIMESTAMP
       WHERE vehicleid = $6 AND serviceid = $7
       RETURNING *`,
      [months || null, miles || null, notes || null, nextdate || null, nextmiles || null, req.params.vehicleId, req.params.serviceId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service interval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service interval:', error);
    res.status(500).json({ error: 'Failed to update service interval' });
  }
});

// Delete service interval
app.delete('/api/vehicles/:vehicleId/service-intervals/:serviceId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM service_intervals WHERE vehicleid = $1 AND serviceid = $2 RETURNING *',
      [req.params.vehicleId, req.params.serviceId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service interval not found' });
    }
    res.json({ message: 'Service interval deleted successfully' });
  } catch (error) {
    console.error('Error deleting service interval:', error);
    res.status(500).json({ error: 'Failed to delete service interval' });
  }
});

// ==================== SERVICE LOG ====================

// Get service log entries for a vehicle
app.get('/api/vehicles/:vehicleId/service-log', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sl.*, st.name as service_name
       FROM service_log sl
       JOIN servicetype st ON sl.serviceid = st.id
       WHERE sl.vehicleid = $1
       ORDER BY sl.servicedate DESC, sl.servicemiles DESC`,
      [req.params.vehicleId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service log:', error);
    res.status(500).json({ error: 'Failed to fetch service log' });
  }
});

// Get all service log entries (across all vehicles)
app.get('/api/service-log', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sl.*, st.name as service_name, v.name as vehicle_name
       FROM service_log sl
       JOIN servicetype st ON sl.serviceid = st.id
       JOIN vehicle v ON sl.vehicleid = v.id
       ORDER BY sl.servicedate DESC, sl.servicemiles DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching service log:', error);
    res.status(500).json({ error: 'Failed to fetch service log' });
  }
});

// Get single service log entry
app.get('/api/service-log/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sl.*, st.name as service_name, v.name as vehicle_name
       FROM service_log sl
       JOIN servicetype st ON sl.serviceid = st.id
       JOIN vehicle v ON sl.vehicleid = v.id
       WHERE sl.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service log entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching service log entry:', error);
    res.status(500).json({ error: 'Failed to fetch service log entry' });
  }
});

// Create service log entry
app.post('/api/service-log', async (req, res) => {
  try {
    const { vehicleid, serviceid, servicedate, servicemiles, notes, qty } = req.body;
    const result = await pool.query(
      `INSERT INTO service_log (vehicleid, serviceid, servicedate, servicemiles, notes, qty)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [vehicleid, serviceid, servicedate, servicemiles || null, notes || null, qty || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating service log entry:', error);
    res.status(500).json({ error: 'Failed to create service log entry' });
  }
});

// Update service log entry
app.put('/api/service-log/:id', async (req, res) => {
  try {
    const { servicedate, servicemiles, notes, qty } = req.body;
    const result = await pool.query(
      `UPDATE service_log
       SET servicedate = $1, servicemiles = $2, notes = $3, qty = $4, modified = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [servicedate, servicemiles || null, notes || null, qty || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service log entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating service log entry:', error);
    res.status(500).json({ error: 'Failed to update service log entry' });
  }
});

// Delete service log entry
app.delete('/api/service-log/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM service_log WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service log entry not found' });
    }
    res.json({ message: 'Service log entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting service log entry:', error);
    res.status(500).json({ error: 'Failed to delete service log entry' });
  }
});

// ==================== DASHBOARD/SUMMARY ====================

// Get upcoming services (services due soon)
app.get('/api/upcoming-services', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));
    
    const result = await pool.query(
      `SELECT si.*, st.name as service_name, v.name as vehicle_name, v.id as vehicle_id
       FROM service_intervals si
       JOIN servicetype st ON si.serviceid = st.id
       JOIN vehicle v ON si.vehicleid = v.id
       WHERE si.nextdate IS NOT NULL AND si.nextdate <= $1
       ORDER BY si.nextdate ASC, si.nextmiles ASC`,
      [futureDate.toISOString().split('T')[0]]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching upcoming services:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming services' });
  }
});

// Health check endpoint (does not hit database)
app.get('/api/health', (req, res) => {
  if (isReady) {
    res.status(200).json({ 
      status: 'ready', 
      timestamp: new Date().toISOString() 
    });
  } else {
    res.status(503).json({ 
      status: 'not ready', 
      timestamp: new Date().toISOString() 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  // Mark app as ready once server is listening
  isReady = true;
});
