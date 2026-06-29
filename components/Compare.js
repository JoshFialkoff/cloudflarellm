import React, { useState } from 'react';
import styles from './Compare.module.css';
import CompareModal from './CompareModal';

const Compare = ({ facilities }) => {
  const [selected, setSelected] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleSelection = (facility) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(facility)) {
        next.delete(facility);
      } else {
        next.add(facility);
      }
      return next;
    });
  };

  const startComparison = () => {
    setIsModalOpen(true);
  };

  const selectedFacilities = facilities.filter(f => selected.has(f));

  return (
    <>
      <div className={styles.compareContainer}>
        <h3>Compare Facilities</h3>
        <div className={styles.facilityList}>
          {facilities.map(facility => (
            <div key={facility.slug} className={styles.facilityItem}>
              <input
                type="checkbox"
                id={`compare-${facility.slug}`}
                checked={selected.has(facility)}
                onChange={() => toggleSelection(facility)}
              />
              <label htmlFor={`compare-${facility.slug}`}>{facility.title}</label>
            </div>
          ))}
        </div>
        <button
          className={styles.compareButton}
          onClick={startComparison}
          disabled={selected.size < 2}
        >
          Compare Selected ({selected.size})
        </button>
      </div>
      {isModalOpen && (
        <CompareModal
          facilities={selectedFacilities}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
};

export default Compare;