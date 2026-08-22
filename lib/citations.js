/**
 * Citation Constants — Assistedly.ai Data Transparency
 *
 * Every data point displayed to users links to a public methodology page.
 * This builds trust without exposing raw FOIA / proprietary datasets.
 */

const BASE = 'https://assistedly.ai/methodology'

module.exports = {
  // Data sources
  sources: {
    eoea_alr_2024: {
      id: 'eoea-alr-2024',
      label: 'MA EOEA ALR Licensing Report 2024',
      url: `${BASE}#eoea-alr-2024`,
      description: 'Massachusetts Executive Office of Elder Affairs annual Assisted Living Residence licensing and compliance data.',
    },
    eoea_alr_2025: {
      id: 'eoea-alr-2025',
      label: 'MA EOEA ALR Licensing Report 2025',
      url: `${BASE}#eoea-alr-2025`,
      description: 'Massachusetts Executive Office of Elder Affairs annual Assisted Living Residence licensing and compliance data.',
    },
    cms_care_compare: {
      id: 'cms-care-compare',
      label: 'CMS Care Compare / CASPER',
      url: `${BASE}#cms-care-compare`,
      description: 'Centers for Medicare & Medicaid Services health inspection and staffing data.',
    },
    state_inspections: {
      id: 'state-inspections',
      label: 'MA State Inspection Records',
      url: `${BASE}#state-inspections`,
      description: 'Publicly available state health and safety inspection reports.',
    },
    self_reported: {
      id: 'self-reported',
      label: 'Facility Self-Reported Data',
      url: `${BASE}#self-reported`,
      description: 'Information provided directly by the facility or its authorized representative.',
    },
    assistedly_calculated: {
      id: 'assistedly-calculated',
      label: 'Assistedly.ai Calculated',
      url: `${BASE}#assistedly-calculated`,
      description: 'Derived metric using proprietary methodology combining multiple public sources.',
    },
  },

  // Field-to-source mapping for facility data
  facilityFieldSources: {
    name: null,                      // Display name only
    city: ['eoea_alr_2025'],
    zipCode: ['eoea_alr_2025'],
    address: ['eoea_alr_2025'],
    avgFee: ['eoea_alr_2025', 'self_reported'],
    feeLow: ['eoea_alr_2025', 'self_reported'],
    feeHigh: ['eoea_alr_2025', 'self_reported'],
    safetyScore: ['cms_care_compare', 'state_inspections', 'assistedly_calculated'],
    topRatedScore: ['cms_care_compare', 'state_inspections', 'assistedly_calculated'],
    licensingStatus: ['eoea_alr_2025'],
    capacity: ['eoea_alr_2025'],
    occupied: ['eoea_alr_2025'],
  },

  // Aggregate claims on homepage
  aggregateClaims: {
    totalFamiliesHelped: {
      value: null, // populated at build
      sources: ['assistedly_internal'],
      label: 'Internal CRM tracking',
      url: `${BASE}#aggregate-metrics`,
    },
    dataSourceCount: {
      value: null,
      sources: ['eoea_alr_2025', 'cms_care_compare'],
      label: 'Public government datasets',
      url: `${BASE}#data-sources`,
    },
  },

  // UI helper: build superscript citation array for a facility
  buildCitations(facility) {
    const sourceSet = new Set()
    Object.keys(this.facilityFieldSources).forEach(field => {
      if (facility[field] != null && this.facilityFieldSources[field]) {
        this.facilityFieldSources[field].forEach(s => sourceSet.add(s))
      }
    })
    return Array.from(sourceSet).map(id => this.sources[id]).filter(Boolean)
  },
}
