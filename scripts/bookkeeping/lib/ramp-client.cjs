/**
 * Ramp.com Developer API Client
 */
class RampClient {
  constructor({ clientId, clientSecret, baseUrl = 'https://api.ramp.com' }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }
  async _ensureToken() {
    const bufferMs = 60_000;
    if (this.accessToken && Date.now() < this.tokenExpiresAt - bufferMs) return;
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const scope = ['transactions:read','users:read','departments:read','accounting:read','accounting:write'].join(' ');
    const res = await fetch(`${this.baseUrl}/developer/v1/token`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', scope }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Ramp OAuth error ${res.status}: ${JSON.stringify(json)}`);
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + (json.expires_in || 864000) * 1000;
  }
  async _request(path, { method = 'GET', body, query } = {}) {
    await this._ensureToken();
    let url = `${this.baseUrl}${path}`;
    if (query) { const qs = new URLSearchParams(); for (const [k, v] of Object.entries(query)) { if (v !== undefined && v !== null) qs.set(k, String(v)); } if (qs.toString()) url += `?${qs.toString()}`; }
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) { const err = new Error(`Ramp API error ${res.status}: ${json.message || text.slice(0, 300)}`); err.status = res.status; err.body = json; throw err; }
    return json;
  }
  async getBusiness() { const r = await this._request('/developer/v1/business'); return r.data || r; }
  async listTransactions({ start, limit = 100, state, syncStatus, fromDate, toDate, userId, allPages = false } = {}) {
    const query = { limit: String(limit), ...(start && { start }), ...(state && { state }), ...(syncStatus && { sync_status: syncStatus }), ...(fromDate && { from_date: fromDate }), ...(toDate && { to_date: toDate }), ...(userId && { user_id: userId }) };
    const r = await this._request('/developer/v1/transactions', { query });
    const data = r.data || []; if (allPages && r.page?.next) { let next = r.page.next; while (next) { const pageRes = await fetch(next, { headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' } }); const pageJson = await pageRes.json(); if (pageJson.data) data.push(...pageJson.data); next = pageJson.page?.next || null; } } return data;
  }
  async getTransaction(id) { const r = await this._request(`/developer/v1/transactions/${id}`); return r.data || r; }
  async listBills({ limit = 100, start } = {}) { const r = await this._request('/developer/v1/bills', { query: { limit: String(limit), ...(start && { start }) } }); return r.data || []; }
  async listReimbursements({ limit = 100, start, state, syncStatus } = {}) { const query = { limit: String(limit), ...(start && { start }), ...(state && { state }), ...(syncStatus && { sync_status: syncStatus }) }; const r = await this._request('/developer/v1/reimbursements', { query }); return r.data || []; }
  async listUsers({ limit = 100, start } = {}) { const r = await this._request('/developer/v1/users', { query: { limit: String(limit), ...(start && { start }) } }); return r.data || []; }
  async listDepartments() { const r = await this._request('/developer/v1/departments'); return r.data || []; }
  async listAccountingAccounts() { const r = await this._request('/developer/v1/accounting/accounts'); return r.data || []; }
  async markSynced(transactionIds) { const ids = Array.isArray(transactionIds) ? transactionIds : [transactionIds]; const r = await this._request('/developer/v1/accounting/syncs', { method: 'POST', body: { ids: ids.map((id) => ({ id })) } }); return r.data || r; }
  async getReadyToSyncTransactions({ limit = 200 } = {}) { return this.listTransactions({ limit, syncStatus: 'SYNC_READY', allPages: true }); }
}
module.exports = { RampClient };
