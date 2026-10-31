import { h, get, api, clear, icon, num, fdt, loading, errorBox, seg, toast, fail, toCsv, saveCsv, ago } from '../lib.js';
import { chart, spark, labelFor } from '../charts.js';
import { state } from '../state.js';

const RANGES = [['24h', '24 hours'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['1y', '1 year'], ['custom', 'Custom']];

export default function dashboard(root) {
  let range = '7d';
  let from = '', to = '';
  let data = null;
  let charts = [];
  const hiddenSets = {};
  const hidden = new Proxy(hiddenSets, { get: (t, k) => (t[k] ??= new Set()) });

  const head = h('div', { class: 'page-head' });
  const body = h('div', { class: 'page-body' });
  root.append(head, body);

  const fromI = h('input', { class: 'input', type: 'date' });
  const toI = h('input', { class: 'input', type: 'date' });
  const custom = h('div', { class: 'row', style: 'display:none' }, fromI, h('span', { class: 'muted' }, 'to'), toI, h('button', { class: 'btn', onClick: () => { if (fromI.value && toI.value) { from = new Date(fromI.value + 'T00:00:00').toISOString(); to = new Date(toI.value + 'T23:59:59').toISOString(); load(); } else toast('Pick both dates.', true); } }, 'Apply'));

  const rangeSeg = seg(RANGES, range, (v) => { range = v; custom.style.display = v === 'custom' ? '' : 'none'; if (v !== 'custom') { from = to = ''; load(); } });
  const refresh = h('button', { class: 'btn', onClick: () => load() }, icon('refresh'), 'Refresh');
  const exp = h('button', { class: 'btn', onClick: exportCsv }, icon('download'), 'Export CSV');

  head.append(h('div', { class: 'grow' }, h('h1', 'Dashboard'), h('div', { class: 'sub', id: 'dash-sub' }, 'Platform activity')), rangeSeg, custom, refresh, exp);

  async function load() {
    charts.forEach((c) => c.destroy());
    charts = [];
    clear(body).append(loading(10));
    try {
      data = await get('/dashboard', range === 'custom' ? { from, to } : { range });
      render();
    } catch (e) { clear(body).append(errorBox(e, load)); }
  }

  function kpi(label, value, detail, series) {
    return h('div', { class: 'kpi' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), series ? spark(series) : null, h('div', { class: 'd' }, detail ?? ''));
  }

  function legend(key, series, c) {
    return h('div', { class: 'legend' }, series.map((s, i) => {
      const b = h('button', { class: hidden[key].has(s.name) ? 'off' : '' }, h('i', { style: `border-top:${['2px solid #fff', '2px dashed #b4b4ba', '2px dotted #8a8a92', '2px dashed #d4d4d8'][i % 4]}` }), s.name);
      b.addEventListener('click', () => {
        if (hidden[key].has(s.name)) hidden[key].delete(s.name); else hidden[key].add(s.name);
        b.classList.toggle('off', hidden[key].has(s.name));
        c.update({ ...c.opts, series: series.map((x) => ({ ...x, hidden: hidden[key].has(x.name) })) });
      });
      return b;
    }));
  }

  function line(key, title, series, extra = {}) {
    const { labels } = data.series;
    const unit = data.range.unit;
    const mk = (hide) => series.map((s) => ({ ...s, hidden: hidden[key].has(s.name) }));
    const c = chart({ labels, unit, series: mk(), height: extra.height ?? 250, kind: extra.kind ?? 'line' });
    const wrapped = { ...c, opts: { labels, unit, height: extra.height ?? 250, kind: extra.kind ?? 'line' }, update: (o) => c.update({ labels, unit, height: extra.height ?? 250, kind: extra.kind ?? 'line', ...o }) };
    charts.push(c);
    return h('div', { class: 'card' }, h('header', h('h3', title), h('span', { class: 'grow' }), legend(key, series, wrapped)), h('div', { class: 'body' }, c.el));
  }

  function render() {
    const k = data.kpis, s = data.series, unit = data.range.unit;
    document.getElementById('dash-sub').textContent = `${fdt(data.range.from)} → ${fdt(data.range.to)} · ${unit === 'hour' ? 'hourly' : 'daily'} buckets`;

    // hour-of-day, shifted from UTC to this computer's timezone
    const off = Math.round(-new Date().getTimezoneOffset() / 60);
    const local = Array.from({ length: 24 }, (_, i) => data.hourOfDay[(i - off + 24) % 24]);
    const hc = chart({ labels: Array.from({ length: 24 }, (_, i) => i), unit: 'hour', kind: 'bar', height: 190, series: [{ name: 'Avg active users', data: local }], xLabel: (v) => `${String(v).padStart(2, '0')}`, tipLabel: (v) => `${String(v).padStart(2, '0')}:00 – ${String((v + 1) % 24).padStart(2, '0')}:00 (local)` });
    charts.push(hc);

    const peakTxt = k.peak ? `${num(k.peak.users)} users` : '—';
    const peakWhen = k.peak ? `${labelFor(k.peak.at, 'hour', true)}` : 'No activity in range';

    clear(body).append(
      h('div', { class: 'grid g-4' },
        kpi('Total users', num(k.totalUsers), `${num(k.newUsers)} joined in this range`, s.signups),
        kpi('Active users', num(k.activeUsers), `${num(k.active24h)} today · ${num(k.active7d)} this week · ${num(k.active30d)} this month`, s.activeUsers),
        kpi('Average daily active', num(k.avgDailyActive), 'Mean of unique users per day', s.activeUsers),
        kpi('Log ins', num(k.logins), 'App sessions started', s.logins),
        kpi('Peak', peakTxt, peakWhen),
        kpi('Posts', num(k.posts), 'Created in range', s.posts),
        kpi('Comments', num(k.comments), 'Created in range', s.comments),
        kpi('Messages sent', num(k.messages), 'Count only. Content is never read.', s.messages),
        kpi('Restricted now', num(k.restricted), `${num(k.struck)} accounts carry strikes`),
        kpi('Banned', num(k.banned), 'Accounts currently banned'),
        kpi('Open reports', num(k.openReports), 'Waiting in the Inbox'),
        kpi('Pending appeals', num(k.pendingAppeals), 'From banned or restricted people'),
      ),
      h('div', { class: 'grid g-21', style: 'margin-top:12px' },
        line('main', 'Active users and log ins', [{ name: 'Active users', data: s.activeUsers }, { name: 'Log ins', data: s.logins }]),
        h('div', { class: 'card' }, h('header', h('h3', 'Busiest hours')), h('div', { class: 'body' }, hc.el, h('div', { class: 'hint', style: 'margin-top:8px' }, 'Average number of different people active in each hour of the day, in your local time.'))),
      ),
      h('div', { class: 'grid g-2', style: 'margin-top:12px' },
        line('content', 'Content activity', [{ name: 'Posts', data: s.posts }, { name: 'Comments', data: s.comments }, { name: 'Messages', data: s.messages }], { height: 220 }),
        line('signups', 'New sign-ups', [{ name: 'Sign-ups', data: s.signups }], { height: 220, kind: 'bar' }),
      ),
    );
  }

  async function exportCsv() {
    if (!data) return;
    const s = data.series;
    const rows = [['Period start (UTC)', 'Active users', 'Log ins', 'Sign-ups', 'Posts', 'Comments', 'Messages']];
    s.labels.forEach((l, i) => rows.push([l, s.activeUsers[i], s.logins[i], s.signups[i], s.posts[i], s.comments[i], s.messages[i]]));
    const r = await saveCsv(`helphive-dashboard-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    if (r.ok) api('POST', '/dashboard/exported', { range: range === 'custom' ? 'custom' : range }).catch(() => {});
  }

  load();
  return { refresh: load, destroy: () => charts.forEach((c) => c.destroy()) };
}
