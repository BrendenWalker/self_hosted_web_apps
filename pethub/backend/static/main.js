/* Utilities */
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

/* Default pet handling (localStorage) */
const DEFAULT_PET_KEY = 'default_pet_id';
function loadDefaultPet() { return localStorage.getItem(DEFAULT_PET_KEY) || '1'; }
function saveDefaultPet(id) { if (id === null || id === undefined) id = ''; localStorage.setItem(DEFAULT_PET_KEY, String(id)); }

/* Offline activity queue */
const OFFLINE_QUEUE_KEY = 'pending_activities_v1';
const OFFLINE_SAVE_TIMEOUT_MS = 1500;

function loadActivityQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch (e) {
    console.error('Error loading offline queue', e);
    return [];
  }
}

function saveActivityQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error saving offline queue', e);
  }
}

function queueOfflineActivity(payload) {
  const queue = loadActivityQueue();
  const entry = {
    id: self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : String(Date.now()) + ':' + Math.random().toString(16).slice(2),
    payload,
    createdAt: new Date().toISOString()
  };
  queue.push(entry);
  saveActivityQueue(queue);
  updateOfflineStatus();
  return queue.length;
}

async function syncPendingActivities() {
  if (!navigator.onLine) return;
  let queue = loadActivityQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const resp = await fetch('/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (!resp.ok) {
        // Keep item in queue to retry later
        remaining.push(item);
      } else {
        const data = await resp.json().catch(() => null);
        if (!data || !data.ok) {
          remaining.push(item);
        }
      }
    } catch (e) {
      remaining.push(item);
    }
  }

  saveActivityQueue(remaining);
  updateOfflineStatus();

  // If anything was synced, refresh UI bits that depend on activities
  if (remaining.length !== queue.length) {
    if (document.querySelector('#activity-table')) {
      await refreshTable();
    }
    if (document.querySelector('#dailyCounts') || document.querySelector('#pottyHoldTimePoop') || document.querySelector('#pottyHoldTimePee') || document.querySelector('#pottyLocation')) {
      await refreshCharts();
    }
    await refreshHomeSummaries();
    if (document.querySelector('#speedometer-poop') || document.querySelector('#speedometer-pee')) {
      await refreshSpeedometers();
    }
  }
}

function getOfflineQueueCount() {
  return loadActivityQueue().length;
}

function updateOfflineStatus() {
  const el = document.getElementById('offline-status');
  if (!el) return;
  const count = getOfflineQueueCount();
  if (count > 0) {
    el.textContent = `${count} activity${count === 1 ? '' : 'ies'} waiting to sync`;
    el.classList.add('has-pending');
  } else {
    el.textContent = '';
    el.classList.remove('has-pending');
  }
}

function initOfflineNavigationGuards() {
  // Update status immediately
  updateOfflineStatus();

  // Keep header indicator in sync with online/offline events
  window.addEventListener('online', () => {
    updateOfflineStatus();
  });
  window.addEventListener('offline', () => {
    updateOfflineStatus();
  });

  // Intercept link clicks while offline to avoid ugly browser error pages
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    // Ignore in-page anchors and non-http links
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (!navigator.onLine) {
      e.preventDefault();
      const pending = getOfflineQueueCount();
      const extra = pending > 0 ? ` You have ${pending} pending activit${pending === 1 ? 'y' : 'ies'} that will sync when you reconnect.` : '';
      alert('You appear to be offline. Navigation is disabled to avoid loading error pages.' + extra);
    }
  }, true);

  // Intercept form submits while offline
  document.addEventListener('submit', (e) => {
    if (!navigator.onLine) {
      e.preventDefault();
      const pending = getOfflineQueueCount();
      const extra = pending > 0 ? ` You have ${pending} pending activit${pending === 1 ? 'y' : 'ies'} queued.` : '';
      alert('You appear to be offline. Form submissions are disabled until you are back online.' + extra);
    }
  }, true);

  // Warn on page unload if offline and there are pending items
  window.addEventListener('beforeunload', (e) => {
    if (!navigator.onLine && getOfflineQueueCount() > 0) {
      e.preventDefault();
      // Setting returnValue triggers a confirmation dialog in most browsers
      e.returnValue = '';
    }
  });
}

function fmtHM(d){ 
  const pad=n=>String(n).padStart(2,'0'); 
  hours = d.getHours();
  ampm = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }
  minutes = d.getMinutes();
  return pad(hours)+':'+pad(minutes)+' '+ampm; 
}

function ageLabelFromBirthdate(birthStr){
  if (!birthStr) return '';
  const birth = new Date(birthStr);
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  const ms = now - birth;
  const days = Math.floor(ms / (1000*60*60*24));
  const weeksExact = days / 7;
  if (weeksExact < 26) {
    const whole = Math.floor(weeksExact);
    const plus = (weeksExact - whole) > 0 ? '+' : '';
    return `${whole}${plus} wk${whole===1 && !plus?'':'s'}`;
  }
  // months approximate by 30.4375
  const months = Math.floor(days / 30.4375);
  return `${months} mo${months===1?'':'s'}`;
}

/* Initialize default pet selector on home */
function initDefaultPetSelector() {
  const sel = $('#default_pet');
  if (!sel) return;
  const current = loadDefaultPet();
  if (current) sel.value = current;
  const updateAgeAndSummaries = async () => {
    const opt = sel.selectedOptions && sel.selectedOptions[0];
    const b = opt ? opt.getAttribute('data-birthdate') : '';
    const ageEl = $('#default_pet_age');
    if (ageEl) ageEl.textContent = ageLabelFromBirthdate(b);
    await refreshHomeSummaries();
  };
  sel.addEventListener('change', async () => {
    saveDefaultPet(sel.value);
    const picker = $('#pet_picker');
    if (picker && !picker.value) picker.value = sel.value;
    await updateAgeAndSummaries();
    // Refresh speedometers when default pet changes
    if ($('#speedometer-poop') || $('#speedometer-pee')) {
      refreshSpeedometers();
    }
  });
  // initial
  updateAgeAndSummaries();
}

async function refreshHomeSummaries(){
  // Don't refresh if wizard is open (user might be entering data)
  if ($('#wizard') && !$('#wizard').classList.contains('hidden')) return;
  
  const peeEl = $('#recent_pee'); const poopEl = $('#recent_poop'); const waterEl = $('#recent_water'); const foodEl = $('#recent_food');
  if (!(peeEl && poopEl && waterEl && foodEl)) return;
  const petId = $('#default_pet')?.value || loadDefaultPet() || '';
  if (!petId) { peeEl.textContent = poopEl.textContent = waterEl.textContent = foodEl.textContent = '—'; return; }
  try {
    const resp = await fetch('/api/latest_by_type?pet_id='+encodeURIComponent(petId));
    const data = await resp.json();
    if (!data.ok) { peeEl.textContent = poopEl.textContent = waterEl.textContent = foodEl.textContent = '—'; return; }
    const latest = data.latest || {};
    const formatLatest = (iso) => {
      if (!iso) return '—';
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return '—';
      const now = new Date();
      const label = dt.toDateString() === now.toDateString() ? 'Today' : dt.toLocaleDateString();
      return `${label} ${fmtHM(dt)}`;
    };
    peeEl.textContent = formatLatest(latest.pee && latest.pee.created_at);
    poopEl.textContent = formatLatest(latest.poop && latest.poop.created_at);
    waterEl.textContent = formatLatest(latest.water && latest.water.created_at);
    foodEl.textContent = formatLatest(latest.food && latest.food.created_at);
  } catch(e){
    peeEl.textContent = poopEl.textContent = waterEl.textContent = foodEl.textContent = '—';
  }
}

/* Filters & charts */
/** Align potty hold series to labels: supports legacy `poop`/`pee` as number[] or `{ trend, min, max }`. */
function normalizeHoldSeries(raw, daysLen) {
  let trend = [];
  let min = [];
  let max = [];
  if (Array.isArray(raw)) {
    trend = raw;
  } else if (raw && typeof raw === 'object') {
    trend = raw.trend;
    min = raw.min;
    max = raw.max;
  }
  const pad = (arr) => {
    const a = Array.isArray(arr) ? arr.slice() : [];
    while (a.length < daysLen) a.push(null);
    return a.length > daysLen ? a.slice(0, daysLen) : a;
  };
  return { trend: pad(trend), min: pad(min), max: pad(max) };
}

function getFilters() {
  const pet = $('#filter_pet')?.value;
  const type = $('#filter_type')?.value;
  const subType = $('#filter_sub_type')?.value;
  const start = $('#filter_start')?.value;
  const end = $('#filter_end')?.value;
  const params = new URLSearchParams();
  if (pet && pet !== 'all') params.set('pet_id', pet);
  if (type && type !== 'all') params.set('activity_type', type);
  if (subType && subType !== 'all') params.set('sub_type', subType);
  // Handle date inputs: detect if it's date-only (YYYY-MM-DD) or datetime-local (YYYY-MM-DDTHH:mm)
  if (start) {
    if (start.includes('T')) {
      // datetime-local format: convert to UTC ISO string
      const startDate = new Date(start);
      params.set('start', startDate.toISOString());
    } else {
      // date-only format: set to start of day in UTC
      const startDate = new Date(start + 'T00:00:00Z');
      params.set('start', startDate.toISOString());
    }
  }
  if (end) {
    if (end.includes('T')) {
      // datetime-local format: convert to UTC ISO string
      const endDate = new Date(end);
      params.set('end', endDate.toISOString());
    } else {
      // date-only format: set to end of day in UTC (23:59:59.999)
      const endDate = new Date(end + 'T23:59:59.999Z');
      params.set('end', endDate.toISOString());
    }
  }
  return params;
}

async function refreshTable() {
  const tbody = $('#activity-table tbody'); if (!tbody) return;
  const params = getFilters();
  const resp = await fetch('/api/activities?' + params.toString());
  const rows = await resp.json();
  tbody.innerHTML = '';
  rows.forEach(a => {
    let details = '';
    if (a.activity_type === 'toilet') {
      const parts = [];
      if (a.sub_type) parts.push(a.sub_type);
      if (a.location) parts.push(a.location);
      if (a.rating) parts.push('Score ' + a.rating);
      details = parts.join(' • ');
    } else if (a.activity_type === 'water') {
      details = a.rating ? ('Hydration: ' + a.rating) : (a.notes || '');
    } else if (a.activity_type === 'food') {
      details = a.rating ? ('Outcome: ' + a.rating) : (a.notes || '');
    } else {
      details = a.notes || '';
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(a.created_at).toLocaleString()}</td>
      <td>${a.pet_name ?? ''}</td>
      <td>${a.activity_type}</td>
      <td>${details}</td>
      <td>
        <form method="post" action="/delete/${a.id}">
          <button class="secondary" type="submit" onclick="return confirm('Delete this entry?')">Delete</button>
        </form>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function refreshCharts() {
  const params = getFilters();
  
  // Daily Counts chart (if present)
  const c1 = $('#dailyCounts');
  if (c1) {
    const daily = await (await fetch('/api/summary/daily_counts?' + params.toString())).json();
    const ctx1 = c1.getContext('2d');
    if (window.dailyChart) window.dailyChart.destroy();
    const datasets = daily.series.map(act => ({
      label: act,
      data: daily.days.map(d => (daily.values[d] && daily.values[d][act]) || 0),
      fill: true,
    }));
    window.dailyChart = new Chart(ctx1, {
      type: 'line',
      data: { labels: daily.days, datasets },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
  
  // Potty Hold Time charts (poop / pee separate; trend + raw min/max gap per day)
  const c2a = $('#pottyHoldTimePoop');
  const c2b = $('#pottyHoldTimePee');
  if (c2a || c2b) {
    try {
      const resp = await fetch('/api/summary/potty_hold_time?' + params.toString());
      if (!resp.ok) {
        console.warn('potty_hold_time API error:', resp.status);
      } else {
      const potty = await resp.json();
      try {
        if (window.pottyHoldTimePoopChart) window.pottyHoldTimePoopChart.destroy();
      } catch (e) { /* ignore */ }
      try {
        if (window.pottyHoldTimePeeChart) window.pottyHoldTimePeeChart.destroy();
      } catch (e) { /* ignore */ }

      if (!potty.days || potty.days.length === 0) {
        console.warn('No potty hold time data available');
      } else {
        const n = potty.days.length;
        const poop = normalizeHoldSeries(potty.poop, n);
        const pee = normalizeHoldSeries(potty.pee, n);
        const holdOpts = (titleText) => ({
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: titleText }
          },
          scales: {
            x: { title: { display: true, text: 'Date' } },
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Hours' }
            }
          }
        });

        if (c2a) {
          window.pottyHoldTimePoopChart = new Chart(c2a.getContext('2d'), {
            type: 'line',
            data: {
              labels: potty.days,
              datasets: [
                {
                  label: 'Smoothed trend (hours)',
                  data: poop.trend,
                  borderColor: 'rgb(220, 38, 38)',
                  backgroundColor: 'rgba(220, 38, 38, 0.08)',
                  tension: 0.4,
                  spanGaps: true
                },
                {
                  label: 'Min gap between events (hours)',
                  data: poop.min,
                  borderColor: 'rgb(22, 163, 74)',
                  backgroundColor: 'transparent',
                  borderDash: [6, 4],
                  tension: 0.2,
                  spanGaps: true,
                  pointRadius: 2
                },
                {
                  label: 'Max gap between events (hours)',
                  data: poop.max,
                  borderColor: 'rgb(234, 179, 8)',
                  backgroundColor: 'transparent',
                  borderDash: [2, 3],
                  tension: 0.2,
                  spanGaps: true,
                  pointRadius: 2
                }
              ]
            },
            options: holdOpts('Poop: trend vs same-day min/max time between events')
          });
        }
        if (c2b) {
          window.pottyHoldTimePeeChart = new Chart(c2b.getContext('2d'), {
            type: 'line',
            data: {
              labels: potty.days,
              datasets: [
                {
                  label: 'Smoothed trend (hours)',
                  data: pee.trend,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  tension: 0.4,
                  spanGaps: true
                },
                {
                  label: 'Min gap between events (hours)',
                  data: pee.min,
                  borderColor: 'rgb(20, 184, 166)',
                  backgroundColor: 'transparent',
                  borderDash: [6, 4],
                  tension: 0.2,
                  spanGaps: true,
                  pointRadius: 2
                },
                {
                  label: 'Max gap between events (hours)',
                  data: pee.max,
                  borderColor: 'rgb(168, 85, 247)',
                  backgroundColor: 'transparent',
                  borderDash: [2, 3],
                  tension: 0.2,
                  spanGaps: true,
                  pointRadius: 2
                }
              ]
            },
            options: holdOpts('Pee: trend vs same-day min/max time between events')
          });
        }
      }
      }
    } catch (e) {
      console.error('Error loading potty hold time chart:', e);
    }
  }
  
  // Potty Location chart (if present)
  const c3 = $('#pottyLocation');
  if (c3) {
    try {
      const resp = await fetch('/api/summary/potty_location?' + params.toString());
      const location = await resp.json();
      const ctx3 = c3.getContext('2d');
      if (window.pottyLocationChart) window.pottyLocationChart.destroy();
      
      // Ensure we have valid data
      if (!location.days || location.days.length === 0) {
        console.warn('No potty location data available');
        return;
      }
      
      window.pottyLocationChart = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: location.days,
          datasets: [
            {
              label: 'Inside',
              data: location.inside || [],
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Outside',
              data: location.outside || [],
              borderColor: 'rgb(34, 197, 94)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: {
              display: true,
              text: 'Potty Events: Inside vs Outside'
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Date' }
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Count' }
            }
          }
        }
      });
    } catch (e) {
      console.error('Error loading potty location chart:', e);
    }
  }
}

/* Wizard */
function formatNowLocalMinutes(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,'0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
const wizard = {
  data: {},   // {activity_type, location, rating, amount, notes, pet_id}
  stack: [],
  open() { 
    const wizardEl = $('#wizard');
    wizardEl.classList.remove('hidden');
    // Close when clicking backdrop (but not the card itself)
    wizardEl.onclick = (e) => {
      if (e.target === wizardEl) {
        this.close();
      }
    };
    // Prevent clicks inside the card from bubbling to backdrop
    const wizardCard = $('.wizard-card', wizardEl);
    if (wizardCard) {
      wizardCard.onclick = (e) => {
        e.stopPropagation();
      };
    }
    const tiles = document.querySelector('.tiles');
    const card = tiles?.closest('.card');
    if (card) card.classList.add('hidden');
  },
  close() { 
    const wizardEl = $('#wizard');
    wizardEl.classList.add('hidden');
    wizardEl.onclick = null; // Remove backdrop click handler
    this.reset(); 
    const tiles = document.querySelector('.tiles');
    const card = tiles?.closest('.card');
    if (card) card.classList.remove('hidden');
  },
  reset() { 
    this.data = {}; 
    this.stack = []; 
    $('#wizard-body').innerHTML=''; 
    $('#breadcrumbs').innerHTML=''; 
    this.setupSaveCancelButtons();
  },
  pushCrumb(label){ this.stack.push(label); this.renderCrumbs(); },
  popCrumb(){ this.stack.pop(); this.renderCrumbs(); },
  renderCrumbs(){
    const nav = $('#breadcrumbs'); nav.innerHTML = '';
    if (this.stack.length > 0) {
      const span = document.createElement('span');
      span.className='crumb';
      span.textContent = this.stack[0];
      nav.appendChild(span);
    }
  },
  setupSaveCancelButtons(){
    // Always show save and cancel, hide back and next
    $('#wizard-back')?.classList.add('hidden');
    $('#wizard-next')?.classList.add('hidden');
    $('#wizard-save')?.classList.remove('hidden');
    $('#wizard-cancel')?.classList.remove('hidden');
    
    // Setup cancel button
    $('#wizard-cancel').onclick = () => { this.close(); };
    
    // Setup save button
    $('#wizard-save').onclick = async () => {
      await this.collectDataAndSave();
    };
  },
  pickPetInit(){
    const picker = $('#pet_picker');
    if (!picker) return;
    const defaultId = loadDefaultPet();
    if (defaultId && !picker.value) picker.value = defaultId;
    this.data.pet_id = picker.value || '';
    // Use onchange property to overwrite any previous handler
    picker.onchange = ()=>{ this.data.pet_id = picker.value || ''; };
  },
  renderToilet(){
    this.data.activity_type = 'toilet';
    this.pushCrumb('Toilet');
    const now = formatNowLocalMinutes();
    const body = $('#wizard-body');
    body.innerHTML = `
      <div class="grid" style="gap: 24px;">
        <div>
          <h3 style="margin-top: 0;">Location</h3>
          <div class="row" style="gap: 16px; margin-bottom: 0;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="toilet_location" value="inside" style="width: auto;">
              <span>🏠 Inside</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="toilet_location" value="outside" checked style="width: auto;">
              <span>🌳 Outside</span>
            </label>
          </div>
        </div>
        
        <div>
          <h3>Type</h3>
          <div class="row" style="gap: 16px; margin-bottom: 0;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="toilet_type" value="poop" style="width: auto;">
              <span>💩 Poop</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="toilet_type" value="pee" checked style="width: auto;">
              <span>💦 Pee</span>
            </label>
          </div>
        </div>
        
        <div id="toilet_poop_options" style="display: none;">
          <h3>Poop Score</h3>
          <div class="row" style="align-items: center; margin-bottom: 0;">
            <input type="range" min="1" max="7" value="4" id="poop_score" style="flex: 1; max-width: 400px;">
            <span id="poop_score_val" style="min-width: 40px; text-align: center; font-weight: bold;">4</span>
          </div>
        </div>

        <div id="toilet_pee_options">
          <h3>Pee amount</h3>
          <div class="row" style="align-items: center; margin-bottom: 0;">
            <input type="range" min="1" max="7" value="7" id="toilet_score" style="flex: 1; max-width: 400px;">
            <span id="toilet_score_val" style="min-width: 40px; text-align: center; font-weight: bold;">7</span>
          </div>
          <div class="row" style="justify-content: space-between; max-width: 400px; font-size: 0.85rem; opacity: 0.85; margin-top: 6px;">
            <span>Interrupted</span>
            <span>Full</span>
          </div>
        </div>
        
        <div>
          <h3>Date & Time</h3>
          <input id="activity_dt" type="datetime-local" value="${now}" style="width: 100%; max-width: 400px;">
        </div>
        
        <div>
          <h3>Notes (Optional)</h3>
          <textarea id="notes_text" rows="3" placeholder="Additional notes..." style="width: 100%; max-width: 500px;"></textarea>
        </div>
      </div>
    `;
    
    // Setup event listeners for conditional fields
    $all('input[name="toilet_type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isPoop = radio.value === 'poop';
        $('#toilet_poop_options').style.display = isPoop ? 'block' : 'none';
        $('#toilet_pee_options').style.display = isPoop ? 'none' : 'block';
      });
    });
    
    $('#poop_score').addEventListener('input', (e) => {
      $('#poop_score_val').textContent = e.target.value;
    });
    $('#toilet_score')?.addEventListener('input', (e) => {
      $('#toilet_score_val').textContent = e.target.value;
    });
  },
  renderWater(){
    this.data.activity_type = 'water';
    this.pushCrumb('Water');
    const now = formatNowLocalMinutes();
    const body = $('#wizard-body');
    body.innerHTML = `
      <div class="grid" style="gap: 24px;">
        <div>
          <h3 style="margin-top: 0;">Hydration level (1=sip, 7=guzzle)</h3>
          <div class="row" style="gap: 16px; margin-bottom: 0; align-items: center;">
            <input type="range" min="1" max="7" value="4" id="water_rating" style="flex:1; max-width: 320px;">
            <span id="water_rating_val" style="min-width: 60px; text-align:center; font-weight:bold;">4</span>
          </div>
        </div>
        
        <div>
          <h3>Date & Time</h3>
          <input id="activity_dt" type="datetime-local" value="${now}" style="width: 100%; max-width: 400px;">
        </div>
        
        <div>
          <h3>Notes (Optional)</h3>
          <textarea id="notes_text" rows="3" placeholder="Additional notes..." style="width: 100%; max-width: 500px;"></textarea>
        </div>
      </div>
    `;
    // update label as slider moves
    $('#water_rating')?.addEventListener('input', (e)=>{ $('#water_rating_val').textContent = e.target.value; });
  },
  renderFood(){
    this.data.activity_type = 'food';
    this.pushCrumb('Food');
    const now = formatNowLocalMinutes();
    const body = $('#wizard-body');
    body.innerHTML = `
      <div class="grid" style="gap: 24px;">
        <div>
          <h3 style="margin-top: 0;">Outcome rating (1=leftovers, 7=scarfed)</h3>
          <div class="row" style="gap: 16px; margin-bottom: 0; align-items: center;">
            <input type="range" min="1" max="7" value="7" id="food_rating" style="flex:1; max-width:320px;">
            <span id="food_rating_val" style="min-width:60px; text-align:center; font-weight:bold;">7</span>
          </div>
        </div>
        
        <div>
          <h3>Date & Time</h3>
          <input id="activity_dt" type="datetime-local" value="${now}" style="width: 100%; max-width: 400px;">
        </div>
        
        <div>
          <h3>Notes (Optional)</h3>
          <textarea id="notes_text" rows="3" placeholder="Additional notes..." style="width: 100%; max-width: 500px;"></textarea>
        </div>
      </div>
    `;
    $('#food_rating')?.addEventListener('input', (e)=>{ $('#food_rating_val').textContent = e.target.value; });
  },
  renderTraining(){
    this.data.activity_type = 'separation';
    this.pushCrumb('Training');
    const now = formatNowLocalMinutes();
    const body = $('#wizard-body');
    body.innerHTML = `
      <div class="grid" style="gap: 24px;">
        <div>
          <h3 style="margin-top: 0;">Separation</h3>
          <div class="row" style="gap: 16px; margin-bottom: 0;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="training_type" value="start" checked style="width: auto;">
              <span>▶️ Start</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="training_type" value="end" style="width: auto;">
              <span>⏹️ End</span>
            </label>
          </div>
        </div>
        
        <div>
          <h3>Date & Time</h3>
          <input id="activity_dt" type="datetime-local" value="${now}" style="width: 100%; max-width: 400px;">
        </div>
        
        <div>
          <h3>Notes (Optional)</h3>
          <textarea id="notes_text" rows="3" placeholder="Additional notes..." style="width: 100%; max-width: 500px;"></textarea>
        </div>
      </div>
    `;
  },
  renderNotes(){
    this.data.activity_type = 'notes';
    this.pushCrumb('Notes');
    const now = formatNowLocalMinutes();
    const body = $('#wizard-body');
    body.innerHTML = `
      <div class="grid" style="gap: 24px;">
        <div>
          <h3 style="margin-top: 0;">Add a note</h3>
          <textarea id="notes_text" rows="5" placeholder="Free form note..." style="width: 100%; max-width: 500px;"></textarea>
        </div>
        
        <div>
          <h3>Date & Time</h3>
          <input id="activity_dt" type="datetime-local" value="${now}" style="width: 100%; max-width: 400px;">
        </div>
      </div>
    `;
  },
  async collectDataAndSave(){
    const now = formatNowLocalMinutes();
    
    // Collect activity type specific data
    if (this.data.activity_type === 'toilet') {
      this.data.location = $('input[name="toilet_location"]:checked')?.value || 'outside';
      const tt = $('input[name="toilet_type"]:checked')?.value || 'pee';
      if (tt === 'poop') {
        // Poop rating uses 1..7, default to 4
        this.data.rating = parseInt($('#poop_score')?.value || '4', 10);
        this.data.subType = 'poop';
        this.data.amount = null;
      } else {
        // Pee uses a 1..7 scale (1=little bit, 7=full pee), default to 7
        this.data.rating = parseInt($('#toilet_score')?.value || '7', 10);
        this.data.subType = 'pee';
        this.data.amount = null;
      }
    } else if (this.data.activity_type === 'water') {
      // use rating 1..7 for water
      this.data.rating = parseInt($('#water_rating')?.value || '4', 10);
      this.data.amount = null;
    } else if (this.data.activity_type === 'food') {
      // use rating 1..7 for food outcome (1=leftovers,7=scarfed)
      this.data.rating = parseInt($('#food_rating')?.value || '7', 10);
      this.data.amount = null;
    }
    
    // Collect common fields
    const notesEl = $('#notes_text');
    if (notesEl) {
      this.data.notes = notesEl.value.trim() || null;
    }
    
    // Collect date/time
    const dateEl = $('#activity_dt');
    const localValue = dateEl?.value || now;
    if (localValue) {
      const localDate = new Date(localValue);
      if (isNaN(localDate.getTime())) {
        console.error('Invalid date:', localValue);
        this.data.created_at = new Date(localValue + 'Z').toISOString();
      } else {
        this.data.created_at = localDate.toISOString();
      }
    } else {
      this.data.created_at = new Date().toISOString();
    }
    
    await this.save();
  },
  run(action){
    this.reset();
    this.open();
    this.pickPetInit();
    if (action === 'toilet') this.renderToilet();
    if (action === 'water') this.renderWater();
    if (action === 'food') this.renderFood();
    if (action === 'training') this.renderTraining();
    if (action === 'notes') this.renderNotes();
    this.setupSaveCancelButtons();
  },
  async save(){
    const payload = {
      activity_type: this.data.activity_type,
      sub_type: this.data.subType || null,
      location: this.data.location || null,
      rating: this.data.rating ?? null,
      amount: (this.data.activity_type === 'toilet' && this.data.amount) ? (this.data.amount || 'Full') : null,
      notes: this.data.notes || null,
      pet_id: this.data.pet_id || loadDefaultPet() || null,
      created_at: this.data.created_at || null,
    };
    const tryOnlineFirst = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OFFLINE_SAVE_TIMEOUT_MS);
      try {
        const resp = await fetch('/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await resp.json();
        if (!data.ok) {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (e) {
        clearTimeout(timeout);
        throw e;
      }
    };

    if (!navigator.onLine) {
      const count = queueOfflineActivity(payload);
      alert(`No network connection. Activity saved locally and will sync later (${count} pending).`);
      this.close();
      return;
    }

    try {
      await tryOnlineFirst();
      this.close();
      await refreshTable();
      await refreshCharts();
      await refreshHomeSummaries();
      if ($('#speedometer-poop') || $('#speedometer-pee')) {
        await refreshSpeedometers();
      }
    } catch (e) {
      const count = queueOfflineActivity(payload);
      console.warn('Error saving activity online, queued for later sync:', e);
      alert(`Unable to reach server quickly. Activity saved locally and will sync when back online (${count} pending).`);
      this.close();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  initDefaultPetSelector();
  initOfflineNavigationGuards();

  // Tile click handlers
  $all('.tile[data-action]').forEach(btn => {
    btn.addEventListener('click', ()=> wizard.run(btn.dataset.action));
  });
  // Double Good button: record poop + pee in one tap
  const doubleGoodBtn = $('#double_good_btn');
  if (doubleGoodBtn) {
    doubleGoodBtn.addEventListener('click', async () => {
      await recordDoubleGood();
    });
  }
  $('#wizard-close')?.addEventListener('click', ()=> { wizard.close(); });

  // Filters / CSV / Report
  $('#apply_filters')?.addEventListener('click', async ()=>{
    const hasTable = $('#activity-table');
    const hasCharts = $('#dailyCounts') || $('#pottyHoldTimePoop') || $('#pottyHoldTimePee') || $('#pottyLocation');
    if (hasTable) await refreshTable();
    if (hasCharts) await refreshCharts();
  });
  $('#clear_filters')?.addEventListener('click', async ()=>{
    $('#filter_pet').value='all';
    if ($('#filter_type')) $('#filter_type').value='all';
    if ($('#filter_sub_type')) $('#filter_sub_type').value='all';
    $('#filter_start').value='';
    $('#filter_end').value='';
    const hasTable = $('#activity-table');
    const hasCharts = $('#dailyCounts') || $('#pottyHoldTimePoop') || $('#pottyHoldTimePee') || $('#pottyLocation');
    if (hasTable) await refreshTable();
    if (hasCharts) await refreshCharts();
  });
  $('#export_csv')?.addEventListener('click', ()=>{ const params = getFilters(); window.location.href = '/export.csv?' + params.toString(); });
  $('#open_report')?.addEventListener('click', ()=>{ const params = getFilters(); window.open('/report?' + params.toString(), '_blank'); });

  // Initial charts (only if canvas elements exist)
  if ($('#dailyCounts') || $('#pottyHoldTimePoop') || $('#pottyHoldTimePee') || $('#pottyLocation')) {
    refreshCharts();
  }
  // Initial table (only if table exists)
  if ($('#activity-table')) {
    refreshTable();
  }
  // Initial recent summaries on home
  refreshHomeSummaries();

  // Attempt to sync any offline activities that were queued while offline
  syncPendingActivities();

  // When connectivity is restored, sync queued activities
  window.addEventListener('online', () => {
    syncPendingActivities();
  });
  
  // Speedometer indicators (if present)
  if ($('#speedometer-poop') || $('#speedometer-pee')) {
    refreshSpeedometers();
    // Refresh every 5 minutes, but only if wizard is not open
    setInterval(() => {
      if (!$('#wizard') || $('#wizard').classList.contains('hidden')) {
        refreshSpeedometers();
        refreshHomeSummaries();
      }
    }, 5 * 60 * 1000);
  }
});

async function recordDoubleGood() {
  const btn = $('#double_good_btn');
  const iconEl = btn?.querySelector('.icon');
  const labelEl = btn?.querySelector('.label');

  // Preserve original content for later restore
  const originalIcon = iconEl ? iconEl.textContent : '';
  const originalLabel = labelEl ? labelEl.textContent : '';

  // Use selected pet or stored default
  const petId = $('#default_pet')?.value || loadDefaultPet() || null;
  if (!petId) {
    alert('Please select a pet first.');
    return;
  }

  // Use current time for both events
  const now = new Date().toISOString();

  const base = {
    activity_type: 'toilet',
    location: 'outside',
    notes: null,
    pet_id: petId,
    created_at: now,
  };

  const poopPayload = {
    ...base,
    sub_type: 'poop',
    rating: 2, // matches wizard default for poop
  };

  const peePayload = {
    ...base,
    sub_type: 'pee',
    rating: 7, // matches wizard default for pee
  };

  try {
    // Show loading state
    if (btn) {
      btn.disabled = true;
      if (labelEl) labelEl.textContent = 'Saving...';
    }

    const send = async (payload) => {
      const resp = await fetch('/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!data.ok) {
        throw new Error(data.error || 'Unknown error');
      }
    };

    // Create poop then pee
    await send(poopPayload);
    await send(peePayload);

    // Refresh UI pieces that depend on activities
    await refreshTable();
    await refreshCharts();
    await refreshHomeSummaries();
    if ($('#speedometer-poop') || $('#speedometer-pee')) {
      await refreshSpeedometers();
    }

    // Success feedback
    if (btn) {
      if (iconEl) iconEl.textContent = '✅';
      if (labelEl) labelEl.textContent = 'Recorded';
      // Briefly show success, then restore text (but keep recorded state obvious)
      setTimeout(() => {
        if (iconEl) iconEl.textContent = originalIcon;
        if (labelEl) labelEl.textContent = originalLabel;
      }, 1500);
    }
  } catch (e) {
    console.error('Error recording Double Good:', e);
    alert('Error recording Double Good: ' + (e.message || e));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Speedometer indicators
async function refreshSpeedometers() {
  // Don't refresh if wizard is open (user might be entering data)
  if ($('#wizard') && !$('#wizard').classList.contains('hidden')) return;
  
  const petId = $('#default_pet')?.value || 'all';
  const params = new URLSearchParams();
  if (petId && petId !== 'all') params.set('pet_id', petId);
  
  try {
    const data = await (await fetch('/api/summary/potty_speedometer?' + params.toString())).json();
    
    // Pee speedometer (left)
    const peeEl = $('#speedometer-pee');
    if (peeEl && data.pee) {
      renderSpeedometer(peeEl, data.pee, 'Pee');
    }
    
    // Poop speedometer (right)
    const poopEl = $('#speedometer-poop');
    if (poopEl && data.poop) {
      renderSpeedometer(poopEl, data.poop, 'Poop');
    }
  } catch (e) {
    console.error('Error loading speedometer data:', e);
  }
}

function renderSpeedometer(container, data, label) {
  const hoursSince = data.hours_since;
  const avgHours = data.avg_hours;
  
  if (hoursSince === null || avgHours === null) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #6b7280;">No ${label.toLowerCase()} data available</div>`;
    return;
  }
  
  // Calculate percentage relative to weighted moving average
  // 0% = just happened, 100% = at expected time, >100% = past expected time
  const percentage = (hoursSince / avgHours) * 100;
  
  // Determine color based on how close we are to expected time
  // Green: 0-60% (well before expected), Yellow: 60-100% (approaching expected), Red: >100% (past expected)
  let color = '#10b981'; // green
  if (percentage >= 100) color = '#ef4444'; // red - past expected time
  else if (percentage >= 60) color = '#f59e0b'; // yellow - approaching expected time
  
  // Create SVG speedometer
  const size = 200;
  const center = size / 2;
  const radius = size / 2 - 20;
  
  // Calculate angle: left side (π) = 0 hours, right side (0) = expected hours
  // Map hoursSince from 0 to avgHours onto angle from π to 0
  const ratio = Math.min(hoursSince / avgHours, 1.0); // Cap at 1.0 (100% of expected)
  const angleRad = Math.PI * (1 - ratio); // π at 0 hours, 0 at expected hours
  
  // Calculate end point of arc and needle
  // Arc starts at left (π radians), sweeps clockwise to current position
  const startAngle = Math.PI; // Left side (180 degrees)
  const endAngle = angleRad; // Current position
  const endX = center + radius * Math.cos(endAngle);
  const endY = center - radius * Math.sin(endAngle);
  const startX = center + radius * Math.cos(startAngle);
  const startY = center - radius * Math.sin(startAngle);
  
  // Determine if we need large arc flag (for angles > 180 degrees)
  const sweepAngle = Math.PI - angleRad; // Angle swept from left
  const largeArc = sweepAngle > Math.PI ? 1 : 0;
  
  container.innerHTML = `
    <div style="text-align: center;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px;">${label}</h3>
      <svg width="${size}" height="${size / 2 + 20}" style="max-width: 100%;">
        <!-- Background arc (full semi-circle) -->
        <path d="M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${size - 20} ${center}" 
              stroke="#e5e7eb" stroke-width="12" fill="none" />
        <!-- Value arc (from left to current position) -->
        <path d="M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}" 
              stroke="${color}" stroke-width="12" fill="none" stroke-linecap="round" />
        <!-- Needle -->
        <line x1="${center}" y1="${center}" 
              x2="${endX}" 
              y2="${endY}" 
              stroke="#111827" stroke-width="3" stroke-linecap="round" />
        <!-- Center dot -->
        <circle cx="${center}" cy="${center}" r="6" fill="#111827" />
      </svg>
      <div style="margin-top: 12px;">
        <div style="font-size: 24px; font-weight: bold; color: ${color};">${hoursSince.toFixed(1)}h</div>
        <div style="font-size: 14px; color: #6b7280;">Since last ${label.toLowerCase()}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Expected: ${avgHours.toFixed(1)}h</div>
        ${percentage >= 100 ? `<div style="font-size: 11px; color: #ef4444; margin-top: 2px;">${(percentage - 100).toFixed(0)}% overdue</div>` : `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${(100 - percentage).toFixed(0)}% to expected</div>`}
      </div>
    </div>
  `;
}
