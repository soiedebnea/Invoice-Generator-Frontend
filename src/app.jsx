import React, { useEffect, useState } from 'react';
import { api, money, day } from './api';

const TABS = ['Overview', 'Invoices', 'Clients', 'Services'];

export default function App() {
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState({ clients: [], services: [], invoices: [], stats: {} });
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [clients, services, invoices, stats] = await Promise.all([
        api.get('/clients'), api.get('/services'), api.get('/invoices'), api.get('/dashboard'),
      ]);
      setData({ clients, services, invoices, stats });
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  // Run an API action, refresh, and surface any error
  const act = async (fn) => {
    try { setError(''); await fn(); await load(); return true; }
    catch (e) { setError(e.message); return false; }
  };

  return (
    <div className="app">
      <header className="top">
        <h1>Invoice Generator</h1>
        <nav>{TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}</nav>
      </header>
      {error && <div className="error" role="alert">{error}</div>}
      <main>
        {tab === 'Overview' && <Overview stats={data.stats} invoices={data.invoices} />}
        {tab === 'Invoices' && <Invoices {...data} act={act} />}
        {tab === 'Clients' && (
          <Crud title="client" path="/clients" rows={data.clients} act={act}
            fields={[['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address']]} />
        )}
        {tab === 'Services' && (
          <Crud title="service" path="/services" rows={data.services} act={act}
            fields={[['name', 'Name'], ['description', 'Description'], ['rate', 'Rate', 'number']]} />
        )}
      </main>
    </div>
  );
}

function Overview({ stats, invoices }) {
  const cells = [
    ['Outstanding', money(stats.outstanding), 'big'],
    ['Collected', money(stats.collected)],
    ['Invoiced', money(stats.invoiced)],
    ['Overdue invoices', stats.overdue ?? 0],
  ];
  return (
    <>
      <section className="stats">{cells.map(([l, v, c]) => (
        <div key={l} className={'stat ' + (c || '')}><span>{l}</span><strong>{v}</strong></div>
      ))}</section>
      <h2>Needs attention</h2>
      <Table head={['Invoice', 'Client', 'Due', 'Balance', 'Status']}
        rows={invoices.filter((i) => i.status === 'overdue' || i.status === 'partial').map((i) => [
          i.number, i.client?.name, day(i.dueDate), money(i.balance), <Badge s={i.status} />,
        ])}
        empty="Nothing overdue or part-paid. Create an invoice to get started." />
    </>
  );
}

function Crud({ title, path, rows, fields, act }) {
  const blank = Object.fromEntries(fields.map(([k]) => [k, '']));
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    const ok = await act(() => (editing ? api.put(`${path}/${editing}`, form) : api.post(path, form)));
    if (ok) { setForm(blank); setEditing(null); }
  };
  const edit = (r) => { setEditing(r._id); setForm(Object.fromEntries(fields.map(([k]) => [k, r[k] ?? '']))); };

  return (
    <div className="split">
      <form className="panel" onSubmit={save}>
        <h2>{editing ? `Edit ${title}` : `New ${title}`}</h2>
        {fields.map(([k, label, type]) => (
          <label key={k}>{label}
            <input type={type || 'text'} step="any" required={k === 'name' || k === 'rate'} value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <div className="row">
          <button className="primary">Save {title}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>
      <Table head={fields.map((f) => f[1]).concat('')}
        rows={rows.map((r) => fields.map(([k, , t]) => (t === 'number' ? money(r[k]) : r[k])).concat(
          <span className="row">
            <button onClick={() => edit(r)}>Edit</button>
            <button className="danger" onClick={() => window.confirm(`Delete this ${title}?`) && act(() => api.del(`${path}/${r._id}`))}>Delete</button>
          </span>))}
        empty={`No ${title}s yet. Add one using the form.`} />
    </div>
  );
}

const emptyItem = { description: '', quantity: 1, rate: 0 };

function Invoices({ invoices, clients, services, act }) {
  const blank = { client: '', dueDate: '', taxRate: 0, discount: 0, notes: '', items: [{ ...emptyItem }] };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);

  const setItem = (i, patch) => setForm({ ...form, items: form.items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });
  const fromService = (i, id) => {
    const s = services.find((x) => x._id === id);
    if (s) setItem(i, { description: s.name, rate: s.rate });
  };
  const subtotal = form.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const total = (subtotal - form.discount) * (1 + form.taxRate / 100);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, dueDate: form.dueDate || undefined };
    const ok = await act(() => (editing ? api.put(`/invoices/${editing}`, body) : api.post('/invoices', body)));
    if (ok) { setForm(blank); setEditing(null); }
  };
  const edit = (inv) => {
    setEditing(inv._id); window.scrollTo({ top: 0, behavior: 'smooth' });
    setForm({ client: inv.client._id, dueDate: day(inv.dueDate), taxRate: inv.taxRate, discount: inv.discount, notes: inv.notes || '',
      items: inv.items.map(({ description, quantity, rate }) => ({ description, quantity, rate })) });
  };

  return (
    <>
      <form className="panel" onSubmit={save}>
        <h2>{editing ? 'Edit invoice' : 'New invoice'}</h2>
        <div className="grid">
          <label>Client
            <select required value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
              <option value="">Choose a client</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </label>
          <label>Due date<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
          <label>Tax %<input type="number" min="0" step="any" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: +e.target.value })} /></label>
          <label>Discount<input type="number" min="0" step="any" value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} /></label>
        </div>
        <div className="items">
          {form.items.map((it, i) => (
            <div className="item" key={i}>
              <select value="" onChange={(e) => fromService(i, e.target.value)} aria-label="Fill from a service">
                <option value="">Add from services</option>
                {services.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
              <input required placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
              <input type="number" min="0" step="any" aria-label="Quantity" value={it.quantity} onChange={(e) => setItem(i, { quantity: +e.target.value })} />
              <input type="number" min="0" step="any" aria-label="Rate" value={it.rate} onChange={(e) => setItem(i, { rate: +e.target.value })} />
              <button type="button" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, n) => n !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}>Add line</button>
        </div>
        <label>Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <div className="row between">
          <strong className="total">Total {money(total)}</strong>
          <span className="row">
            <button className="primary">{editing ? 'Save changes' : 'Create invoice'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
          </span>
        </div>
      </form>

      <h2>Invoices</h2>
      {invoices.length === 0 && <p className="empty">No invoices yet. Add a client, then create one above.</p>}
      {invoices.map((inv) => (
        <article key={inv._id} className="invoice">
          <div className="row between" onClick={() => setOpen(open === inv._id ? null : inv._id)}>
            <span><strong>{inv.number}</strong> {inv.client?.name}</span>
            <span className="row"><span>{money(inv.balance)} due of {money(inv.total)}</span><Badge s={inv.status} /></span>
          </div>
          {open === inv._id && <Detail inv={inv} act={act} onEdit={() => edit(inv)} />}
        </article>
      ))}
    </>
  );
}

function Detail({ inv, act, onEdit }) {
  const [pay, setPay] = useState({ amount: '', method: 'Cash', note: '' });
  const add = async (e) => {
    e.preventDefault();
    if (await act(() => api.post(`/invoices/${inv._id}/payments`, pay))) setPay({ amount: '', method: 'Cash', note: '' });
  };
  return (
    <div className="detail">
      <p>{inv.client?.name}{inv.client?.email && ` · ${inv.client.email}`}<br />
        Issued {day(inv.issueDate)}{inv.dueDate && `, due ${day(inv.dueDate)}`}</p>
      <Table head={['Description', 'Qty', 'Rate', 'Amount']}
        rows={inv.items.map((i) => [i.description, i.quantity, money(i.rate), money(i.quantity * i.rate)])} />
      <p className="sum">Subtotal {money(inv.subtotal)} · Discount {money(inv.discount)} · Tax {money(inv.tax)}<br />
        <strong>Total {money(inv.total)}</strong> · Paid {money(inv.paid)} · <strong>Balance {money(inv.balance)}</strong></p>
      {inv.notes && <p>{inv.notes}</p>}

      <h3>Payments</h3>
      <Table head={['Date', 'Amount', 'Method', 'Note', '']}
        rows={inv.payments.map((p) => [day(p.date), money(p.amount), p.method, p.note,
          <button className="danger" onClick={() => act(() => api.del(`/invoices/${inv._id}/payments/${p._id}`))}>Remove</button>])}
        empty="No payments recorded." />
      {inv.balance > 0 && (
        <form className="row pay" onSubmit={add}>
          <input required type="number" min="0.01" step="any" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
            {['Cash', 'Bank transfer', 'Card', 'Mobile wallet', 'Cheque'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <input placeholder="Note" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
          <button className="primary">Record payment</button>
        </form>
      )}
      <div className="row noprint">
        <button onClick={() => window.print()}>Print invoice</button>
        <button onClick={onEdit}>Edit</button>
        <button className="danger" onClick={() => window.confirm(`Delete ${inv.number}?`) && act(() => api.del(`/invoices/${inv._id}`))}>Delete</button>
      </div>
    </div>
  );
}

const Badge = ({ s }) => <span className={'badge ' + s}>{s}</span>;

function Table({ head, rows, empty }) {
  if (!rows.length) return <p className="empty">{empty || 'Nothing here yet.'}</p>;
  return (
    <div className="scroll"><table>
      <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}