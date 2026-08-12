import { resetStore, setStore, getStore } from "./store";
import { createAccount, createContact, createAudience, createCampaign } from "./models";

export function seedDemoData() {
  resetStore();
  const accounts = [
    createAccount({
      name: "BrightSpring Health Services",
      domain: "brightspringhealth.com",
      industry: "Healthcare",
      size: "10000+",
      signals: ["pricing_page", "demo_request", "linkedin_engagement"],
    }),
    createAccount({
      name: "Amedisys",
      domain: "amedisys.com",
      industry: "Healthcare",
      size: "5000-10000",
      signals: ["case_study_download", "g2_review", "site_visit"],
    }),
    createAccount({
      name: "LHC Group",
      domain: "lhcgroup.com",
      industry: "Healthcare",
      size: "5000-10000",
      signals: ["competitor_comparison", "newsletter_signup", "site_visit"],
    }),
    createAccount({
      name: "AccentCare",
      domain: "accentcare.com",
      industry: "Healthcare",
      size: "5000-10000",
      signals: ["career_page", "site_visit"],
    }),
    createAccount({
      names: "ProMedica Senior Care",
      domain: "promedicaseniorcare.org",
      industry: "Senior Living",
      size: "1000-5000",
      signals: ["pricing_page", "demo_request", "g2_review", "linkedin_engagement"],
    }),
  ];

  const contacts = [
    createContact({ email: "sarah.j@brightspringhealth.com", firstName: "Sarah", lastName: "Jenkins", title: "VP Operations", accountId: accounts[0].id }),
    createContact({ email: "mike.r@brightspringhealth.com", firstName: "Mike", lastName: "Roberts", title: "Director of IT", accountId: accounts[0].id }),
    createContact({ email: "linda.k@amedisys.com", firstName: "Linda", lastName: "Kim", title: "CMO", accountId: accounts[1].id }),
    createContact({ email: "tom.w@lhcgroup.com", firstName: "Tom", lastName: "Wilson", title: "Procurement Lead", accountId: accounts[2].id }),
    createContact({ email: "rosa.p@accentcare.com", firstName: "Rosa", lastName: "Park", title: "Head of Facilities", accountId: accounts[3].id }),
  ];

  const audiences = [
    createAudience({
      name: "High Intent Healthcare",
      description: "Accounts showing pricing + demo + engagement signals",
      criteria: { signal: "pricing_page" },
      accountIds: [accounts[0].id, accounts[4].id],
      contactIds: [contacts[0].id, contacts[1].id, contacts[5]?.id].filter(Boolean),
    }),
    createAudience({
      name: "Senior Living Operators",
      description: "Senior living industry accounts",
      criteria: { industry: "Senior Living" },
      accountIds: [accounts[4].id],
      contactIds: [contacts[5]?.id].filter(Boolean),
    }),
  ];

  const campaigns = [
    createCampaign({ name: "Q3 Outreach - High Intent", audienceId: audiences[0].id, channel: "email", status: "active" }),
    createCampaign({ name: "Senior Living Nurture", audienceId: audiences[1].id, channel: "linkedin", status: "draft" }),
  ];

  setStore({ accounts, contacts, audiences, campaigns, events: [] });
  return { accounts: accounts.length, contacts: contacts.length, audiences: audiences.length, campaigns: campaigns.length };
}
