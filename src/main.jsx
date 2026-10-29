
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const savedUrl = localStorage.getItem('sbs_project_url') || '';
const savedKey = localStorage.getItem('sbs_public_key') || '';
const URL0 = import.meta.env.VITE_SUPABASE_URL || savedUrl;
const KEY0 = import.meta.env.VITE_SUPABASE_ANON_KEY || savedKey;
const client = URL0 && KEY0 ? createClient(URL0, KEY0) : null;

const today = () => new Date().toISOString().slice(0, 10);
const money = n => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(n) || 0);

const blankCustomer = {
  full_name: '', business_name: '', mobile: '',
  email: '', address: '', notes: ''
};
const blankBank = {
  bank_name: '', account_name: '', account_number: '',
  ifsc: '', branch: '', upi_id: '', notes: ''
};
const blankInvoice = {
  customer_id: '', invoice_number: '', invoice_date: today(),
  due_date: '', description: '', amount: '', gst_rate: '5'
};
const blankPayment = {
  invoice_id: '', payment_date: today(), amount: '',
  method: 'Bank transfer', reference: '', notes: ''
};

function App() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [config, setConfig] = useState(!client);
  const [url, setUrl] = useState(URL0);
  const [key, setKey] = useState(KEY0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [role, setRole] = useState('');
  const [tab, setTab] = useState('customers');
  const [tabHistory, setTabHistory] = useState([]);

function goToTab(nextTab) {
  setTabHistory(prev => [...prev, tab]);
  setTab(nextTab);
  setMsg('');
}

function goBack() {
  if (tabHistory.length > 0) {
    setTab(tabHistory[tabHistory.length - 1]);
    setTabHistory(prev => prev.slice(0, -1));
  } else {
    setTab('customers');
  }
}

  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankCustomer);

  const [bankForm, setBankForm] = useState(blankBank);
  const [invoiceForm, setInvoiceForm] = useState(blankInvoice);
  const [paymentForm, setPaymentForm] = useState(blankPayment);

  const isAdmin = role?.toLowerCase() === 'admin';

  useEffect(() => {
    if (!client) {
      setChecking(false);
      return;
    }
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMsg(error.message);
      setSession(data?.session || null);
      setChecking(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession)
    );
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadData() {
    if (!client || !session) return;

    setBusy(true);
    setMsg('');

    try {
      const roleResult = await client
        .from('app_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (roleResult.error) throw roleResult.error;

      const currentRole = roleResult.data?.role || '';
      setRole(currentRole);

      if (!currentRole) {
        setCustomers([]);
        setBanks([]);
        setInvoices([]);
        setPayments([]);
        return;
      }

      const results = await Promise.all([
        client.from('customers')
          .select('*').order('created_at', { ascending: false }),
        client.from('bank_details')
          .select('*').order('created_at', { ascending: false }),
        client.from('invoices')
          .select('*').order('created_at', { ascending: false }),
        client.from('payments')
          .select('*').order('created_at', { ascending: false })
      ]);

      const names = ['Customers', 'Bank Details', 'Invoices', 'Payments'];
      const failed = results.findIndex(r => r.error);
      if (failed >= 0) {
        throw new Error(`${names[failed]}: ${results[failed].error.message}`);
      }

      setCustomers(results[0].data || []);
      setBanks(results[1].data || []);
      setInvoices(results[2].data || []);
      setPayments(results[3].data || []);
    } catch (error) {
      setMsg(error.message || 'Data load failed.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (session && client) loadData();
    else {
      setRole('');
      setCustomers([]);
      setBanks([]);
      setInvoices([]);
      setPayments([]);
    }
  }, [session]);

  const shownCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers.filter(c =>
      [c.full_name, c.business_name, c.mobile, c.email]
        .some(v => (v || '').toLowerCase().includes(q))
    );
  }, [customers, search]);

  const customerName = id =>
    customers.find(c => c.id === id)?.full_name || 'Unknown customer';

  const invoicePaid = id =>
    payments.filter(p => p.invoice_id === id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const invoiceTotal = inv =>
    Number(inv.amount || 0) * (1 + Number(inv.gst_rate || 0) / 100);

  const invoiceDue = inv =>
    Math.max(0, invoiceTotal(inv) - invoicePaid(inv.id));

  const totalBilled = invoices
    .filter(i => i.status !== 'Cancelled')
    .reduce((sum, i) => sum + invoiceTotal(i), 0);

  const totalCollected = payments
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalOutstanding = invoices
    .filter(i => i.status !== 'Cancelled')
    .reduce((sum, i) => sum + invoiceDue(i), 0);

  async function login(e) {
    e.preventDefault();
    if (!client) return;
    setBusy(true);
    setMsg('');
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(), password
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else setPassword('');
  }

  async function logout() {
    const { error } = await client.auth.signOut();
    if (error) setMsg(error.message);
  }

  async function saveCustomer(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');

    const data = { ...form, owner_id: session.user.id };
    const result = editing
      ? await client.from('customers').update(data)
          .eq('id', editing).select().single()
      : await client.from('customers').insert(data).select().single();

    setBusy(false);
    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setCustomers(prev => editing
      ? prev.map(c => c.id === editing ? result.data : c)
      : [result.data, ...prev]);

    setForm(blankCustomer);
    setEditing(null);
    setFormOpen(false);
    setMsg('Customer saved successfully.');
  }

  async function deleteCustomer(id) {
    if (!isAdmin || !window.confirm('Delete this customer?')) return;

    const { error } = await client.from('customers').delete().eq('id', id);
    if (error) {
      setMsg(error.message);
      return;
    }
    setCustomers(prev => prev.filter(c => c.id !== id));
    setMsg('Customer deleted.');
  }

  async function saveBank(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');

    const { error } = await client.from('bank_details').insert({
      ...bankForm, owner_id: session.user.id
    });

    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }

    setBankForm(blankBank);
    setMsg('Bank details saved.');
    await loadData();
  }

  async function deleteBank(id) {
    if (!window.confirm('Delete these bank details?')) return;
    const { error } = await client.from('bank_details').delete().eq('id', id);
    if (error) {
      setMsg(error.message);
      return;
    }
    setBanks(prev => prev.filter(b => b.id !== id));
    setMsg('Bank details deleted.');
  }

  async function saveInvoice(e) {
    e.preventDefault();
    if (!customers.some(c => c.id === invoiceForm.customer_id)) {
      setMsg('Please select a valid customer.');
      return;
    }

    setBusy(true);
    setMsg('');

    const { error } = await client.from('invoices').insert({
      ...invoiceForm,
      owner_id: session.user.id,
      amount: Number(invoiceForm.amount),
      gst_rate: Number(invoiceForm.gst_rate),
      due_date: invoiceForm.due_date || null,
      status: 'Unpaid'
    });

    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }

    setInvoiceForm(blankInvoice);
    setMsg('Invoice saved.');
    await loadData();
  }

  async function savePayment(e) {
    e.preventDefault();

    const selectedInvoice = invoices.find(i => i.id === paymentForm.invoice_id);
    if (!selectedInvoice) {
      setMsg('Please select an invoice.');
      return;
    }

    const amount = Number(paymentForm.amount);
    const due = invoiceDue(selectedInvoice);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg('Enter a valid payment amount.');
      return;
    }
    if (amount > due + 0.001) {
      setMsg(`Payment exceeds the current balance of ${money(due)}.`);
      return;
    }

    setBusy(true);
    setMsg('');

    const { error } = await client.from('payments').insert({
      ...paymentForm,
      owner_id: session.user.id,
      amount
    });

    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }

    setPaymentForm(blankPayment);
    setMsg('Payment saved.');
    await loadData();
  }

  async function cancelInvoice(inv) {
    if (!isAdmin || !window.confirm('Cancel this invoice?')) return;

    const { error } = await client.from('invoices')
      .update({ status: 'Cancelled' }).eq('id', inv.id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setInvoices(prev => prev.map(i =>
      i.id === inv.id ? { ...i, status: 'Cancelled' } : i
    ));
    setMsg('Invoice cancelled.');
  }

  function printInvoice(inv) {
    const customer = customers.find(c => c.id === inv.customer_id);
    const bank = banks[0];
    const paid = invoicePaid(inv.id);
    const gst = Number(inv.amount) * Number(inv.gst_rate) / 100;
    const total = invoiceTotal(inv);

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    }[ch]));

    const w = window.open('', '_blank');
    if (!w) {
      setMsg('Allow pop-ups to print the invoice.');
      return;
    }

    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(inv.invoice_number)}</title>
<style>
body{font:15px Arial,sans-serif;color:#222;margin:32px}
h1{margin-bottom:4px} .muted{color:#666}
table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{padding:10px;border:1px solid #ddd;text-align:left}
.right{text-align:right}.total{font-size:20px;font-weight:bold}
</style></head><body>
<h1>SANTU BUSINESS SERVICES</h1>
<p class="muted">YOUR OUTSOURCED OPERATIONS PARTNER</p>
<hr><h2>INVOICE</h2>
<p><b>Invoice No:</b> ${escapeHtml(inv.invoice_number)}<br>
<b>Date:</b> ${escapeHtml(inv.invoice_date)}<br>
<b>Due date:</b> ${escapeHtml(inv.due_date || '—')}</p>
<h3>Bill To</h3>
<p>${escapeHtml(customer?.full_name || '')}<br>
${escapeHtml(customer?.business_name || '')}<br>
${escapeHtml(customer?.address || '')}<br>
${escapeHtml(customer?.mobile || '')}</p>
<table><tr><th>Description</th><th class="right">Amount</th></tr>
<tr><td>${escapeHtml(inv.description || 'Services')}</td>
<td class="right">${money(inv.amount)}</td></tr>
<tr><td>GST (${escapeHtml(inv.gst_rate)}%)</td>
<td class="right">${money(gst)}</td></tr>
<tr><th>Total</th><th class="right">${money(total)}</th></tr>
<tr><td>Paid</td><td class="right">${money(paid)}</td></tr>
<tr><th>Balance due</th><th class="right">${money(Math.max(0,total-paid))}</th></tr>
</table>
${bank ? `<h3>Bank Details</h3><p>${escapeHtml(bank.bank_name)}<br>
Account name: ${escapeHtml(bank.account_name)}<br>
Account number: ${escapeHtml(bank.account_number)}<br>
IFSC: ${escapeHtml(bank.ifsc)}<br>
UPI: ${escapeHtml(bank.upi_id)}</p>` : ''}
<p class="muted">Thank you for your business.</p>
<script>window.onload=()=>window.print();</script>
</body></html>`);
    w.document.close();
  }

  if (checking) return <main className="center">Checking session…</main>;

  if (config || !client) {
    return <main className="wrap">
      <header className="hero">
        <small>YOUR OUTSOURCED OPERATIONS PARTNER</small>
        <h1>SANTU BUSINESS SERVICES</h1>
        <p>Business Management App</p>
      </header>
      <section className="card">
        <h2>Connect Supabase</h2>
        <p>Enter your Project URL and public/anon key. Never use a service_role or secret key here.</p>
        <form onSubmit={e => {
          e.preventDefault();
          if (!url.startsWith('https://') || !key.trim()) {
            setMsg('Enter a valid Project URL and public key.');
            return;
          }
          localStorage.setItem('sbs_project_url', url.trim());
          localStorage.setItem('sbs_public_key', key.trim());
          window.location.reload();
        }}>
          <label>Project URL
            <input required value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://project.supabase.co" />
          </label>
          <label>Public / anon key
            <textarea required rows="3" value={key}
              onChange={e => setKey(e.target.value)} />
          </label>
          <button type="submit">Connect project</button>
        </form>
        {msg && <p className="msg">{msg}</p>}
      </section>
    </main>;
  }

  if (!session) {
    return <main className="wrap">
      <header className="hero">
        <small>YOUR OUTSOURCED OPERATIONS PARTNER</small>
        <h1>SANTU BUSINESS SERVICES</h1>
        <p>Business Management App</p>
      </header>
      <section className="card">
        <h2>Admin / Staff Login</h2>
        <form onSubmit={login}>
          <label>Email
            <input required type="email" value={email}
              onChange={e => setEmail(e.target.value)} />
          </label>
          <label>Password
            <input required type="password" value={password}
              onChange={e => setPassword(e.target.value)} />
          </label>
          <button disabled={busy}>{busy ? 'Please wait…' : 'Login'}</button>
        </form>
        <button className="secondary" onClick={() => setConfig(true)}>
          Supabase settings
        </button>
        {msg && <p className="msg">{msg}</p>}
      </section>
    </main>;
  }

  if (!role) {
    return <main className="wrap">
      <section className="card">
        <h2>Access pending</h2>
        <p>No role is assigned to this user in app_roles.</p>
        <p>Auth User ID:</p><code>{session.user.id}</code>
        <button className="secondary" onClick={logout}>Logout</button>
        {msg && <p className="msg">{msg}</p>}
      </section>
    </main>;
  }

  const nav = [
    ['customers', 'Customers'],
    ['banks', 'Bank Details'],
    ['invoices', 'Invoices'],
    ['payments', 'Payments'],
    ['reports', 'Reports']
  ];

  return <main className="app">
    <header className="hero">
      <small>YOUR OUTSOURCED OPERATIONS PARTNER</small>
      <div className="hero-row">
        <div>
          <h1>SANTU BUSINESS SERVICES</h1>
          <p>Business Management Dashboard</p>
        </div>
        <button className="secondary" onClick={logout}>Logout</button>
      </div>
    </header>

    <section className="stats">
      <div className="stat"><span>Customers</span><b>{customers.length}</b></div>
      <div className="stat"><span>Total billed</span><b>{money(totalBilled)}</b></div>
      <div className="stat"><span>Collected</span><b>{money(totalCollected)}</b></div>
      <div className="stat"><span>Outstanding</span><b>{money(totalOutstanding)}</b></div>
    </section>
    <div className="card nav-tabs">
  <button className="secondary" onClick={goBack}>
    ← Back
  </button>
  <button className="secondary" onClick={() => {
    setTabHistory([]);
    setTab('customers');
    setMsg('');
  }}>
    🏠 Home
  </button>
</div>
    <nav className="card nav-tabs">
      {nav.map(([id, label]) =>
        <button key={id} className={tab === id ? 'active' : 'secondary'}
          onClick={() => goToTab(id)}
          {label}
        </button>
      )}
    </nav>

    {busy && <p className="muted">Working…</p>}
    {msg && <div className="message" role="status">
      {msg}<button onClick={() => setMsg('')}>×</button>
    </div>}

    {tab === 'customers' && <section className="card">
      <div className="section-title">
        <div><h2>Customer Master</h2><p>Add, search and edit customers.</p></div>
        <button onClick={() => {
          setEditing(null); setForm({ ...blankCustomer }); setFormOpen(!formOpen);
        }}>+ Add customer</button>
      </div>

      {formOpen && <form onSubmit={saveCustomer}>
        <h3>{editing ? 'Edit Customer' : 'New Customer'}</h3>
        <div className="grid">
          {[
            ['full_name', 'Full name'],
            ['business_name', 'Business name'],
            ['mobile', 'Mobile number'],
            ['email', 'Email'],
            ['address', 'Address'],
            ['notes', 'Notes']
          ].map(([field, label]) => <label key={field}>{label}
            {['address', 'notes'].includes(field)
              ? <textarea rows="2" value={form[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })} />
              : <input required={field === 'full_name'}
                  type={field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })} />}
          </label>)}
        </div>
        <button disabled={busy}>Save customer</button>
        <button type="button" className="secondary"
          onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</button>
      </form>}

      <input className="search" placeholder="Search name, business, mobile or email"
        value={search} onChange={e => setSearch(e.target.value)} />

      {shownCustomers.length === 0 ? <p>No customers found.</p> :
        <div className="table-wrap"><table>
          <thead><tr><th>Name / Business</th><th>Mobile / Email</th>
            <th>Address</th><th>Actions</th></tr></thead>
          <tbody>{shownCustomers.map(c => <tr key={c.id}>
            <td><b>{c.full_name}</b><small>{c.business_name || '—'}</small></td>
            <td>{c.mobile || '—'}<small>{c.email || '—'}</small></td>
            <td>{c.address || '—'}</td>
            <td>
              <button className="small" onClick={() => {
                setEditing(c.id);
                setForm({
                  full_name: c.full_name || '',
                  business_name: c.business_name || '',
                  mobile: c.mobile || '',
                  email: c.email || '',
                  address: c.address || '',
                  notes: c.notes || ''
                });
                setFormOpen(true);
              }}>Edit</button>
              {isAdmin && <button className="small danger"
                onClick={() => deleteCustomer(c.id)}>Delete</button>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    </section>}

    {tab === 'banks' && <section className="card">
      <h2>Bank Details</h2>
      <p>Store business bank account details securely.</p>
      <form onSubmit={saveBank}>
        <div className="grid">
          {[
            ['bank_name', 'Bank name'],
            ['account_name', 'Account holder name'],
            ['account_number', 'Account number'],
            ['ifsc', 'IFSC'],
            ['branch', 'Branch'],
            ['upi_id', 'UPI ID'],
            ['notes', 'Notes']
          ].map(([field, label]) => <label key={field}>{label}
            <input required={['bank_name', 'account_name', 'account_number'].includes(field)}
              value={bankForm[field]}
              onChange={e => setBankForm({ ...bankForm, [field]: e.target.value })} />
          </label>)}
        </div>
        <button disabled={busy}>Save bank details</button>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>Bank</th><th>Account holder</th><th>Account no.</th>
          <th>IFSC / UPI</th><th>Actions</th></tr></thead>
        <tbody>{banks.map(b => <tr key={b.id}>
          <td>{b.bank_name}<small>{b.branch || '—'}</small></td>
          <td>{b.account_name}</td>
          <td>{b.account_number}</td>
          <td>{b.ifsc || '—'}<small>{b.upi_id || '—'}</small></td>
          <td><button className="small danger" onClick={() => deleteBank(b.id)}>Delete</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    {tab === 'invoices' && <section className="card">
      <h2>Create Invoice</h2>
      <form onSubmit={saveInvoice}>
        <div className="grid">
          <label>Customer
            <select required value={invoiceForm.customer_id}
              onChange={e => setInvoiceForm({ ...invoiceForm, customer_id: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>
                {c.full_name}{c.business_name ? ` — ${c.business_name}` : ''}
              </option>)}
            </select>
          </label>
          <label>Invoice number
            <input required value={invoiceForm.invoice_number}
              onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} />
          </label>
          <label>Invoice date
            <input type="date" required value={invoiceForm.invoice_date}
              onChange={e => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} />
          </label>
          <label>Due date
            <input type="date" value={invoiceForm.due_date}
              onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
          </label>
          <label>Amount before GST (₹)
            <input type="number" min="0.01" step="0.01" required value={invoiceForm.amount}
              onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
          </label>
          <label>GST rate (%)
            <input type="number" min="0" max="100" step="0.01" required value={invoiceForm.gst_rate}
              onChange={e => setInvoiceForm({ ...invoiceForm, gst_rate: e.target.value })} />
          </label>
          <label>Description
            <textarea rows="2" value={invoiceForm.description}
              onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
          </label>
        </div>
        <p>GST: {money(Number(invoiceForm.amount || 0) * Number(invoiceForm.gst_rate || 0) / 100)}
          {' · '}Total: {money(Number(invoiceForm.amount || 0) * (1 + Number(invoiceForm.gst_rate || 0) / 100))}</p>
        <button disabled={busy || customers.length === 0}>Save invoice</button>
      </form>

      <h3>Invoices</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th>
          <th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead>
        <tbody>{invoices.map(inv => <tr key={inv.id}>
          <td>{inv.invoice_number}<small>{inv.status}</small></td>
          <td>{customerName(inv.customer_id)}</td>
          <td>{inv.invoice_date}</td>
          <td>{money(invoiceTotal(inv))}</td>
          <td>{money(invoicePaid(inv.id))}</td>
          <td>{money(invoiceDue(inv))}</td>
          <td>
            <button className="small" onClick={() => printInvoice(inv)}>Print / PDF</button>
            {isAdmin && inv.status !== 'Cancelled' &&
              <button className="small danger" onClick={() => cancelInvoice(inv)}>Cancel</button>}
          </td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    {tab === 'payments' && <section className="card">
      <h2>Record Payment</h2>
      <form onSubmit={savePayment}>
        <div className="grid">
          <label>Invoice
            <select required value={paymentForm.invoice_id}
              onChange={e => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}>
              <option value="">Select invoice</option>
              {invoices.filter(i => i.status !== 'Cancelled' && invoiceDue(i) > 0)
                .map(i => <option key={i.id} value={i.id}>
                  {i.invoice_number} — {customerName(i.customer_id)} — Due {money(invoiceDue(i))}
                </option>)}
            </select>
          </label>
          <label>Payment date
            <input type="date" required value={paymentForm.payment_date}
              onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
          </label>
          <label>Amount (₹)
            <input type="number" min="0.01" step="0.01" required value={paymentForm.amount}
              onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
          </label>
          <label>Payment method
            <select value={paymentForm.method}
              onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}>
              {['Bank transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other']
                .map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>Reference / transaction ID
            <input value={paymentForm.reference}
              onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
          </label>
          <label>Notes
            <input value={paymentForm.notes}
              onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
          </label>
        </div>
        <button disabled={busy || invoices.length === 0}>Save payment</button>
      </form>

      <h3>Payment History</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Date</th><th>Invoice ID</th><th>Method</th>
          <th>Reference</th><th>Amount</th></tr></thead>
        <tbody>{payments.map(p => <tr key={p.id}>
          <td>{p.payment_date}</td>
          <td>{invoices.find(i => i.id === p.invoice_id)?.invoice_number || '—'}</td>
          <td>{p.method}</td><td>{p.reference || '—'}</td><td>{money(p.amount)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}

    {tab === 'reports' && <section className="card">
      <h2>Reports</h2>
      <div className="stats">
        <div className="stat"><span>Total customers</span><b>{customers.length}</b></div>
        <div className="stat"><span>Active invoices</span>
          <b>{invoices.filter(i => i.status !== 'Cancelled').length}</b></div>
        <div className="stat"><span>Total billed incl. GST</span><b>{money(totalBilled)}</b></div>
        <div className="stat"><span>Total payments</span><b>{money(totalCollected)}</b></div>
        <div className="stat"><span>Total outstanding</span><b>{money(totalOutstanding)}</b></div>
      </div>
      <h3>Outstanding Invoices</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
        <tbody>{invoices.filter(i => i.status !== 'Cancelled' && invoiceDue(i) > 0)
          .map(i => <tr key={i.id}>
            <td>{i.invoice_number}</td><td>{customerName(i.customer_id)}</td>
            <td>{money(invoiceTotal(i))}</td><td>{money(invoicePaid(i.id))}</td>
            <td>{money(invoiceDue(i))}</td>
          </tr>)}</tbody>
      </table></div>
      <button onClick={() => window.print()}>Print / Save report as PDF</button>
      <button className="secondary" onClick={loadData}>Refresh data</button>
    </section>}

    <footer>SANTU BUSINESS SERVICES · Your Outsourced Operations Partner</footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
