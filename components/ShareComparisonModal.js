import React, { useState, useCallback } from 'react';
import styles from './ShareComparisonModal.module.css';

/**
 * ShareComparisonModal — Modal for sharing a comparison via email or SMS.
 *
 * Props:
 *   facilities    — array of facility objects
 *   facilitySlugs — array of slug strings
 *   onClose       — () => void
 *   onShared      — ({ method, recipientEmail }) => void  (optional callback)
 */
export default function ShareComparisonModal({ facilities, facilitySlugs, onClose, onShared }) {
  const [tab, setTab] = useState('email');
  const [form, setForm] = useState({
    senderName: '',
    senderEmail: '',
    recipientEmail: '',
    recipientPhone: '',
    message: '',
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const updateField = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleOverlayClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose],
  );

  const handleCopySms = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(smsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setStatus({ type: 'error', text: 'Could not copy to clipboard.' });
    }
  }, [smsText]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setStatus(null);

      const method = tab;
      const payload = {
        facilitySlugs,
        method,
        senderName: form.senderName.trim() || 'A family member',
        senderEmail: form.senderEmail.trim(),
        message: form.message.trim(),
      };

      if (method === 'email') {
        payload.recipientEmail = form.recipientEmail.trim();
        if (!payload.recipientEmail || !payload.recipientEmail.includes('@')) {
          setStatus({ type: 'error', text: 'Please enter a valid recipient email address.' });
          setLoading(false);
          return;
        }
      } else {
        payload.recipientPhone = form.recipientPhone.trim();
      }

      try {
        const res = await fetch('/api/comparisons/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus({ type: 'error', text: data.error || 'Could not send. Please try again.' });
          setLoading(false);
          return;
        }

        if (method === 'sms') {
          setSmsText(data.smsText || '');
          setSmsSent(Boolean(data.smsSent));
        }

        setSent(true);
        onShared?.({
          method,
          recipientEmail: method === 'email' ? payload.recipientEmail : undefined,
          smsSent: Boolean(data.smsSent),
        });
      } catch (err) {
        setStatus({ type: 'error', text: 'Network error. Please try again.' });
      } finally {
        setLoading(false);
      }
    },
    [tab, form, facilitySlugs, onShared],
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const facilityNames = facilities?.map(f => f.name) || [];

  // ---- Success state (post-send) ----
  if (sent) {
    return (
      <div className={styles.overlay} onClick={handleOverlayClick}>
        <div className={styles.modal}>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">&times;</button>
          <div className={styles.successState}>
            {/* Email: always delivered */}
            {tab === 'email' ? (
              <>
                <div className={styles.successIcon}>✉️</div>
                <h3>Comparison sent!</h3>
                <p>
                  Your comparison was sent to <strong>{form.recipientEmail}</strong>.
                  They can view the full side-by-side comparison and facility details.
                </p>
              </>
            ) : smsSent ? (
              <>
                <div className={styles.successIcon}>📱</div>
                <h3>SMS sent!</h3>
                <p>
                  Your comparison was sent to <strong>{form.recipientPhone}</strong>.
                  They&apos;ll receive a text with the facility details and a link to view the full comparison.
                </p>
              </>
            ) : (
              <>
                <div className={styles.successIcon}>💬</div>
                <h3>Ready to share!</h3>
                <p>
                  {form.recipientPhone
                    ? 'SMS could not be sent automatically. Copy the message below to share.'
                    : 'Copy the message below and send it to your family group chat or any messaging app.'}
                </p>
                <div className={styles.smsPreview}>
                  <div className={styles.smsPreviewLabel}>Message Preview</div>
                  {smsText}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
                    onClick={handleCopySms}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy to clipboard'}
                  </button>
                  <a
                    href={`sms:${form.recipientPhone || ''}&body=${encodeURIComponent(smsText)}`}
                    className={styles.copyBtn}
                    style={{ textDecoration: 'none' }}
                  >
                    📱 Open in Messages
                  </a>
                </div>
              </>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <button className={styles.secondaryBtn} onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Form state ----
  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">&times;</button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>👨‍👩‍👧‍👦</div>
          <h2>Share this comparison</h2>
          <p>Send the comparison table to family members so everyone can review together.</p>
        </div>

        {/* Facility chips */}
        <div className={styles.facilityBar}>
          {facilityNames.map(name => (
            <span key={name} className={styles.facilityChip}>{name}</span>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${tab === 'email' ? styles.tabActive : ''}`}
            onClick={() => setTab('email')}
          >
            <span className={styles.tabIcon}>✉️</span> Email
          </button>
          <button
            className={`${styles.tab} ${tab === 'sms' ? styles.tabActive : ''}`}
            onClick={() => setTab('sms')}
          >
            <span className={styles.tabIcon}>💬</span> SMS / Text
          </button>
        </div>

        {/* Form */}
        <div className={styles.content}>
          <form onSubmit={handleSubmit}>
            {/* Your name (shared) */}
            <div className={styles.formGroup}>
              <label htmlFor="share-sender-name">Your name</label>
              <input
                id="share-sender-name"
                type="text"
                value={form.senderName}
                onChange={updateField('senderName')}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            {/* Your email (for lead capture, optional) */}
            <div className={styles.formGroup}>
              <label htmlFor="share-sender-email">
                Your email <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="share-sender-email"
                type="email"
                value={form.senderEmail}
                onChange={updateField('senderEmail')}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <span className={styles.hint}>Receive updates on these facilities and new options.</span>
            </div>

            {/* Tab-specific fields */}
            {tab === 'email' ? (
              <div className={styles.formGroup}>
                <label htmlFor="share-recipient-email">Family member&apos;s email</label>
                <input
                  id="share-recipient-email"
                  type="email"
                  required
                  value={form.recipientEmail}
                  onChange={updateField('recipientEmail')}
                  placeholder="family@example.com"
                  autoComplete="off"
                />
              </div>
            ) : (
              <div className={styles.formGroup}>
                <label htmlFor="share-recipient-phone">
                  Family member&apos;s phone number
                </label>
                <input
                  id="share-recipient-phone"
                  type="tel"
                  value={form.recipientPhone}
                  onChange={updateField('recipientPhone')}
                  placeholder="(617) 555-0101"
                  autoComplete="tel"
                />
                <span className={styles.hint}>
                  US number. If Twilio is configured, the SMS will be sent automatically.
                  Otherwise, you can copy the message to send yourself.
                </span>
              </div>
            )}

            {/* Personal message */}
            <div className={styles.formGroup}>
              <label htmlFor="share-message">
                Personal message <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="share-message"
                value={form.message}
                onChange={updateField('message')}
                placeholder="Hey! I'm comparing these assisted living facilities — what do you think?"
                rows={3}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading
                ? 'Sending...'
                : tab === 'email'
                  ? '✉️ Send comparison to family'
                  : '📱 Send text to family'}
            </button>

            {/* Status */}
            {status && (
              <div className={`${styles.status} ${
                status.type === 'success'
                  ? styles.statusSuccess
                  : status.type === 'error'
                    ? styles.statusError
                    : styles.statusInfo
              }`}>
                {status.text}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
