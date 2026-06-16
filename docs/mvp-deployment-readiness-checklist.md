# Assistedly.ai MVP deployment readiness checklist

- [ ] Confirm `npm run lint`
- [ ] Confirm `npm run build`
- [ ] Confirm the comparison page loads with 2 to 4 facilities
- [ ] Confirm `pages/api/leads/consumer.js` captures leads even if Discord webhooks are unset
- [ ] Confirm admin access is limited to emails listed in `ASSISTEDLY_ADMIN_EMAILS`
- [ ] Confirm premium access is limited to emails listed in `ASSISTEDLY_PREMIUM_EMAILS`
- [ ] Confirm `/guide` exclusion remains unchanged in Traefik and Dify guard checks
- [ ] Confirm town SEO pages render for the requested Massachusetts towns
- [ ] Confirm trust-center pages render and include lead capture
- [ ] Confirm AI assistant surfaces still carry non-medical-advice framing
