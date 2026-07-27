import React from 'react';
import styles from './CompareModal.module.css';

const CompareModal = ({ facilities, onClose }) => {
  if (!facilities || facilities.length === 0) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        <h2>Compare Facilities</h2>
        <div className={styles.comparisonGrid}>
          {facilities.map((facility) => (
            <div key={facility.slug} className={styles.facilityColumn}>
              <h3>{facility.title}</h3>
              <p><strong>Monthly Range:</strong> {facility.monthlyRange}</p>
              <p><strong>Address:</strong> {facility.address}</p>
              <p><strong>Safety Score:</strong> {facility.safetyScore}/100</p>
              {facility.why && <p><strong>Why this match:</strong> {facility.why}</p>}
              <a href={`/facility/ma/${facility.slug}`} target="_blank" rel="noopener noreferrer" className={styles.profileLink}>
                View Full Profile
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompareModal;
