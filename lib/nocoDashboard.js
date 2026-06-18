function cleanSegment(value) {
  return String(value || "").trim();
}

function getNocoConfig() {
  return {
    dashboardBase: cleanSegment(process.env.NOCODB_DASHBOARD_BASE),
    projectId: cleanSegment(process.env.NOCODB_PROJECT_ID),
    defaultTableId: cleanSegment(process.env.NOCODB_DEFAULT_TABLE_ID),
    defaultViewId: cleanSegment(process.env.NOCODB_DEFAULT_VIEW_ID),
  };
}

function buildNocoRowDashboardUrl(record = {}) {
  const { dashboardBase, projectId, defaultTableId, defaultViewId } = getNocoConfig();
  const tableId = cleanSegment(record.tableId) || defaultTableId;
  const viewId = cleanSegment(record.viewId) || defaultViewId;
  const rowId = cleanSegment(record.nocoRowId);

  if (!dashboardBase || !projectId || !tableId || !viewId || !rowId) {
    return "";
  }

  const base = dashboardBase.replace(/\/$/, "");
  return `${base}/dashboard/#/nc/${projectId}/${tableId}/${viewId}/${rowId}`;
}

function nocoDashboardConfigured() {
  const { dashboardBase, projectId, defaultTableId, defaultViewId } = getNocoConfig();
  return Boolean(dashboardBase && projectId && defaultTableId && defaultViewId);
}

module.exports = {
  buildNocoRowDashboardUrl,
  getNocoConfig,
  nocoDashboardConfigured,
};
