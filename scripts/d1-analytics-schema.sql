-- Assistedly.ai Facility Analytics Schema
-- D1 database: assistedly-analytics
-- Security: All person-identifiable data is stripped before INSERT.
--           This table stores ONLY anonymous, aggregated search behavior.

-- Daily facility impression/click aggregates
CREATE TABLE IF NOT EXISTS facility_searches (
  date TEXT NOT NULL,              -- '2026-08-21'
  facility_id TEXT NOT NULL,       -- slug e.g. 'springfield-elder-care-village'
  facility_name TEXT,
  impressions INTEGER DEFAULT 0,   -- times shown in search results
  detail_views INTEGER DEFAULT 0,  -- times visited /facility/:slug
  clicks INTEGER DEFAULT 0,        -- times clicked from table
  avg_search_radius_mi REAL,       -- average radius of searches that included this facility
  top_co_searched TEXT,            -- JSON array of other facilities clicked in same session
  city TEXT,                       -- most common search city for this facility-day
  state TEXT DEFAULT 'MA',
  PRIMARY KEY (date, facility_id)
);

-- Search session log (lower cardinality, for radius/trend analysis)
CREATE TABLE IF NOT EXISTS search_sessions (
  date TEXT NOT NULL,
  session_id TEXT NOT NULL,            -- anonymous session hash
  city TEXT,
  radius_mi INTEGER,
  tax_status TEXT,
  max_fee INTEGER,
  memory_care TEXT,                    -- 'yes' | 'no' | 'any'
  insurance TEXT,                      -- filter value or 'any'
  result_count INTEGER,
  has_coords INTEGER,                  -- 1 if city was geocoded
  chart_source TEXT,                   -- 'find-safest' | 'affordable' | 'homepage'
  sort_key TEXT,                       -- e.g. 'safetyScore', 'avgFee'
  sort_dir TEXT,                       -- 'asc' | 'desc'
  facility_id_clicked TEXT,            -- facility slug if user clicked a row
  facility_name_clicked TEXT,         -- facility name for convenience
  PRIMARY KEY (date, session_id)
);

-- Daily rollup for dashboard queries (pre-aggregated for speed)
CREATE TABLE IF NOT EXISTS facility_daily_summary (
  date TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  facility_name TEXT,
  total_impressions INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_detail_views INTEGER DEFAULT 0,
  avg_search_radius_mi REAL,
  top_competing_cities TEXT,       -- JSON
  PRIMARY KEY (date, facility_id)
);

-- GPT Action API query log (raw incoming params from ChatGPT / OpenAI)
CREATE TABLE IF NOT EXISTS gpt_search_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  town TEXT,
  careType TEXT,
  q TEXT,
  maxBudget INTEGER,
  result_count INTEGER,
  origin TEXT
);
CREATE INDEX IF NOT EXISTS idx_gpt_search_queries_created_at ON gpt_search_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_gpt_search_queries_town ON gpt_search_queries(town);
CREATE INDEX IF NOT EXISTS idx_gpt_search_queries_q ON gpt_search_queries(q);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_facility_searches_facility ON facility_searches(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_searches_date ON facility_searches(date);
CREATE INDEX IF NOT EXISTS idx_search_sessions_date ON search_sessions(date);
CREATE INDEX IF NOT EXISTS idx_facility_daily_summary_facility ON facility_daily_summary(facility_id);
