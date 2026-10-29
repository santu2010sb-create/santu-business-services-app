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
const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const blankCustomer = {
  full_name: '', business_name: '', mobile: '', email: '', address: '', notes: '',
};
const blankBank = {
  bank_name: '', account_name: '', account_number: '', ifsc: '', branch: '', upi_id: '', notes: '',
};
const blankInvoice = {
  customer_id: '', invoice_number: '', invoice_date: today(), due_date: '',
  description: '', amount: '', gst_rate: '5', status: 'Unpaid',
};
const blankPayment = {
  invoice_id: '', transaction_type: 'Received', from_name: '', to_name: '', purpose: '',
  payment_date: today(), amount: '', method: 'Bank transfer', reference: '', notes: '',
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
    setTabHistory((previous) => [...previous, tab]);
    setTab(nextTab);
    setMsg('');
  }

  function goBack() {
    if (tabHistory.length > 0) {
      setTab(tabHistory[tabHistory.length - 1]);
      setTabHistory((previous) => previous.slice(0, -1));
    } else {
      setTab('customers');
    }
    setMsg('');
  }

  function goHome() {
    setTabHistory([]);
    setTab('customers');
    setMsg('');
  }

  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankCustomer);

  const [bankOpen, setBankOpen] = useState(false);
  const [bankEditing, setBankEditing] = useState(null);
  const [bankForm, setBankForm] = useState(blankBank);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceEditing, setInvoiceEditing] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState(blankInvoice);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(blankPayment);

  useEffect(() => {
    if (!client) {
      setChecking(false);
      return undefined;
    }

    let active = true;

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setMsg(error.message);
      setSession(data?.session || null);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadData(currentSession) {
    if (!client || !currentSession) return;

    setBusy(true);
    setMsg('');

    const roleResult = await client
      .from('app_roles')
      .select('role')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    if (roleResult.error) {
      setMsg(`Role যাচাই হয়নি: ${roleResult.error.message}`);
      setRole('');
      setBusy(false);
      return;
    }

    const nextRole = roleResult.data?.role || 'no-role';
    setRole(nextRole);

    if (nextRole === 'no-role') {
      setBusy(false);
      return;
    }

    const [customerResult, bankResult, invoiceResult, paymentResult] =
      await Promise.all([
        client.from('customers')
          .select('*')
          .order('created_at', { ascending: false }),

        client.from('bank_details')
          .select('*')
          .order('created_at', { ascending: false }),

        client.from('invoices')
          .select('*')
          .order('invoice_date', { ascending: false }),

        client.from('payments')
          .select('*')
          .order('payment_date', { ascending: false }),
      ]);

    const errors = [
      ['Customers', customerResult.error],
      ['Bank Details', bankResult.error],
      ['Invoices', invoiceResult.error],
      ['Payments', paymentResult.error],
    ].filter((item) => item[1]);

    setCustomers(customerResult.error ? [] : (customerResult.data || []));
    setBanks(bankResult.error ? [] : (bankResult.data || []));
    setInvoices(invoiceResult.error ? [] : (invoiceResult.data || []));
    setPayments(paymentResult.error ? [] : (paymentResult.data || []));

    if (errors.length) {
      setMsg(
        `${errors.map(([name, error]) => `${name}: ${error.message}`).join(' | ')}`
      );
    }

    setBusy(false);
  }

  useEffect(() => {
    if (session && client) {
      loadData(session);
    } else {
      setRole('');
      setCustomers([]);
      setBanks([]);
      setInvoices([]);
      setPayments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const shownCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();

    return customers.filter((customer) =>
      !q || [
        customer.full_name,
        customer.business_name,
        customer.mobile,
        customer.email,
      ].some((value) => String(value || '').toLowerCase().includes(q))
    );
  }, [customers, search]);

  const customerName = (id) =>
    customers.find((customer) => String(customer.id) === String(id))
      ?.full_name || 'Customer not found';

  const paidForInvoice = (invoiceId) =>
    payments
      .filter((payment) =>
        (payment.transaction_type || 'Received') === 'Received' &&
        String(payment.invoice_id) === String(invoiceId)
      )
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  const invoiceTotal = (invoice) => {
    const amount = Number(invoice.amount) || 0;
    const gst = Number(invoice.gst_rate) || 0;
    return amount + (amount * gst / 100);
  };

  const invoiceBalance = (invoice) =>
    Math.max(0, invoiceTotal(invoice) - paidForInvoice(invoice.id));

  const report = useMemo(() => {
    const billed = invoices
      .filter((invoice) => invoice.status !== 'Cancelled')
      .reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);

    const collected = payments
      .filter((payment) => (payment.transaction_type || 'Received') === 'Received')
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const expenses = payments
      .filter((payment) => payment.transaction_type === 'Paid')
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    const outstanding = invoices
      .filter((invoice) => invoice.status !== 'Cancelled')
      .reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);

    return { billed, collected, expenses, outstanding };
  }, [invoices, payments]);

  async function login(event) {
    event.preventDefault();

    if (!client) {
      setMsg('আগে Supabase project connect করুন।');
      return;
    }

    setBusy(true);
    setMsg('');

    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setMsg(error.message);
    } else {
      setPassword('');
    }
  }

  async function logout() {
    if (!client) return;

    const { error } = await client.auth.signOut();

    if (error) setMsg(error.message);
  }

  function connectProject() {
    if (!url.trim().startsWith('https://') || !key.trim()) {
      setMsg('সঠিক Project URL ও public/anon key দিন।');
      return;
    }

    if (/service_role|secret/i.test(key)) {
      setMsg('Secret/service_role key ব্যবহার করবেন না। শুধু public/anon/publishable key দিন।');
      return;
    }

    localStorage.setItem('sbs_project_url', url.trim());
    localStorage.setItem('sbs_public_key', key.trim());
    window.location.reload();
  }

  async function saveCustomer(event) {
    event.preventDefault();
    if (!session) return;

    setBusy(true);
    setMsg('');

    const payload = { ...form, owner_id: session.user.id };

    const result = editing
      ? await client.from('customers')
          .update(payload).eq('id', editing).select().single()
      : await client.from('customers')
          .insert(payload).select().single();

    setBusy(false);

    if (result.error) {
      setMsg(`Customer save failed: ${result.error.message}`);
      return;
    }

    setCustomers((previous) =>
      editing
        ? previous.map((item) =>
            String(item.id) === String(editing) ? result.data : item
          )
        : [result.data, ...previous]
    );

    setFormOpen(false);
    setEditing(null);
    setForm(blankCustomer);
    setMsg('Customer সংরক্ষিত হয়েছে।');
  }

  async function deleteCustomer(id) {
    if (!window.confirm('এই Customer record মুছবেন?')) return;

    const { error } = await client.from('customers').delete().eq('id', id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setCustomers((previous) =>
      previous.filter((item) => String(item.id) !== String(id))
    );
    setMsg('Customer মুছে ফেলা হয়েছে।');
  }

  async function saveBank(event) {
    event.preventDefault();
    if (!session) return;

    setBusy(true);
    setMsg('');

    const payload = { ...bankForm, owner_id: session.user.id };

    const result = bankEditing
      ? await client.from('bank_details')
          .update(payload).eq('id', bankEditing).select().single()
      : await client.from('bank_details')
          .insert(payload).select().single();

    setBusy(false);

    if (result.error) {
      setMsg(`Bank Details save failed: ${result.error.message}`);
      return;
    }

    setBanks((previous) =>
      bankEditing
        ? previous.map((item) =>
            String(item.id) === String(bankEditing) ? result.data : item
          )
        : [result.data, ...previous]
    );

    setBankOpen(false);
    setBankEditing(null);
    setBankForm(blankBank);
    setMsg('Bank Details সংরক্ষিত হয়েছে।');
  }

  async function deleteBank(id) {
    if (!window.confirm('এই Bank Details মুছবেন?')) return;

    const { error } = await client.from('bank_details').delete().eq('id', id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setBanks((previous) =>
      previous.filter((item) => String(item.id) !== String(id))
    );
    setMsg('Bank Details মুছে ফেলা হয়েছে।');
  }

  async function saveInvoice(event) {
    event.preventDefault();
    if (!session) return;

    if (!invoiceForm.customer_id) {
      setMsg('Invoice-এর জন্য Customer বেছে নিন।');
      return;
    }

    const amount = Number(invoiceForm.amount);
    const gstRate = Number(invoiceForm.gst_rate);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(gstRate) ||
      gstRate < 0
    ) {
      setMsg('সঠিক amount ও GST rate দিন।');
      return;
    }

    setBusy(true);
    setMsg('');

    const payload = {
      ...invoiceForm,
      amount,
      gst_rate: gstRate,
      owner_id: session.user.id,
      invoice_number: invoiceForm.invoice_number.trim() ||
        `SBS-${Date.now().toString().slice(-8)}`,
    };

    const result = invoiceEditing
      ? await client.from('invoices')
          .update(payload).eq('id', invoiceEditing).select().single()
      : await client.from('invoices')
          .insert(payload).select().single();

    setBusy(false);

    if (result.error) {
      setMsg(`Invoice save failed: ${result.error.message}`);
      return;
    }

    setInvoices((previous) =>
      invoiceEditing
        ? previous.map((item) =>
            String(item.id) === String(invoiceEditing) ? result.data : item
          )
        : [result.data, ...previous]
    );

    setInvoiceOpen(false);
    setInvoiceEditing(null);
    setInvoiceForm(blankInvoice);
    setMsg('Invoice সংরক্ষিত হয়েছে।');
  }

  async function deleteInvoice(id) {
    const hasPayments = payments.some(
      (payment) => String(payment.invoice_id) === String(id)
    );

    if (hasPayments) {
      setMsg('এই Invoice-এ payment আছে। আগে payment record যাচাই করুন; invoice মুছবেন না।');
      return;
    }

    if (!window.confirm('এই Invoice মুছবেন?')) return;

    const { error } = await client.from('invoices').delete().eq('id', id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setInvoices((previous) =>
      previous.filter((item) => String(item.id) !== String(id))
    );
    setMsg('Invoice মুছে ফেলা হয়েছে।');
  }

  async function savePayment(event) {
    event.preventDefault();
    if (!session) return;

    const amount = Number(paymentForm.amount);
    const isReceived = (paymentForm.transaction_type || 'Received') === 'Received';

    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg('সঠিক payment amount দিন।');
      return;
    }

    if (!paymentForm.purpose.trim()) {
      setMsg('Payment-এর Purpose লিখুন।');
      return;
    }

    if (isReceived && !paymentForm.invoice_id) {
      setMsg('টাকা Received হলে Invoice নির্বাচন করুন।');
      return;
    }

    if (isReceived) {
      const invoice = invoices.find(
        (item) => String(item.id) === String(paymentForm.invoice_id)
      );

      if (!invoice) {
        setMsg('নির্বাচিত Invoice পাওয়া যায়নি।');
        return;
      }

      if (amount > invoiceBalance(invoice) + 0.005) {
        setMsg(`Payment amount বকেয়ার চেয়ে বেশি। বর্তমান বকেয়া ${money(invoiceBalance(invoice))}।`);
        return;
      }
    }

    setBusy(true);
    setMsg('');

    const result = await client.from('payments')
      .insert({
        ...paymentForm,
        invoice_id: isReceived ? paymentForm.invoice_id : null,
        amount,
        owner_id: session.user.id,
      })
      .select()
      .single();

    setBusy(false);

    if (result.error) {
      setMsg(`Payment save failed: ${result.error.message}`);
      return;
    }

    setPayments((previous) => [result.data, ...previous]);
    setPaymentOpen(false);
    setPaymentForm(blankPayment);
    setMsg('Payment সংরক্ষিত হয়েছে।');
  }

  async function deletePayment(id) {
    if (!window.confirm('এই payment record মুছবেন?')) return;

    const { error } = await client.from('payments').delete().eq('id', id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setPayments((previous) =>
      previous.filter((item) => String(item.id) !== String(id))
    );
    setMsg('Payment record মুছে ফেলা হয়েছে।');
  }

  function printInvoice(invoice) {
    const customer = customers.find(
      (item) => String(item.id) === String(invoice.customer_id)
    );
    const bank = banks[0];
    const paid = paidForInvoice(invoice.id);
    const total = invoiceTotal(invoice);

    const popup = window.open('', '_blank', 'width=800,height=900');

    if (!popup) {
      setMsg('PDF/Print window blocked. Browser pop-up permission চালু করুন।');
      return;
    }

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

    popup.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${esc(invoice.invoice_number)}</title>
<style>
body{font:14px Arial,sans-serif;margin:40px;color:#222}
h1{margin-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:24px}
td,th{padding:12px;border:1px solid #ccc;text-align:left}
.right{text-align:right}
.muted{color:#555}
@media print{button{display:none}}
</style>
</head>
<body>
<h1>SANTU BUSINESS SERVICES</h1>
<p class="muted">YOUR OUTSOURCED OPERATIONS PARTNER</p>
<hr>
<h2>INVOICE</h2>
<p><b>Invoice No:</b> ${esc(invoice.invoice_number)}<br>
<b>Invoice Date:</b> ${esc(invoice.invoice_date)}<br>
<b>Due Date:</b> ${esc(invoice.due_date || '—')}</p>
<p><b>Bill To:</b> ${esc(customer?.full_name || 'Customer')}<br>
${esc(customer?.business_name || '')}<br>
${esc(customer?.address || '')}<br>
${esc(customer?.mobile || '')}</p>
<table>
<thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
<tbody>
<tr><td>${esc(invoice.description || 'Services')}</td><td class="right">${money(invoice.amount)}</td></tr>
<tr><td>GST (${esc(invoice.gst_rate)}%)</td><td class="right">${money(Number(invoice.amount) * Number(invoice.gst_rate) / 100)}</td></tr>
<tr><th>Total</th><th class="right">${money(total)}</th></tr>
<tr><td>Paid</td><td class="right">${money(paid)}</td></tr>
<tr><th>Balance Due</th><th class="right">${money(Math.max(0, total - paid))}</th></tr>
</tbody>
</table>
${bank ? `<h3>Bank Details</h3>
<p>${esc(bank.bank_name)}<br>
Account name: ${esc(bank.account_name)}<br>
Account number: ${esc(bank.account_number)}<br>
IFSC: ${esc(bank.ifsc)}<br>
UPI: ${esc(bank.upi_id)}</p>` : ''}
<p class="muted">Thank you for your business.</p>
<button onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`);

    popup.document.close();
  }

  function downloadReport() {
    const rows = [
      ['Report', 'SANTU BUSINESS SERVICES'],
      ['Generated on', today()],
      ['Total customers', customers.length],
      ['Total invoices (including GST)', report.billed.toFixed(2)],
      ['Total payments received', report.collected.toFixed(2)],
      ['Total paid / expenses', report.expenses.toFixed(2)],
      ['Outstanding balance', report.outstanding.toFixed(2)],
      [],
      ['Invoice No', 'Date', 'Customer', 'Amount before GST', 'GST %', 'Invoice total', 'Received', 'Balance'],
      ...invoices.map((invoice) => [
        invoice.invoice_number,
        invoice.invoice_date,
        customerName(invoice.customer_id),
        Number(invoice.amount || 0).toFixed(2),
        Number(invoice.gst_rate || 0),
        invoiceTotal(invoice).toFixed(2),
        paidForInvoice(invoice.id).toFixed(2),
        invoiceBalance(invoice).toFixed(2),
      ]),
      [],
      ['Date', 'Type', 'From', 'To', 'Purpose', 'Method', 'Reference', 'Amount'],
      ...payments.map((payment) => [
        payment.payment_date,
        payment.transaction_type || 'Received',
        payment.from_name,
        payment.to_name,
        payment.purpose,
        payment.method,
        payment.reference,
        Number(payment.amount || 0).toFixed(2),
      ]),
    ];

    const csv = rows.map((row) =>
      row.map((cell) => {
        const value = String(cell ?? '');
        return `"${value.replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob(['\ufeff', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `sbs-report-${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  if (checking) {
    return <main className="center">Checking session…</main>;
  }

  if (config || !client) {
    return <main className="wrap">
      <header className="hero">
        <small>YOUR OUTSOURCED OPERATIONS PARTNER</small>
        <h1>SANTU BUSINESS SERVICES</h1>
        <p>Business Management App</p>
      </header>
      <section className="card">
        <h2>Connect Supabase</h2>
        <p>Supabase Project URL এবং public/anon/publishable key দিন। <b>service_role/secret key কখনও দেবেন না।</b></p>
        <label>Project URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://project.supabase.co" />
        </label>
        <label>Public / anon key
          <textarea rows="3" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Public key" />
        </label>
        <button onClick={connectProject}>Connect project</button>
        {msg && <p className="msg">{msg}</p>}
        <p className="muted">এই কনফিগারেশন শুধু এই browser-এ থাকবে।</p>
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
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>Password
            <input required type="password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button disabled={busy}>{busy ? 'Please wait…' : 'Login'}</button>
        </form>
        <button className="secondary" onClick={() => setConfig(true)}>Supabase settings</button>
        {msg && <p className="msg">{msg}</p>}
      </section>
    </main>;
  }

  if (role === 'no-role') {
    return <main className="wrap">
      <section className="hero"><h1>Access pending</h1></section>
      <section className="card">
        <h2>Admin/Staff role নেই</h2>
        <p>এই Auth User ID-র জন্য app_roles টেবিলে role যোগ করুন।</p>
        <code>{session.user.id}</code>
        <button className="secondary" onClick={logout}>Logout</button>
      </section>
    </main>;
  }

  return <main className="app">
    <header className="hero">
      <small>YOUR OUTSOURCED OPERATIONS PARTNER</small>
      <div className="hero-row">
        <div>
          <h1>SANTU BUSINESS SERVICES</h1>
          <p>Business Management Dashboard</p>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={goHome}>Home</button>
          <button className="secondary" onClick={logout}>Logout</button>
        </div>
      </div>
    </header>

    <section className="stats">
      <div className="stat"><span>Total customers</span><b>{customers.length}</b></div>
      <div className="stat"><span>Invoices</span><b>{invoices.length}</b></div>
      <div className="stat"><span>Payments received</span><b>{money(report.collected)}</b></div>
      <div className="stat"><span>Paid / expenses</span><b>{money(report.expenses)}</b></div>
      <div className="stat"><span>Outstanding</span><b>{money(report.outstanding)}</b></div>
    </section>

    <div className="card nav-tabs">
      <button className="secondary" onClick={goBack}>← Back</button>
      <button className="secondary" onClick={goHome}>🏠 Home</button>
    </div>

    <nav className="features" aria-label="App sections">
      {[
        ['customers', 'Customers'],
        ['banks', 'Bank Details'],
        ['invoices', 'Invoices & PDF'],
        ['payments', 'Payments'],
        ['reports', 'Reports'],
      ].map(([value, label]) => (
        <button
          key={value}
          className={tab === value ? '' : 'secondary'}
          onClick={() => goToTab(value)}
        >
          {label}
        </button>
      ))}
    </nav>

    {msg && <div className="message" role="status">
      {msg}<button onClick={() => setMsg('')}>×</button>
    </div>}

    {busy && <p className="muted">Loading / saving…</p>}

    {tab === 'customers' && <section className="card">
      <div className="section-title">
        <div><h2>Customer Master</h2><p>Customer যোগ করুন, খুঁজুন, Edit করুন।</p></div>
        <button onClick={() => {
          setEditing(null);
          setForm({ ...blankCustomer });
          setFormOpen(!formOpen);
        }}>+ Add customer</button>
      </div>

      {formOpen && <form onSubmit={saveCustomer}>
        <h3>{editing ? 'Edit Customer' : 'New Customer'}</h3>
        <div className="grid">
          {[
            ['full_name', 'Full name *'],
            ['business_name', 'Business name'],
            ['mobile', 'Mobile number'],
            ['email', 'Email'],
            ['address', 'Address'],
            ['notes', 'Notes'],
          ].map(([field, label]) => (
            <label key={field}>{label}
              {field === 'address' || field === 'notes'
                ? <textarea rows="2" value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
                : <input required={field === 'full_name'} type={field === 'email' ? 'email' : 'text'} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />
              }
            </label>
          ))}
        </div>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save customer'}</button>
        <button type="button" className="secondary" onClick={() => {
          setFormOpen(false);
          setEditing(null);
        }}>Cancel</button>
      </form>}

      <input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, business, mobile or email" />

      {shownCustomers.length === 0 ? <div className="empty">No customers found yet.</div> :
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name / Business</th><th>Mobile / Email</th><th>Address</th><th>Actions</th></tr></thead>
            <tbody>
              {shownCustomers.map((customer) => <tr key={customer.id}>
                <td><b>{customer.full_name}</b><small>{customer.business_name || '—'}</small></td>
                <td>{customer.mobile || '—'}<small>{customer.email || '—'}</small></td>
                <td>{customer.address || '—'}</td>
                <td>
                  <button className="small" onClick={() => {
                    setEditing(customer.id);
                    setForm({
                      full_name: customer.full_name || '',
                      business_name: customer.business_name || '',
                      mobile: customer.mobile || '',
                      email: customer.email || '',
                      address: customer.address || '',
                      notes: customer.notes || '',
                    });
                    setFormOpen(true);
                  }}>Edit</button>
                  {role === 'admin' && <button className="small danger" onClick={() => deleteCustomer(customer.id)}>Delete</button>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>}
    </section>}

    {tab === 'banks' && <section className="card">
      <div className="section-title">
        <div><h2>Bank Details</h2><p>ব্যাংক ও payment গ্রহণের তথ্য।</p></div>
        <button onClick={() => {
          setBankEditing(null);
          setBankForm({ ...blankBank });
          setBankOpen(!bankOpen);
        }}>+ Add bank</button>
      </div>

      {bankOpen && <form onSubmit={saveBank}>
        <h3>{bankEditing ? 'Edit Bank Details' : 'New Bank Details'}</h3>
        <div className="grid">
          {[
            ['bank_name', 'Bank name *'],
            ['account_name', 'Account holder *'],
            ['account_number', 'Account number *'],
            ['ifsc', 'IFSC'],
            ['branch', 'Branch'],
            ['upi_id', 'UPI ID'],
            ['notes', 'Notes'],
          ].map(([field, label]) => (
            <label key={field}>{label}
              {field === 'notes'
                ? <textarea rows="2" value={bankForm[field]} onChange={(event) => setBankForm({ ...bankForm, [field]: event.target.value })} />
                : <input required={['bank_name', 'account_name', 'account_number'].includes(field)} value={bankForm[field]} onChange={(event) => setBankForm({ ...bankForm, [field]: event.target.value })} />
              }
            </label>
          ))}
        </div>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save bank'}</button>
        <button type="button" className="secondary" onClick={() => setBankOpen(false)}>Cancel</button>
      </form>}

      {banks.length === 0 ? <div className="empty">No bank details yet.</div> :
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bank / Holder</th><th>Account</th><th>IFSC / Branch</th><th>UPI</th><th>Actions</th></tr></thead>
            <tbody>
              {banks.map((bank) => <tr key={bank.id}>
                <td><b>{bank.bank_name}</b><small>{bank.account_name}</small></td>
                <td>{bank.account_number}</td>
                <td>{bank.ifsc || '—'}<small>{bank.branch || '—'}</small></td>
                <td>{bank.upi_id || '—'}</td>
                <td>
                  <button className="small" onClick={() => {
                    setBankEditing(bank.id);
                    setBankForm({
                      bank_name: bank.bank_name || '',
                      account_name: bank.account_name || '',
                      account_number: bank.account_number || '',
                      ifsc: bank.ifsc || '',
                      branch: bank.branch || '',
                      upi_id: bank.upi_id || '',
                      notes: bank.notes || '',
                    });
                    setBankOpen(true);
                  }}>Edit</button>
                  {role === 'admin' && <button className="small danger" onClick={() => deleteBank(bank.id)}>Delete</button>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      <p className="muted">শুধু প্রয়োজনীয় ব্যাংক তথ্য রাখুন এবং RLS policy যাচাই করুন।</p>
    </section>}

    {tab === 'invoices' && <section className="card">
      <div className="section-title">
        <div><h2>Invoices & PDF</h2><p>Invoice তৈরি করুন এবং Print / Save as PDF ব্যবহার করুন।</p></div>
        <button onClick={() => {
          setInvoiceEditing(null);
          setInvoiceForm({ ...blankInvoice });
          setInvoiceOpen(!invoiceOpen);
        }}>+ New invoice</button>
      </div>

      {invoiceOpen && <form onSubmit={saveInvoice}>
        <h3>{invoiceEditing ? 'Edit Invoice' : 'New Invoice'}</h3>
        <div className="grid">
          <label>Customer *
            <select required value={invoiceForm.customer_id} onChange={(event) => setInvoiceForm({ ...invoiceForm, customer_id: event.target.value })}>
              <option value="">Select customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>
                {customer.full_name}{customer.business_name ? ` — ${customer.business_name}` : ''}
              </option>)}
            </select>
          </label>
          <label>Invoice number
            <input value={invoiceForm.invoice_number} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_number: event.target.value })} placeholder="Auto-generated if blank" />
          </label>
          <label>Invoice date
            <input type="date" required value={invoiceForm.invoice_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, invoice_date: event.target.value })} />
          </label>
          <label>Due date
            <input type="date" value={invoiceForm.due_date} onChange={(event) => setInvoiceForm({ ...invoiceForm, due_date: event.target.value })} />
          </label>
          <label>Amount before GST (₹) *
            <input type="number" min="0.01" step="0.01" required value={invoiceForm.amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: event.target.value })} />
          </label>
          <label>GST rate (%)
            <select value={invoiceForm.gst_rate} onChange={(event) => setInvoiceForm({ ...invoiceForm, gst_rate: event.target.value })}>
              <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
            </select>
          </label>
          <label>Status
            <select value={invoiceForm.status} onChange={(event) => setInvoiceForm({ ...invoiceForm, status: event.target.value })}>
              <option>Unpaid</option><option>Part-paid</option><option>Paid</option><option>Cancelled</option>
            </select>
          </label>
          <label>Description
            <input value={invoiceForm.description} onChange={(event) => setInvoiceForm({ ...invoiceForm, description: event.target.value })} />
          </label>
        </div>
        {invoiceForm.amount !== '' && <p><b>Estimated total:</b> {money(Number(invoiceForm.amount) * (1 + Number(invoiceForm.gst_rate || 0) / 100))}</p>}
        <button disabled={busy || customers.length === 0}>{busy ? 'Saving…' : 'Save invoice'}</button>
        <button type="button" className="secondary" onClick={() => setInvoiceOpen(false)}>Cancel</button>
      </form>}

      {invoices.length === 0 ? <div className="empty">No invoices yet.</div> :
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map((invoice) => <tr key={invoice.id}>
                <td><b>{invoice.invoice_number || '—'}</b><small>{invoice.status || 'Unpaid'}</small></td>
                <td>{customerName(invoice.customer_id)}</td>
                <td>{invoice.invoice_date || '—'}</td>
                <td>{money(invoiceTotal(invoice))}</td>
                <td>{money(paidForInvoice(invoice.id))}</td>
                <td>{money(invoiceBalance(invoice))}</td>
                <td>
                  <button className="small" onClick={() => printInvoice(invoice)}>PDF / Print</button>
                  <button className="small" onClick={() => {
                    setInvoiceEditing(invoice.id);
                    setInvoiceForm({
                      customer_id: String(invoice.customer_id || ''),
                      invoice_number: invoice.invoice_number || '',
                      invoice_date: invoice.invoice_date || today(),
                      due_date: invoice.due_date || '',
                      description: invoice.description || '',
                      amount: String(invoice.amount ?? ''),
                      gst_rate: String(invoice.gst_rate ?? 5),
                      status: invoice.status || 'Unpaid',
                    });
                    setInvoiceOpen(true);
                  }}>Edit</button>
                  {role === 'admin' && invoice.status !== 'Cancelled' &&
                    <button className="small danger" onClick={() => {
                      if (window.confirm('এই Invoice cancel করবেন?')) {
                        client.from('invoices').update({ status: 'Cancelled' }).eq('id', invoice.id)
                          .then(({ error }) => {
                            if (error) setMsg(error.message);
                            else {
                              setInvoices((previous) => previous.map((item) =>
                                String(item.id) === String(invoice.id)
                                  ? { ...item, status: 'Cancelled' }
                                  : item
                              ));
                              setMsg('Invoice cancelled.');
                            }
                          });
                      }
                    }}>Cancel</button>}
                  {role === 'admin' && <button className="small danger" onClick={() => deleteInvoice(invoice.id)}>Delete</button>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>}
    </section>}

    {tab === 'payments' && <section className="card">
      <div className="section-title">
        <div><h2>Payments</h2><p>Received এবং Paid transaction আলাদা করে রাখুন।</p></div>
        <button onClick={() => {
          setPaymentForm({ ...blankPayment });
          setPaymentOpen(!paymentOpen);
        }}>+ Record payment</button>
      </div>

      {paymentOpen && <form onSubmit={savePayment}>
        <h3>Record payment</h3>
        <div className="grid">
          <label>Transaction type *
            <select required value={paymentForm.transaction_type}
              onChange={(event) => setPaymentForm({
                ...paymentForm,
                transaction_type: event.target.value,
                invoice_id: event.target.value === 'Paid' ? '' : paymentForm.invoice_id,
              })}>
              <option value="Received">Received (টাকা পেলাম)</option>
              <option value="Paid">Paid (টাকা দিলাম)</option>
            </select>
          </label>

          <label>From (কার কাছ থেকে)
            <input value={paymentForm.from_name}
              onChange={(event) => setPaymentForm({ ...paymentForm, from_name: event.target.value })}
              placeholder="Customer / Supplier / Other" />
          </label>

          <label>To (কাকে)
            <input value={paymentForm.to_name}
              onChange={(event) => setPaymentForm({ ...paymentForm, to_name: event.target.value })}
              placeholder="Business / Driver / Other" />
          </label>

          <label>Purpose (কেন) *
            <input required value={paymentForm.purpose}
              onChange={(event) => setPaymentForm({ ...paymentForm, purpose: event.target.value })}
              placeholder="Payment reason" />
          </label>

          <label>Invoice {paymentForm.transaction_type === 'Received' ? '*' : '(Paid হলে ঐচ্ছিক)'}
            <select required={paymentForm.transaction_type === 'Received'}
              value={paymentForm.invoice_id}
              onChange={(event) => setPaymentForm({ ...paymentForm, invoice_id: event.target.value })}>
              <option value="">Select invoice</option>
              {invoices.filter((invoice) =>
                invoice.status !== 'Cancelled' && invoiceBalance(invoice) > 0
              ).map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} — {customerName(invoice.customer_id)} — Due {money(invoiceBalance(invoice))}
                </option>
              ))}
            </select>
          </label>

          <label>Payment date *
            <input type="date" required value={paymentForm.payment_date}
              onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} />
          </label>

          <label>Amount (₹) *
            <input type="number" min="0.01" step="0.01" required value={paymentForm.amount}
              onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
          </label>

          <label>Payment method
            <select value={paymentForm.method}
              onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}>
              {['Bank transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'].map((method) =>
                <option key={method}>{method}</option>
              )}
            </select>
          </label>

          <label>Reference / UTR
            <input value={paymentForm.reference}
              onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} />
          </label>

          <label>Notes
            <input value={paymentForm.notes}
              onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
          </label>
        </div>

        <button disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
        <button type="button" className="secondary" onClick={() => setPaymentOpen(false)}>Cancel</button>
      </form>}

      {payments.length === 0 ? <div className="empty">No payments recorded yet.</div> :
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>From</th><th>To</th>
                <th>Purpose</th><th>Invoice</th><th>Customer</th>
                <th>Method / Reference</th><th>Amount</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const invoice = invoices.find((item) =>
                  String(item.id) === String(payment.invoice_id)
                );
                return <tr key={payment.id}>
                  <td>{payment.payment_date || '—'}</td>
                  <td>{payment.transaction_type || 'Received'}</td>
                  <td>{payment.from_name || '—'}</td>
                  <td>{payment.to_name || '—'}</td>
                  <td>{payment.purpose || payment.notes || '—'}</td>
                  <td>{invoice?.invoice_number || (payment.invoice_id ? 'Invoice not found' : '—')}</td>
                  <td>{invoice ? customerName(invoice.customer_id) : '—'}</td>
                  <td>{payment.method || '—'}<small>{payment.reference || '—'}</small></td>
                  <td>{money(payment.amount)}</td>
                  <td>
                    {role === 'admin' && <button className="small danger" onClick={() => deletePayment(payment.id)}>Delete</button>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
    </section>}

    {tab === 'reports' && <section className="card">
      <div className="section-title">
        <div><h2>Reports</h2><p>Received, expenses এবং outstanding-এর সারাংশ।</p></div>
        <button onClick={downloadReport}>Export CSV report</button>
      </div>

      <div className="stats">
        <div className="stat"><span>Total invoices incl. GST</span><b>{money(report.billed)}</b></div>
        <div className="stat"><span>Total received</span><b>{money(report.collected)}</b></div>
        <div className="stat"><span>Total paid / expenses</span><b>{money(report.expenses)}</b></div>
        <div className="stat"><span>Total outstanding</span><b>{money(report.outstanding)}</b></div>
      </div>

      {invoices.length === 0 ? <div className="empty">Report তৈরি করতে আগে invoice যোগ করুন।</div> :
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Received</th><th>Balance</th></tr></thead>
            <tbody>
              {invoices.filter((invoice) => invoice.status !== 'Cancelled').map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>
                  <td>{customerName(invoice.customer_id)}</td>
                  <td>{money(invoiceTotal(invoice))}</td>
                  <td>{money(paidForInvoice(invoice.id))}</td>
                  <td>{money(invoiceBalance(invoice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </section>}

    <footer>SANTU BUSINESS SERVICES · Your Outsourced Operations Partner</footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
