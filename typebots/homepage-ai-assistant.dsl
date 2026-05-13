{
  "app": {
    "name": "Homepage AI Assistant",
    "mode": "workflow",
    "icon": "🏠",
    "description": "In-house streaming assistant for Massachusetts assisted living discovery (replaces Typebot embed on the homepage)."
  },
  "workflow": {
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "data": {}
      },
      {
        "id": "llm_homepage_concierge",
        "type": "llm",
        "data": {
          "model": "gpt-4o-mini",
          "temperature": 0.25,
          "stream": true,
          "system_prompt": "You are Assistedly’s homepage AI for families exploring assisted living and memory care in Massachusetts. The user already answered a few intake questions in the site UI — use their answers; do not repeat the same questions unless something critical is missing.\n\nRespond with clear, practical guidance:\n- How to narrow options by region, budget band, and care level (including memory care when relevant).\n- What to verify next (tours, staffing ratios, care-level fees, discharge policies) without naming specific facilities unless the user supplied names.\n- How Assistedly’s data-backed search can help once they have town/ZIP and budget.\n\nTone: warm, concise, actionable. No medical or legal advice; no guarantees about availability or pricing. If town/ZIP is missing, ask for it once at the end.",
          "user_prompt": "User context from the homepage assistant (questions + optional link parameters):\n\n{{inputs}}"
        }
      },
      {
        "id": "answer_homepage_concierge",
        "type": "answer",
        "data": {
          "text": "{{llm_homepage_concierge.text}}"
        }
      }
    ],
    "edges": [
      { "source": "start", "target": "llm_homepage_concierge" },
      {
        "source": "llm_homepage_concierge",
        "target": "answer_homepage_concierge"
      }
    ]
  }
}
