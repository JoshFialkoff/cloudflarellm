# Assistedly.ai — ChatGPT Custom GPT Setup

This folder contains everything needed to create and publish a ChatGPT Custom GPT with Actions that calls the Assistedly.ai API.

## Files

| File | Purpose |
|------|---------|
| `openapi-schema.yaml` | OpenAPI 3.1 schema for the GPT Action (upload to OpenAI GPT builder) |
| `gpt-instructions.md` | System prompt / instructions for the GPT |
| `gpt-config.json` | Metadata and config for the GPT listing |
| `search-facilities.js` | The production API endpoint (`/api/gpt/search-facilities`) |

## Publishing Steps

1. **Verify the API endpoint is live**
   ```bash
   curl "https://assistedly.ai/api/gpt/search-facilities?town=Newton&limit=3"
   ```

2. **Open the GPT Builder**
   - Go to https://chat.openai.com/gpts/editor
   - Click "Create new GPT"

3. **Configure the GPT**
   - **Name**: `Assistedly.ai Concierge`
   - **Description**: Use the text from `gpt-config.json`
   - **Instructions**: Paste the contents of `gpt-instructions.md`
   - **Conversation starters** (add these):
     - "Find assisted living near Boston for my mom"
     - "Compare memory care facilities in Newton, MA"
     - "How much does assisted living cost in Massachusetts?"
     - "What's the best facility for 24/7 nursing care near Worcester?"

4. **Add the Action**
   - Click "Actions" → "Add actions"
   - Upload `openapi-schema.yaml`
   - **Authentication**: Select "None" (the endpoint is public and read-only)
   - **Privacy policy**: `https://assistedly.ai/privacy`

5. **Logo**
   - Upload the Assistedly.ai logo (SVG or PNG)
   - Recommended: `https://assistedly.ai/Assistedly-Teal-Logo.png`

6. **Save & Publish**
   - Visibility: `Public` (so anyone can discover it)
   - Copy the GPT link and share it

## Attribution Tracking

The API automatically appends `?ai_source=chatgpt` to all facility and intake URLs returned in the Action response. This allows:
- GA4 to attribute the session to "AI Assistants" via the custom channel group
- PostHog to register the `ai_referrer: chatgpt` super-property
- The `AIReferrerBanner` component to show a contextual ChatGPT message on the site

## Rate Limits

The endpoint is cached for 5 minutes and has a 1-hour CDN cache. If you see 429 responses, the GPT will retry politely.

## Updating the GPT

If the schema changes:
1. Update `openapi-schema.yaml`
2. Re-upload it in the GPT builder Actions tab
3. Verify with the GPT builder "Test" button
