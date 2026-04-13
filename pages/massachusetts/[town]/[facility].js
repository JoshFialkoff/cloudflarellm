import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import styles from "../../../styles/Facility.module.css";
import {
  MASSACHUSETTS_FACILITIES,
  MASSACHUSETTS_FACILITIES_BY_TOWN_AND_SLUG,
} from "../../../lib/massachusettsFacilities";

function StarRating({ rating }) {
  const stars = [];
  for (let i = 1; i <= 5; i += 1) {
    if (i <= Math.floor(rating)) {
      stars.push(
        <span key={i} className={styles.starFull}>
          ★
        </span>
      );
    } else if (i - 0.5 <= rating) {
      stars.push(
        <span key={i} className={styles.starHalf}>
          ★
        </span>
      );
    } else {
      stars.push(
        <span key={i} className={styles.starEmpty}>
          ★
        </span>
      );
    }
  }

  return (
    <div className={styles.starRating}>
      {stars} <span className={styles.ratingNumber}>{rating}/5</span>
    </div>
  );
}

export default function MassachusettsFacilityPage({ facility }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  if (!facility) return null;

  const canonicalPath = `/massachusetts/${facility.town}/${facility.slug}`;
  const canonicalUrl = `https://aiassistliving.com${canonicalPath}`;
  const townLabel = facility.town
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const complianceClass =
    facility.complianceRating === "Excellent"
      ? styles.badgeExcellent
      : facility.complianceRating === "Good"
        ? styles.badgeGood
        : styles.badgeNeedsImprovement;

  const statusClass = (status) => {
    if (status === "Pass" || status === "Resolved") return styles.statusPass;
    if (status === "Corrected") return styles.statusCorrected;
    return styles.statusInProgress;
  };

  const handleFormChange = (event) => {
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    alert("Your message has been sent! The facility will contact you shortly.");
    setFormData({ name: "", email: "", message: "" });
  };

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://aiassistliving.com/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Massachusetts",
        item: "https://aiassistliving.com/massachusetts",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: townLabel,
        item: `https://aiassistliving.com/massachusetts/${facility.town}`,
      },
      { "@type": "ListItem", position: 4, name: facility.name, item: canonicalUrl },
    ],
  };

  const facilityStructuredData = {
    "@context": "https://schema.org",
    "@type": "SeniorLiving",
    name: facility.name,
    address: facility.address,
    telephone: facility.phone,
    email: facility.email,
    areaServed: "Massachusetts",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: facility.rating,
      bestRating: 5,
      worstRating: 1,
    },
  };

  return (
    <>
      <Head>
        <title>{`${facility.name} in ${townLabel}, MA | Assisted Living & Care Details`}</title>
        <meta
          name="description"
          content={`Compare pricing, care types, amenities, and compliance history for ${facility.name} in ${townLabel}, Massachusetts.`}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content={`${facility.name} in ${townLabel}, MA`} />
        <meta
          property="og:description"
          content={`See care options, monthly rates, and compliance history for ${facility.name}.`}
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <link rel="canonical" href={canonicalUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(facilityStructuredData) }}
        />
      </Head>

      <div className={styles.facilityPage}>
        <div className={styles.breadcrumb}>
          <div className="container">
            <Link href="/" className={styles.breadcrumbLink}>
              Home
            </Link>
            <span className={styles.breadcrumbSep}> {" > "} </span>
            <Link href="/massachusetts" className={styles.breadcrumbLink}>
              Massachusetts
            </Link>
            <span className={styles.breadcrumbSep}> {" > "} </span>
            <Link
              href={`/massachusetts/${facility.town}/luxury-assisted-living`}
              className={styles.breadcrumbLink}
            >
              {townLabel}
            </Link>
            <span className={styles.breadcrumbSep}> {" > "} </span>
            <span className={styles.breadcrumbCurrent}>{facility.name}</span>
          </div>
        </div>

        <div className={styles.facilityHeader}>
          <div className="container">
            <div className={styles.headerContent}>
              <div className={styles.headerInfo}>
                <h1 className={styles.facilityName}>{facility.name}</h1>
                <p className={styles.facilityAddress}>📍 {facility.address}</p>
                <StarRating rating={facility.rating} />
                <span className={`${styles.complianceBadge} ${complianceClass}`}>
                  {facility.complianceRating === "Excellent"
                    ? "✓"
                    : facility.complianceRating === "Good"
                      ? "~"
                      : "!"}{" "}
                  {facility.complianceRating} Compliance
                </span>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.tourBtn}>📅 Schedule a Tour</button>
                <button className={styles.contactBtn}>📞 Contact Facility</button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.tabNav}>
          <div className="container">
            <div className={styles.tabs}>
              {["overview", "compliance", "amenities", "contact"].map((tab) => (
                <button
                  key={tab}
                  className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "overview" && "Overview"}
                  {tab === "compliance" && "Compliance History"}
                  {tab === "amenities" && "Amenities"}
                  {tab === "contact" && "Contact"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.tabContent}>
          <div className="container">
            {activeTab === "overview" && (
              <div className={styles.overviewGrid}>
                <div className={styles.overviewMain}>
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>About This Facility</h2>
                    <p className={styles.aboutText}>{facility.about}</p>
                  </div>
                  <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>Care Types Offered</h2>
                    <div className={styles.careTypesList}>
                      {facility.careTypes.map((type) => (
                        <span key={type} className={styles.careTypeBadge}>
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.overviewSidebar}>
                  <div className={styles.infoCard}>
                    <h3 className={styles.infoCardTitle}>Quick Info</h3>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Capacity</span>
                      <span className={styles.infoValue}>{facility.capacity} residents</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Monthly Cost</span>
                      <span className={styles.infoValue}>
                        ${facility.monthlyMin.toLocaleString()} - ${facility.monthlyMax.toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Compliance</span>
                      <span className={`${styles.complianceBadge} ${complianceClass}`}>
                        {facility.complianceRating}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Rating</span>
                      <span className={styles.infoValue}>{facility.rating}/5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "compliance" && (
              <div className={styles.complianceSection}>
                <h2 className={styles.sectionTitle}>Compliance History</h2>
                <p className={styles.sectionDesc}>
                  Inspection records sourced from Massachusetts Department of Public Health
                </p>
                <div className={styles.tableWrapper}>
                  <table className={styles.complianceTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Inspection Type</th>
                        <th>Findings</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facility.complianceHistory.map((row, index) => (
                        <tr key={index}>
                          <td>{row.date}</td>
                          <td>{row.type}</td>
                          <td>{row.findings}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${statusClass(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "amenities" && (
              <div className={styles.amenitiesSection}>
                <h2 className={styles.sectionTitle}>Amenities & Services</h2>
                <div className={styles.amenitiesGrid}>
                  {facility.amenities.map((amenity, index) => (
                    <div key={index} className={styles.amenityCard}>
                      <div className={styles.amenityIcon}>{amenity.icon}</div>
                      <div className={styles.amenityName}>{amenity.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "contact" && (
              <div className={styles.contactSection}>
                <div className={styles.contactGrid}>
                  <div className={styles.contactInfo}>
                    <h2 className={styles.sectionTitle}>Contact Information</h2>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon}>📍</span>
                      <span>{facility.address}</span>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon}>📞</span>
                      <span>{facility.phone}</span>
                    </div>
                    <div className={styles.contactDetail}>
                      <span className={styles.contactIcon}>✉️</span>
                      <span>{facility.email}</span>
                    </div>
                  </div>
                  <div className={styles.contactForm}>
                    <h2 className={styles.sectionTitle}>Send a Message</h2>
                    <form onSubmit={handleFormSubmit}>
                      <div className={styles.formGroup}>
                        <label htmlFor="contact-name" className={styles.formLabel}>
                          Your Name
                        </label>
                        <input
                          id="contact-name"
                          type="text"
                          name="name"
                          className={styles.formInput}
                          value={formData.name}
                          onChange={handleFormChange}
                          placeholder="John Smith"
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="contact-email" className={styles.formLabel}>
                          Email Address
                        </label>
                        <input
                          id="contact-email"
                          type="email"
                          name="email"
                          className={styles.formInput}
                          value={formData.email}
                          onChange={handleFormChange}
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="contact-message" className={styles.formLabel}>
                          Message
                        </label>
                        <textarea
                          id="contact-message"
                          name="message"
                          className={styles.formTextarea}
                          value={formData.message}
                          onChange={handleFormChange}
                          placeholder="I am interested in learning more about care options and pricing..."
                          rows={5}
                          required
                        />
                      </div>
                      <button type="submit" className={styles.submitBtn}>
                        Send Message
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export async function getStaticPaths() {
  return {
    paths: MASSACHUSETTS_FACILITIES.map((facility) => ({
      params: { town: facility.town, facility: facility.slug },
    })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const facility = MASSACHUSETTS_FACILITIES_BY_TOWN_AND_SLUG[`${params.town}/${params.facility}`];

  if (!facility) {
    return { notFound: true };
  }

  return { props: { facility } };
}
