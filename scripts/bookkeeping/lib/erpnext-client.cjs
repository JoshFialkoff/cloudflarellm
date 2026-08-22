/**
 * ERPNext REST API Client for Assistedly, Inc.
 */

class ERPNextClient {
  constructor({ baseUrl, apiKey, apiSecret, company = 'Assistedly Inc' }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.company = company;
  }

  _authHeaders(extra = {}) {
    return { Authorization: `token ${this.apiKey}:${this.apiSecret}`, 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
  }

  async _request(path, { method = 'GET', body, query } = {}) {
    let url = `${this.baseUrl}${path}`;
    if (query) { const qs = new URLSearchParams(); for (const [k, v] of Object.entries(query)) { if (v !== undefined && v !== null) qs.set(k, String(v)); } if (qs.toString()) url += `?${qs.toString()}`; }
    const res = await fetch(url, { method, headers: this._authHeaders(), body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) { const err = new Error(`ERPNext API error ${res.status}: ${json.message || json.exc_type || text.slice(0, 300)}`); err.status = res.status; err.body = json; throw err; }
    return json;
  }

  async getLoggedUser() { const r = await this._request('/api/method/frappe.auth.get_logged_user'); return r.message; }
  async listCompanies() { const r = await this._request('/api/resource/Company', { query: { fields: JSON.stringify(['name','company_name','abbr','default_currency']) } }); return r.data || []; }
  async getChartOfAccounts() { const fields = ['name','account_name','account_number','parent_account','is_group','root_type','account_type','account_currency','company']; const r = await this._request('/api/resource/Account', { query: { filters: JSON.stringify([['company','=',this.company]]), fields: JSON.stringify(fields), limit_page_length: 500 } }); return (r.data || []).sort((a,b)=>(a.name||'').localeCompare(b.name||'')); }
  summarizeCOA(accounts) { const byRoot={}; for(const ac of accounts){ const rt=ac.root_type||'Unknown'; if(!byRoot[rt]) byRoot[rt]=[]; byRoot[rt].push(ac); } const out=[]; for(const [root,list] of Object.entries(byRoot).sort(([a],[b])=>a.localeCompare(b))){ out.push(`## ${root} (${list.length} accounts)`); for(const ac of list){ const leaf=ac.is_group?'👔':'  '; const num=ac.account_number?`[${ac.account_number}] `:''; out.push(`  ${leaf} ${num}${ac.account_name} (${ac.account_type||'General'})`); } } return out.join('\n'); }
  async createJournalEntry({ postingDate, lines, remarks='', docstatus=0 }) { const accounts=lines.map(ln=>({account:ln.account,debit_in_account_currency:ln.debit||0,credit_in_account_currency:ln.credit||0,cost_center:ln.costCenter||'',party_type:ln.partyType||'',party:ln.party||'',reference_type:ln.referenceType||'',reference_name:ln.referenceName||''})); const totalDebits=accounts.reduce((s,a)=>s+(a.debit_in_account_currency||0),0); const totalCredits=accounts.reduce((s,a)=>s+(a.credit_in_account_currency||0),0); if(Math.abs(totalDebits-totalCredits)>0.001) throw new Error(`Journal entry unbalanced: debit=${totalDebits} credit=${totalCredits}`); const payload={voucher_type:'Journal Entry',company:this.company,posting_date:postingDate,accounts,user_remark:remarks,docstatus}; const r=await this._request('/api/resource/Journal%20Entry',{method:'POST',body:payload}); return r.data; }
  async submitDoc(doctype,name){ const r=await this._request('/api/method/frappe.client.submit',{method:'POST',body:{doc:{doctype,name}}}); return r.message||r.data; }
  async createPurchaseInvoice({supplier,postingDate,dueDate,items,taxes=[],docstatus=0}){ const payload={doctype:'Purchase Invoice',supplier,company:this.company,posting_date:postingDate,due_date:dueDate||postingDate,currency:'USD',conversion_rate:1,items:items.map(it=>({item_code:it.itemCode||'Item',qty:it.qty||1,rate:it.rate||0,amount:it.amount||(it.qty||1)*(it.rate||0),expense_account:it.expenseAccount,cost_center:it.costCenter||''})),taxes:taxes.map(tx=>({charge_type:tx.chargeType||'On Net Total',account_head:tx.accountHead,description:tx.description||'',rate:tx.rate||0})),docstatus}; const r=await this._request('/api/resource/Purchase%20Invoice',{method:'POST',body:payload}); return r.data; }
  async createPaymentEntry({paymentType,postingDate,partyType,party,paidFrom,paidTo,paidAmount,references=[],docstatus=0}){ const payload={doctype:'Payment Entry',payment_type:paymentType,posting_date:postingDate,company:this.company,party_type:partyType,party,paid_from:paidFrom,paid_to:paidTo,paid_amount:paidAmount,received_amount:paidAmount,references:references.map(ref=>({reference_doctype:ref.doctype,reference_name:ref.name,allocated_amount:ref.allocatedAmount})),docstatus}; const r=await this._request('/api/resource/Payment%20Entry',{method:'POST',body:payload}); return r.data; }
  async listGLEntries(filters=[]){ const r=await this._request('/api/resource/GL%20Entry',{query:{fields:JSON.stringify(['name','posting_date','account','debit','credit','voucher_type','voucher_no','against','remarks','fiscal_year','company']),filters:JSON.stringify(filters),limit_page_length:500}}); return r.data||[]; }
  async listBankTransactions(filters=[]){ const r=await this._request('/api/resource/Bank%20Transaction',{query:{fields:JSON.stringify(['name','date','status','bank_account','deposit','withdrawal','description','reference_number']),filters:JSON.stringify(filters),limit_page_length:500}}); return r.data||[]; }
  async updateBankTransaction(name,updates){ const r=await this._request(`/api/resource/Bank%20Transaction/${encodeURIComponent(name)}`,{method:'PUT',body:updates}); return r.data; }
  async runReport(reportName,filters){ const r=await this._request('/api/method/frappe.desk.query_report.run',{method:'POST',body:{report_name:reportName,filters}}); return r.message||r; }
  async getTrialBalance({fiscalYear,fromDate,toDate,costCenter=''}={}){ const report=await this.runReport('Trial Balance',{company:this.company,fiscal_year:fiscalYear||new Date().getFullYear(),from_date:fromDate||`${new Date().getFullYear()}-01-01`,to_date:toDate||new Date().toISOString().slice(0,10),cost_center:costCenter,project:''}); return report; }
  verifyTrialBalance(reportResult){ const rows=reportResult?.result||[]; let totalOpeningDr=0,totalOpeningCr=0,totalDebit=0,totalCredit=0,totalClosingDr=0,totalClosingCr=0; for(const row of rows){ if(!row||typeof row!=='object'||row.account==='Total') continue; totalOpeningDr+=Number(row.opening_debit||0); totalOpeningCr+=Number(row.opening_credit||0); totalDebit+=Number(row.debit||0); totalCredit+=Number(row.credit||0); totalClosingDr+=Number(row.closing_debit||0); totalClosingCr+=Number(row.closing_credit||0);} const isBalanced=Math.abs(totalDebit-totalCredit)<0.01&&Math.abs(totalClosingDr-totalClosingCr)<0.01; return{isBalanced,totalOpeningDr,totalOpeningCr,totalDebit,totalCredit,totalClosingDr,totalClosingCr}; }
}
module.exports={ERPNextClient};
