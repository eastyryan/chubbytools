// ---------------------------------------------------------------
// Chubby's Carpenter Pencils — ordering
// Payment is by Interac e-Transfer to ORDER_EMAIL; the generated
// order code goes in the e-Transfer message to match payments.
// ---------------------------------------------------------------

const ORDER_EMAIL = 'chubbytoolscp@gmail.com';

// Prices (CAD)
const PRODUCTS = {
  single:  { label: 'Single pencil',   sku: 'SKU-001-01',  price: 4,   pencils: 1   },
  ten:     { label: '10-pack',         sku: 'SKU-001-10',  price: 20,  pencils: 10  },
  hundred: { label: 'Site box (100)',  sku: 'SKU-001-100', price: 100, pencils: 100 },
};

// Combined GST/HST/PST rates by province (2026)
const TAX = {
  AB: { rate: 0.05,    label: 'GST 5%'      },
  BC: { rate: 0.12,    label: 'GST+PST 12%' },
  MB: { rate: 0.12,    label: 'GST+PST 12%' },
  NB: { rate: 0.15,    label: 'HST 15%'     },
  NL: { rate: 0.15,    label: 'HST 15%'     },
  NS: { rate: 0.14,    label: 'HST 14%'     },
  NT: { rate: 0.05,    label: 'GST 5%'      },
  NU: { rate: 0.05,    label: 'GST 5%'      },
  ON: { rate: 0.13,    label: 'HST 13%'     },
  PE: { rate: 0.15,    label: 'HST 15%'     },
  QC: { rate: 0.14975, label: 'GST+QST 14.975%' },
  SK: { rate: 0.11,    label: 'GST+PST 11%' },
  YT: { rate: 0.05,    label: 'GST 5%'      },
};

// Shipping: site box ships as a tracked parcel; small orders go lettermail
function shippingFor(qty) {
  const pencils = qty.single * 1 + qty.ten * 10 + qty.hundred * 100;
  if (pencils === 0) return 0;
  if (qty.hundred > 0) return 19;   // Regular Parcel, tracked
  if (pencils <= 2) return 3;       // Oversize lettermail, up to 100g
  return 6;                          // Oversize lettermail, up to ~500g
}

const qty = { single: 0, ten: 0, hundred: 0 };
const fmt = n => '$' + n.toFixed(2);
const $ = id => document.getElementById(id);

function recalc() {
  let subtotal = 0;
  for (const key of Object.keys(PRODUCTS)) {
    const line = qty[key] * PRODUCTS[key].price;
    subtotal += line;
    $('qty-' + key).textContent = qty[key];
    $('amt-' + key).textContent = fmt(line);
  }
  const shipping = shippingFor(qty);
  const prov = $('of-province').value;
  const tax = prov && TAX[prov] ? (subtotal + shipping) * TAX[prov].rate : null;

  $('t-sub').textContent = fmt(subtotal);
  $('t-ship').textContent = subtotal > 0 ? fmt(shipping) : '—';
  $('tax-label').textContent = prov ? 'TAX ' + prov : 'TAX —';
  $('t-tax-k').textContent = prov && TAX[prov] ? 'Tax (' + TAX[prov].label + ')' : 'Tax';
  $('t-tax').textContent = tax !== null && subtotal > 0 ? fmt(tax) : '— select province —';
  $('t-total').textContent = fmt(subtotal > 0 ? subtotal + shipping + (tax || 0) : 0);
  return { subtotal, shipping, tax, total: subtotal > 0 ? subtotal + shipping + (tax || 0) : 0 };
}

function makeOrderCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  const buf = new Uint32Array(5);
  crypto.getRandomValues(buf);
  let s = '';
  for (const v of buf) s += alphabet[v % alphabet.length];
  return 'CHB-' + s;
}

// Wire up
document.querySelectorAll('[data-add]').forEach(a => a.addEventListener('click', () => {
  qty[a.dataset.add]++;
  recalc();
}));

document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.step;
  qty[k] = Math.max(0, qty[k] + Number(b.dataset.dir));
  recalc();
}));

$('of-province').addEventListener('change', recalc);

$('order-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const totals = recalc();

  if (totals.subtotal === 0) { alert('Add at least one item to your order first.'); return; }
  if (!form.reportValidity()) return;
  const prov = $('of-province').value;

  const code = makeOrderCode();
  const items = Object.keys(PRODUCTS)
    .filter(k => qty[k] > 0)
    .map(k => `${qty[k]} × ${PRODUCTS[k].label} (${PRODUCTS[k].sku}) — ${fmt(qty[k] * PRODUCTS[k].price)}`)
    .join('\n');

  const btn = $('place-order');
  btn.disabled = true;
  btn.textContent = 'Placing order…';

  // Email the order via FormSubmit (first submission triggers a one-time
  // activation email to ORDER_EMAIL — confirm it to start receiving orders)
  let sent = false;
  try {
    const res = await fetch('https://formsubmit.co/ajax/' + ORDER_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `Order ${code} — ${fmt(totals.total)} — ${form.name.value}`,
        _template: 'box',
        'Order code': code,
        'Items': items,
        'Subtotal': fmt(totals.subtotal),
        'Shipping': fmt(totals.shipping),
        'Tax': `${fmt(totals.tax)} (${TAX[prov].label})`,
        'Total (expected e-Transfer)': fmt(totals.total),
        'Name': form.name.value,
        'Email': form.email.value,
        'Address': `${form.address.value}, ${form.city.value}, ${prov} ${form.postal.value}`,
      }),
    });
    sent = res.ok;
  } catch (_) { /* offline / blocked — fall through to backup instructions */ }

  // Show e-Transfer instructions
  $('confirm-code').textContent = code;
  $('confirm-code2').textContent = code;
  $('confirm-total').textContent = fmt(totals.total);
  $('confirm-note').innerHTML = sent
    ? 'Your order details have been sent to us. Once your e-Transfer arrives with the code above, we\'ll ship within 48h.'
    : `We couldn't send your order automatically — please email your order code <strong>${code}</strong>, your items, and your shipping address to <a href="mailto:${ORDER_EMAIL}">${ORDER_EMAIL}</a>, then send your e-Transfer.`;
  $('confirm').classList.add('show');
  $('confirm').scrollIntoView({ behavior: 'smooth', block: 'center' });

  btn.disabled = false;
  btn.textContent = 'Place order →';
});

recalc();
