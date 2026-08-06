'use client'

import { useMemo, useState } from "react";
import styles from "../styles/GrowthMvp.module.css";

const PROMPTS = {
  compare: "Compare these facilities in plain English for a Massachusetts family.",
  compliance: "Explain the compliance findings and what follow-up questions a family should ask.",
  pricing: "Explain the pricing range, likely add-on fees, and what cost questions to ask on tour.",
  questions: "Generate the most important questions to ask each facility before touring.",
  checklist: "Create a tour checklist for these facilities. Do not give medical advice.",
};

export default function AssistantResearchPanel({ facilities = [] }) {
  const [selectedPrompt, setSelectedPrompt] = useState("compare");
  const [status, setStatus] = useState("idle");
  const [answer, setAnswer] = useState("");

  const location = useMemo(() => {
    const towns = Array.from(new Set(facilities.map((facility) => facility.town))).filter(Boolean);
    return towns.length ? towns.join(", ") : "Massachusetts";
  }, [facilities]);

  const monthlyBudget = useMemo(() => {
    if (!facilities.length) return 6500;
    return Math.round(
      facilities.reduce((sum, facility) => sum + Number(facility.monthlyMax || 0), 0) /
        facilities.length,
    );
  }, [facilities]);

  async function runPrompt() {
    if (!facilities.length) return;
    setStatus("loading");
    setAnswer("");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${PROMPTS[selectedPrompt]}\n\nFacilities:\n${facilities
          .map(
            (facility) =>
              `- ${facility.name} (${facility.address}) | ${facility.careTypes.join(", ")} | $${facility.monthlyMin.toLocaleString()}-$${facility.monthlyMax.toLocaleString()}/mo | ${facility.complianceRating} compliance`,
          )
          .join("\n")}`,
        inputs: {
          Location: location,
          monthly_budget: monthlyBudget,
        },
        user: "comparison-assistant",
      }),
    });

    if (!response.ok || !response.body) {
      setStatus("error");
      setAnswer("The AI assistant is temporarily unavailable. Please try again.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    setStatus("done");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return;
        try {
          const parsed = JSON.parse(trimmed.slice(5).trim());
          if (parsed.answer) {
            setAnswer(parsed.answer);
          } else if (parsed.text) {
            setAnswer((current) => current + parsed.text);
          }
        } catch {
          // ignore malformed SSE payloads
        }
      });
    }
  }

  return (
    <section className={styles.captureCard}>
      <h3>AI research assistant</h3>
      <p>
        Use the existing Assistedly.ai assistant workflow to compare facilities, explain
        compliance, understand pricing, and generate tour questions. This tool is for
        research support only and does not provide medical advice.
      </p>
      <div className={styles.shareActions}>
        {Object.entries(PROMPTS).map(([key]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSelectedPrompt(key)
              setAnswer("")
              setStatus("idle")
            }}
            style={{
              background: selectedPrompt === key ? "var(--primary)" : undefined,
              color: selectedPrompt === key ? "var(--white)" : undefined,
            }}
          >
            {key === "compare" && "Compare"}
            {key === "compliance" && "Compliance"}
            {key === "pricing" && "Pricing"}
            {key === "questions" && "Questions"}
            {key === "checklist" && "Checklist"}
          </button>
        ))}
      </div>
      <button type="button" onClick={runPrompt} disabled={!facilities.length || status === "loading"}>
        {status === "loading" ? "Thinking..." : "Run assistant"}
      </button>
      {answer ? (
        <div className={styles.aiSummary}>
          <strong>Assistant response</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p>
        </div>
      ) : null}
    </section>
  );
}
