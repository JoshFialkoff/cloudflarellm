import { useMemo, useState } from "react";
import Head from "next/head";
import styles from "../styles/Concierge.module.css";

function scorePreview(values) {
    const budgetBase =
        values.budget === "20000+" ? 96 : values.budget === "15000-20000" ? 90 : 82;
    const timelineBase =
        values.timeline === "0-30" ? 93 : values.timeline === "31-60" ? 86 : 80;
    const careBase =
        values.careLevel === "memory-care" ? 84 : values.careLevel === "high-acuity" ? 80 : 88;
    const fit = Math.max(72, Math.min(98, Math.round((budgetBase + careBase) / 2)));
    const speed = Math.max(70, Math.min(97, Math.round((timelineBase + budgetBase) / 2)));
    const risk = Math.max(12, Math.min(48, 100 - Math.round((fit + speed) / 2)));
    return { fit, speed, risk };
}

const initial = {
    name: "",
    email: "",
    phone: "",
    city: "",
    budget: "10000-15000",
    timeline: "31-60",
    careLevel: "assisted-living",
    notes: "",
};

export default function ConciergePage() {
    const [form, setForm] = useState(initial);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [ok, setOk] = useState("");
    const scores = useMemo(() => scorePreview(form), [form]);

    const onChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const onSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        setOk("");
        try {
            const r = await fetch("/api/concierge-intake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    scoreFit: scores.fit,
                    scoreSpeed: scores.speed,
                    scoreRisk: scores.risk,
                }),
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
                setError(
                    typeof data.error === "string"
                        ? data.error
                        : "Something went wrong. Please try again.",
                );
                return;
            }
            setOk(
                "Thanks - your request is in. We will send your concierge shortlist within 72 hours.",
            );
            setForm(initial);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Head>
                <title>72-Hour Concierge Shortlist | Assistedly.ai</title>
                <meta
                    name="description"
                    content="Private-pay concierge shortlist for Massachusetts assisted living and memory care families."
                />
            </Head>
            <main className={styles.page}>
                <div className={styles.wrap}>
                    <section className={styles.hero}>
                        <span className={styles.badge}>MVP - Private-Pay Concierge</span>
                        <h1 className={styles.title}>72-Hour Concierge Shortlist</h1>
                        <p className={styles.subtitle}>
                            For families evaluating $10,000+/month assisted living and
                            memory care options in Massachusetts.
                        </p>
                    </section>

                    <section className={styles.grid}>
                        <div className={styles.panel}>
                            <h2>Request your shortlist</h2>
                            <form className={styles.form} onSubmit={onSubmit}>
                                <div className={styles.row}>
                                    <label className={styles.label}>
                                        Full name
                                        <input
                                            className={styles.input}
                                            name="name"
                                            value={form.name}
                                            onChange={onChange}
                                            required
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        Email
                                        <input
                                            className={styles.input}
                                            type="email"
                                            name="email"
                                            value={form.email}
                                            onChange={onChange}
                                            required
                                        />
                                    </label>
                                </div>
                                <div className={styles.row}>
                                    <label className={styles.label}>
                                        Phone
                                        <input
                                            className={styles.input}
                                            name="phone"
                                            value={form.phone}
                                            onChange={onChange}
                                            placeholder="Optional"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        Preferred city/region
                                        <input
                                            className={styles.input}
                                            name="city"
                                            value={form.city}
                                            onChange={onChange}
                                            placeholder="e.g., Newton, Wellesley, Boston"
                                        />
                                    </label>
                                </div>
                                <div className={styles.row}>
                                    <label className={styles.label}>
                                        Monthly budget
                                        <select
                                            className={styles.select}
                                            name="budget"
                                            value={form.budget}
                                            onChange={onChange}
                                        >
                                            <option value="10000-15000">$10k-$15k</option>
                                            <option value="15000-20000">$15k-$20k</option>
                                            <option value="20000+">$20k+</option>
                                        </select>
                                    </label>
                                    <label className={styles.label}>
                                        Move timeline
                                        <select
                                            className={styles.select}
                                            name="timeline"
                                            value={form.timeline}
                                            onChange={onChange}
                                        >
                                            <option value="0-30">0-30 days</option>
                                            <option value="31-60">31-60 days</option>
                                            <option value="61-90">61-90 days</option>
                                        </select>
                                    </label>
                                </div>
                                <label className={styles.label}>
                                    Care level
                                    <select
                                        className={styles.select}
                                        name="careLevel"
                                        value={form.careLevel}
                                        onChange={onChange}
                                    >
                                        <option value="assisted-living">Assisted living</option>
                                        <option value="memory-care">Memory care</option>
                                        <option value="high-acuity">High-acuity / complex</option>
                                    </select>
                                </label>
                                <label className={styles.label}>
                                    Top priorities
                                    <textarea
                                        className={styles.textarea}
                                        name="notes"
                                        value={form.notes}
                                        onChange={onChange}
                                        placeholder="Examples: dementia-trained staff, immediate move-in, high service quality, strong activity program, low hidden-fee risk."
                                    />
                                </label>
                                <button className={styles.btn} disabled={submitting} type="submit">
                                    {submitting
                                        ? "Submitting..."
                                        : "Request Concierge Shortlist - $499"}
                                </button>
                                {error ? <p className={styles.error}>{error}</p> : null}
                                {ok ? <p className={styles.ok}>{ok}</p> : null}
                            </form>
                        </div>

                        <aside className={styles.panel}>
                            <h2>Private-pay fit preview</h2>
                            <div className={styles.score}>
                                <div className={styles.scoreCard}>
                                    <div className={styles.scoreLabel}>Fit score</div>
                                    <div className={styles.scoreValue}>{scores.fit}/100</div>
                                </div>
                                <div className={styles.scoreCard}>
                                    <div className={styles.scoreLabel}>Speed-to-move-in score</div>
                                    <div className={styles.scoreValue}>{scores.speed}/100</div>
                                </div>
                                <div className={styles.scoreCard}>
                                    <div className={styles.scoreLabel}>Hidden-fee risk score</div>
                                    <div className={styles.scoreValue}>{scores.risk}/100</div>
                                </div>
                            </div>
                            <ul className={styles.list}>
                                <li>Includes top-3 matched communities.</li>
                                <li>Explains tradeoffs and fee structures.</li>
                                <li>Flags risk before you tour or deposit.</li>
                                <li>Delivered within 72 hours.</li>
                            </ul>
                        </aside>
                    </section>
                </div>
            </main>
        </>
    );
}
