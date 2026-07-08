// Massachusetts budget assisted-living resources.
// Sourced via Firecrawl agent (session 019f416e), 2026-07-08.
// Each program/ally carries the source URL used for verification (Trust Center policy).

export const MA_FINANCIAL_PROGRAMS = [
    {
        name: "Group Adult Foster Care (GAFC)",
        scope: "State (MassHealth)",
        category: "Medicaid Program",
        eligibility:
            "MassHealth Standard members 22+ who need help with at least one daily activity. Asset limit $2,000/individual.",
        impact:
            "Covers personal care and medication management in participating assisted living residences — subsidizes the 'care' portion of the monthly bill.",
        applyUrl:
            "https://www.mass.gov/how-to/apply-for-masshealth-coverage-for-seniors-and-people-of-any-age-who-need-long-term-care-services",
        source: "https://www.mass.gov/info-details/assisted-living-residences",
    },
    {
        name: "SSI-G (Supplemental Security Income, Category G)",
        scope: "State & Federal",
        category: "Cash Assistance for Room & Board",
        eligibility:
            "Low-income seniors 65+ or disabled adults in a certified Assisted Living Residence. Income below the SSI-G threshold; assets below $2,000/individual.",
        impact:
            "Monthly cash payment specifically for room and board — the piece Medicaid usually will not cover.",
        applyUrl: "https://www.ssa.gov/ssi",
        source: "https://www.mass-ala.org/find-an-assisted-living-residence/paying-for-assisted-living/",
    },
    {
        name: "VA Aid & Attendance",
        scope: "Federal (Veterans)",
        category: "Veteran Benefit",
        eligibility:
            "Veterans or surviving spouses who served during a wartime period and need help with daily activities. Net-worth limit ~$155,356 (inflation-adjusted).",
        impact:
            "Tax-free pension increase of $2,000+/month that applies directly to assisted living costs.",
        applyUrl: "https://www.vba.va.gov/pubs/forms/VBA-21-2680-ARE.pdf",
        source: "https://www.va.gov/pension/aid-attendance-housebound/",
    },
    {
        name: "MassHealth Frail Elder Waiver (FEW)",
        scope: "State (MassHealth)",
        category: "Medicaid Waiver",
        eligibility:
            "Residents 65+ who meet nursing-home level of care but want to stay in the community. Income within MassHealth limits (300% of SSI FBR).",
        impact:
            "Covers housekeeping, laundry, and companion services — reducing out-of-pocket service fees in assisted living.",
        applyUrl:
            "https://www.mass.gov/how-to/apply-for-masshealth-coverage-for-seniors-and-people-of-any-age-who-need-long-term-care-services",
        source: "https://www.payingforseniorcare.com/massachusetts/medicaid-waivers/frail-elder-waiver",
    },
    {
        name: "Section 202 Supportive Housing for the Elderly",
        scope: "Federal (HUD)",
        category: "Subsidized Housing",
        eligibility:
            "Individuals 62+ with very low income (typically ≤50% of Area Median Income). Residents pay 30% of adjusted income for rent.",
        impact:
            "Drastically reduces the rent portion of housing while keeping supportive services nearby.",
        applyUrl: "https://www.hud.gov/program_offices/housing/mfh/dto/dto_apps",
        source: "https://www.ncoa.org/article/a-guide-to-section-202-low-Income-housing-for-older-adults/",
    },
    {
        name: "Senior Care Options (SCO)",
        scope: "State (MassHealth)",
        category: "Integrated Managed Care",
        eligibility: "MassHealth Standard members 65+. Combines Medicare and MassHealth into one plan.",
        impact:
            "Eliminates co-pays and adds transportation and dental — freeing budget for assisted living rent.",
        applyUrl: "https://www.mass.gov/how-to/enroll-in-a-senior-care-options-sco-plan",
        source: "https://www.mass.gov/service-details/senior-care-options-sco-program-overview",
    },
];

export const MA_SUPPORT_ALLIES = [
    {
        name: "Aging Services Access Points (ASAPs) / MassOptions",
        area: "All 24 Massachusetts regions",
        help: "Free clinical assessments for GAFC/FEW, information, referral, and placement assistance. Start here.",
        phone: "1-800-243-4636",
        website: "https://massoptions.org",
        source: "https://www.mass.gov/info-details/aging-services-network",
    },
    {
        name: "Massachusetts Councils on Aging (MCOA)",
        area: "Statewide local senior centers",
        help: "Local benefits counseling (SHINE), economic-security outreach, transportation, and respite referrals.",
        phone: "413-527-6425",
        website: "https://mcoaonline.org",
        source: "https://mcoaonline.org/economic-security-outreach/",
    },
    {
        name: "Greater Boston Legal Services — Elder Law Unit",
        area: "Greater Boston",
        help: "Free legal aid for low-income seniors on housing, MassHealth eligibility, and elder rights.",
        phone: "617-371-1234",
        website: "https://www.gbls.org/our-work/elder-law",
        source: "https://www.gbls.org/our-work/elder-law",
    },
    {
        name: "Patriot Angels",
        area: "National (serves MA veterans)",
        help: "Expert help navigating and applying for VA Aid & Attendance benefits.",
        phone: "844-728-7468",
        website: "https://patriotangels.com/va-assisted-living/massachusetts/",
        source: "https://patriotangels.com/va-assisted-living/massachusetts/",
    },
];
