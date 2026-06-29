import React from 'react';
import styles from './StickySummary.module.css';

const StickySummary = ({ searchContext }) => {
  if (!searchContext) {
    return null;
  }

  const { careType, monthlyBudget, location } = searchContext;

  return (
    <div className={styles.stickyContainer}>
      <div className={styles.summaryContent}>
        <h3>Your Search</h3>
        <p><strong>Care Type:</strong> {careType}</p>
        <p><strong>Budget:</strong> ${monthlyBudget.toLocaleString()}/mo</p>
        <p><strong>Location:</strong> {location}</p>
        <button className={styles.editButton} onClick={() => window.history.back()}>
          Edit Search
        </button>
      </div>
    </div>
  );
};

export default StickySummary;
