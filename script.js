/* ==========================================================================
   Body Scent — script.js (shared by all pages)
   - product.html : load products.json, render cards, mood filter
   - order.html   : prefill form from URL params, submit to Apps Script
   - admin.html   : load orders CSV from Google Sheets, render table
   Each section runs only if its elements exist on the current page.
   ========================================================================== */

const ORDER_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwpty5CfvLocwTdPgELxliUWEW6RCVEB2vnqR9WuzULL15DUzAV2qiy48Ag1cpxBI3K/exec';

const ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUB1HKUtRBa9QdhhoXDd56rwKeq-RwdzmpaPJ0rCCuQWv5WSOov3XhZeS8R9WCd6EEQ8aLZQ0pGuy1/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- Helpers ---------- */
function formatPrice(value) {
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n.toLocaleString('th-TH');
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================================
   1) PRODUCT PAGE
   ========================================================================== */
async function initProductPage() {
  const list = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');

  let products = [];
  try {
    const res = await fetch('products.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    products = await res.json();
  } catch (error) {
    console.error(error);
    list.textContent = 'ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง';
    return;
  }

  // Initial mood from ?mood=xxx (fallback to "all" if invalid)
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get('mood') || 'all').toLowerCase();
  let currentMood = MOODS.some(m => m.key === requested) ? requested : 'all';

  function render() {
    list.innerHTML = '';
    const visible =
      currentMood === 'all'
        ? products
        : products.filter(p => p.mood === currentMood);

    if (visible.length === 0) {
      list.textContent = 'ไม่พบสินค้าในหมวดนี้';
      return;
    }
    visible.forEach(p => list.appendChild(buildProductCard(p)));
  }

  function updateButtons() {
    if (!filterBar) return;
    filterBar.querySelectorAll('.filter-btn').forEach(btn => {
      const active = btn.dataset.mood === currentMood;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  if (filterBar) {
    filterBar.innerHTML = '';
    MOODS.forEach(m => {
      const btn = el('button', 'filter-btn', m.label);
      btn.type = 'button';
      btn.dataset.mood = m.key;
      btn.addEventListener('click', () => {
        currentMood = m.key;
        updateButtons();
        render();
        // keep the URL in sync so the filtered view can be shared
        const url = new URL(window.location.href);
        if (m.key === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', m.key);
        history.replaceState(null, '', url);
      });
      filterBar.appendChild(btn);
    });
  }

  updateButtons();
  render();
}

function buildProductCard(p) {
  const card = el('article', 'product-card');
  card.dataset.mood = p.mood;

  // Image
  const media = el('div', 'product-card__media');
  const img = document.createElement('img');
  img.src = p.image;
  img.alt = p.name;
  img.loading = 'lazy';
  media.appendChild(img);
  card.appendChild(media);

  // Mood label (small colored dot + text)
  card.appendChild(el('span', 'mood-label product-card__mood', capitalize(p.mood)));

  // Name
  card.appendChild(el('h3', 'product-card__name', p.name));

  // Size (roll-on may have no size)
  if (p.size) card.appendChild(el('p', 'product-card__meta', p.size));

  // Footer: price + order button
  const footer = el('div', 'product-card__footer');
  footer.appendChild(el('span', 'price', formatPrice(p.price) + ' บาท'));

  const itemName = p.size ? `${p.name} ${p.size}` : p.name;
  const order = el('a', 'btn btn--small', 'สั่งซื้อ');
  order.href =
    'order.html?item=' + encodeURIComponent(itemName) +
    '&price=' + encodeURIComponent(p.price);
  footer.appendChild(order);

  card.appendChild(footer);
  return card;
}

/* ==========================================================================
   2) ORDER PAGE
   ========================================================================== */
function initOrderPage() {
  const form = document.getElementById('orderForm');

  // Prefill from URL params — both #items AND #total
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsField = document.getElementById('items');
  const totalField = document.getElementById('total');

  if (item !== null && itemsField) itemsField.value = item;
  if (price !== null && totalField) totalField.value = price;

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true; // prevent double submit

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================================
   3) ADMIN PAGE
   ========================================================================== */
async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');

  function showMessage(text) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = el('td', '', text);
    td.colSpan = 6;
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  let text;
  try {
    // timestamp param helps avoid a stale cached copy
    const sep = ORDERS_CSV_URL.includes('?') ? '&' : '?';
    const res = await fetch(ORDERS_CSV_URL + sep + 't=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    text = await res.text();
  } catch (error) {
    console.error(error);
    showMessage('ไม่สามารถโหลดข้อมูลออเดอร์ได้ กรุณาลองใหม่อีกครั้ง');
    return;
  }

  // Drop header row and fully empty rows
  const rows = parseCSV(text)
    .slice(1)
    .filter(r => r.some(cell => cell.trim() !== ''));

  if (rows.length === 0) {
    showMessage('ยังไม่มีออเดอร์');
    return;
  }

  // New orders are appended at the bottom of the sheet → reverse = newest first
  rows.reverse();

  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    // Columns: timestamp, customerName, contact, items, total, note
    for (let i = 0; i < 6; i++) {
      const value = (r[i] || '').trim();
      const td = document.createElement('td');
      td.textContent = i === 4 && value !== '' ? formatPrice(value) : value; // textContent = safe from HTML injection
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

/* ---------- CSV parser (no external library) ----------
   Handles quoted fields, commas and line breaks inside quotes,
   escaped quotes (""), and both \n and \r\n line endings. */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // last field/row (file without trailing newline)
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
