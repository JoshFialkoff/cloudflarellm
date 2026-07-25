'use client';

import React, { useState } from 'react';
import { Lock, Mail, Sparkles, CheckCircle, Building2, BarChart3, ShieldCheck } from 'lucide-react';
// @ts-ignore — JS component without types
import AuthCapture from '../../components/AuthCapture';

export default function AnswersAuthGate({ redirectTo = '/answers' }) {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const features = [
    { icon: <Building2 size={18} />, text: 'Compare 100+ Massachusetts communities' },
    { icon: <BarChart3 size={18} />, text: 'See cost breakdowns by city & zip code' },
    { icon: <ShieldCheck size={18} />, text: 'Review safety ratings & care quality data' },
    { icon: <Sparkles size={18} />, text: 'Ask our AI any assisted-living question' },
  ];

  return (
    <div className="answers-auth-gate" style={containerStyle}>
      <div style={cardStyle}>
        <div style={lockIconWrapStyle}>
          <Lock size={28} color="#6d1247" />
        </div>
        <h1 style={headingStyle}>Unlock Data-Powered Answers</h1>
        <p style={subheadingStyle}>
          Get instant access to our full Massachusetts assisted-living database,
          AI search assistant, and comparison tools.
        </p>
        <div style={benefitsStyle}>
          {features.map((f, i) => (
            <div key={i} style={benefitItemStyle}>
              <span style={benefitIconStyle}>{f.icon}</span>
              <span style={benefitTextStyle}>{f.text}</span>
            </div>
          ))}
        </div>
        <div style={formWrapStyle}>
          {!submitted ? (
            <>
              <p style={reasonStyle}>
                <Mail size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Enter your email for instant, free access.
              </p>
              {/* @ts-ignore — JS component without strict prop types */}
              <AuthCapture
                redirectTo={redirectTo}
                authSurface="answers_gate"
                reason="Enter your email to unlock full access to Data-Powered Answers."
                successMessage="Check your email for the sign-in link."
                fallbackMessage="Test mode: use the sign-in link below."
                onSuccess={(emailVal: string) => {
                  setSubmitted(true);
                  setEmail(emailVal);
                }}
              />
            </>
          ) : (
            <div style={successPanelStyle}>
              <CheckCircle size={40} color="#4a7c7e" />
              <h2 style={successHeadingStyle}>Sign-in link sent!</h2>
              <p style={successTextStyle}>
                We emailed a secure sign-in link to <strong>{email}</strong>.
              </p>
              <p style={successTextStyle}>
                Click the link in your inbox to unlock full access.
              </p>
              <button style={resendBtnStyle} onClick={() => setSubmitted(false)} type="button">
                Use a different email
              </button>
            </div>
          )}
        </div>
        <p style={footerStyle}>
          No spam. Unsubscribe anytime. We only use your email to save your
          preferences and send research updates you opt into.
        </p>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '2rem 1rem', background: 'linear-gradient(180deg, #f9f6f2 0%, #fff 100%)',
};
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  padding: 'clamp(1.5rem, 4vw, 3rem)', maxWidth: 520, width: '100%', textAlign: 'center',
};
const lockIconWrapStyle: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%', background: '#f3e8f0',
  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem',
};
const headingStyle: React.CSSProperties = {
  fontSize: 'clamp(1.4rem, 3vw, 1.75rem)', fontWeight: 700, color: '#2d2d2d',
  margin: '0 0 0.5rem', lineHeight: 1.25,
};
const subheadingStyle: React.CSSProperties = {
  fontSize: '0.95rem', color: '#666', lineHeight: 1.55, margin: '0 0 1.5rem',
};
const benefitsStyle: React.CSSProperties = {
  textAlign: 'left', background: '#faf8f5', borderRadius: 12,
  padding: '1rem 1.25rem', marginBottom: '1.5rem',
};
const benefitItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '0.35rem 0',
  fontSize: '0.9rem', color: '#444',
};
const benefitIconStyle: React.CSSProperties = { color: '#4a7c7e', flexShrink: 0 };
const benefitTextStyle: React.CSSProperties = { lineHeight: 1.4 };
const formWrapStyle: React.CSSProperties = { marginBottom: '1rem' };
const reasonStyle: React.CSSProperties = {
  fontSize: '0.9rem', color: '#555', margin: '0 0 0.75rem',
};
const successPanelStyle: React.CSSProperties = { padding: '1.5rem 0.5rem' };
const successHeadingStyle: React.CSSProperties = {
  fontSize: '1.25rem', fontWeight: 700, color: '#2d2d2d', margin: '1rem 0 0.5rem',
};
const successTextStyle: React.CSSProperties = {
  fontSize: '0.95rem', color: '#555', lineHeight: 1.5, margin: '0 0 0.5rem',
};
const resendBtnStyle: React.CSSProperties = {
  marginTop: '1rem', fontSize: '0.85rem', color: '#6d1247', background: 'transparent',
  border: 'none', textDecoration: 'underline', cursor: 'pointer',
};
const footerStyle: React.CSSProperties = {
  fontSize: '0.75rem', color: '#999', lineHeight: 1.45, margin: 0,
};
