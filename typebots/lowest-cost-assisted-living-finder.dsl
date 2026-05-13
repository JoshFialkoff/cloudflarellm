{
  "app": {
    "name": "Lowest-Cost Assisted Living Finder",
    "mode": "workflow",
    "icon": "💸",
    "description": "Question-first workflow for lower-income Massachusetts families looking for lower-cost assisted living and memory care paths."
  },
  "workflow": {
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "data": {}
      },
      {
        "id": "llm_lowest_cost_strategy",
        "type": "llm",
        "data": {
          "model": "gpt-4o-mini",
          "temperature": 0.25,
          "stream": true,
          "system_prompt": "You are Assistedly's Lowest-Cost Assisted Living Finder for lower-income Massachusetts residents and families. The user has already answered screening questions in the site UI. Use their answers below — do not re-ask the same screening questions unless a critical detail is missing.\n\nProvide \"Preliminary Cost-Lowering Guidance\" with:\n- Budget gap snapshot using monthly_budget, estimated_low, and estimated_high if provided in the context.\n- Lower-priced Massachusetts region strategies within the driving-distance answer.\n- Manageable care-plan changes that may lower cost without cutting required safety care.\n- Funding paths to investigate: MassHealth, Frail Elder Waiver, Group Adult Foster Care, PACE where available, ASAP/Area Agency on Aging, local Council on Aging, SHINE, Veterans Aid & Attendance, long-term care insurance review, HUD/Section 202 senior housing when appropriate, Alzheimer's Association respite/support, and local nonprofits.\n- Five questions to ask facilities about total monthly cost, care-level increases, MassHealth/private-pay policy, move-in fees, and discharge/higher-level-of-care triggers.\n\nDo not guarantee eligibility or savings. Do not invent facility names. If location or drive time is missing, ask for town/ZIP and maximum drive time. Warn clearly not to cut secured memory care, overnight supervision, medication management, transfer support, or dementia staffing when those are safety needs.",
          "user_prompt": "Here is what the user shared (questionnaire and optional URL context):\n\n{{inputs}}"
        }
      },
      {
        "id": "answer_lowest_cost_strategy",
        "type": "answer",
        "data": {
          "text": "{{llm_lowest_cost_strategy.text}}"
        }
      }
    ],
    "edges": [
      {
        "source": "start",
        "target": "llm_lowest_cost_strategy"
      },
      {
        "source": "llm_lowest_cost_strategy",
        "target": "answer_lowest_cost_strategy"
      }
    ]
  }
}
