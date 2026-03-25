import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import styles from "../styles/Home.module.css";

export default function Home() {
    const [searchQuery, setSearchQuery] = useState("");
    const [email, setEmail] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const router = useRouter();

    const handleSearch = (e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    };

    const handleCta = (e) => {
        e.preventDefault();
        router.push(`/search`);
        router.push(
            `/search${email ? `?email=${encodeURIComponent(email)}` : ""}`,
        );
    };

    return (
        <>
            <Head>
                <title>
                    AI Assist Living Finder - Find Assisted Living in
                    Massachusetts
                </title>
                <meta
                    name="description"
                    content="AI-powered assisted living finder for Massachusetts. Find the perfect facility with compliance tracking and AI matching."
                />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            {/* Navbar */}
            <nav className={styles.navbar}>
                <div className={styles.navContainer}>
                    <Link href="/" className={styles.navLogo}>
                        🏠 AI Assist Living
                    </Link>
                    <div
                        className={`${styles.navLinks} ${menuOpen ? styles.mobileMenu : ""}`}
                    >
                        <Link href="/" className={styles.navLink}>
                            Home
                        </Link>
                        <Link href="#how-it-works" className={styles.navLink}>
                            How It Works
                        </Link>
                        <Link href="#for-families" className={styles.navLink}>
                            For Families
                        </Link>
                        <Link
                            href="#for-communities"
                            className={styles.navLink}
                        >
                            For Communities
                        </Link>
                        <Link href="#contact" className={styles.navLink}>
                            Contact
                        </Link>
                        <Link href="/search" className={styles.navCta}>
                            Find a Facility
                        </Link>
                    </div>
                    <button
                        className={styles.mobileMenuBtn}
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        {menuOpen ? "✕" : "☰"}
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <h1 className={styles.heroTitle}>
                        Find the Right Assisted Living
                        <br />
                        in Massachusetts
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Our AI-powered platform matches families with the
                        perfect assisted living facilities based on care needs,
                        budget, and location — with full compliance
                        transparency.
                    </p>
                    <form className={styles.searchBox} onSubmit={handleSearch}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Enter city or zip code (e.g., Boston, 02101)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className={styles.searchBtn}>
                            Search Facilities
                        </button>
                    </form>
                </div>
            </section>

            {/* How It Works */}
            <section className={styles.howItWorks} id="how-it-works">
                <div className="container">
                    <h2 className={styles.sectionTitle}>How It Works</h2>
                    <p className={styles.sectionSubtitle}>
                        Finding the right assisted living facility has never
                        been easier
                    </p>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>📋</div>
                            <h3 className={styles.stepTitle}>
                                Tell Us Your Needs
                            </h3>
                            <p className={styles.stepDesc}>
                                Share your loved one&apos;s care requirements,
                                budget, and location preferences. Our smart form
                                guides you through every important
                                consideration.
                            </p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>🤖</div>
                            <h3 className={styles.stepTitle}>
                                AI-Powered Matching
                            </h3>
                            <p className={styles.stepDesc}>
                                Our AI analyzes hundreds of data points —
                                compliance records, amenities, staffing ratios,
                                and resident reviews — to find your best
                                matches.
                            </p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>✅</div>
                            <h3 className={styles.stepTitle}>
                                Make an Informed Choice
                            </h3>
                            <p className={styles.stepDesc}>
                                Compare facilities side-by-side with full
                                compliance history, pricing transparency, and
                                real family reviews to make the best decision.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className={styles.trustSection} id="for-families">
                <div className="container">
                    <h2 className={styles.sectionTitle}>
                        Why Families Trust Us
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        We provide the most comprehensive assisted living data
                        in Massachusetts
                    </p>
                    <div className={styles.trustGrid}>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🔍</div>
                            <h3 className={styles.trustCardTitle}>
                                Compliance Tracking
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Access full inspection histories, violation
                                records, and compliance ratings for every
                                licensed facility in Massachusetts.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🤖</div>
                            <h3 className={styles.trustCardTitle}>
                                AI-Powered Matching
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Our machine learning algorithms consider 50+
                                factors to match your loved one with facilities
                                that truly meet their needs.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>📊</div>
                            <h3 className={styles.trustCardTitle}>
                                Transparent Data
                            </h3>
                            <p className={styles.trustCardDesc}>
                                No hidden fees or pay-to-rank facilities. All
                                data is sourced from official Massachusetts DPH
                                records and direct facility reporting.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>📍</div>
                            <h3 className={styles.trustCardTitle}>
                                Local Expertise
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Dedicated to Massachusetts, we have deep
                                knowledge of local regulations, regional care
                                standards, and community resources.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>500+</div>
                    <div className={styles.statLabel}>Facilities Listed</div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>MA</div>
                    <div className={styles.statLabel}>
                        Massachusetts-Focused
                    </div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>100%</div>
                    <div className={styles.statLabel}>Compliance Verified</div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>AI</div>
                    <div className={styles.statLabel}>AI-Powered Matching</div>
                </div>
            </div>

            {/* CTA Section */}
            <section className={styles.ctaSection} id="contact">
                <h2 className={styles.ctaTitle}>Start Your Search Today</h2>
                <p className={styles.ctaSubtitle}>
                    Join thousands of Massachusetts families who found the right
                    care with AI Assist Living
                </p>
                <form className={styles.ctaForm} onSubmit={handleCta}>
                    <input
                        type="email"
                        className={styles.ctaInput}
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <button type="submit" className={styles.ctaBtn}>
                        Get Started Free
                    </button>
                </form>
            </section>

            {/* Footer */}
            <footer className={styles.footer} id="for-communities">
                <div className={styles.footerContent}>
                    <div>
                        <div className={styles.footerLogo}>
                            🏠 AI Assist Living
                        </div>
                        <p className={styles.footerDesc}>
                            Massachusetts&apos;s most trusted AI-powered
                            assisted living finder. Helping families make
                            informed decisions since 2024.
                        </p>
                    </div>
                    <div className={styles.footerLinks}>
                        <div className={styles.footerLinksTitle}>
                            For Families
                        </div>
                        <Link href="/search" className={styles.footerLink}>
                            Find a Facility
                        </Link>
                        <Link
                            href="#how-it-works"
                            className={styles.footerLink}
                        >
                            How It Works
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Family Resources
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Cost Guide
                        </Link>
                    </div>
                    <div className={styles.footerLinks}>
                        <div className={styles.footerLinksTitle}>
                            For Communities
                        </div>
                        <Link href="#" className={styles.footerLink}>
                            List Your Facility
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Provider Login
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Compliance Tools
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Advertise
                        </Link>
                    </div>
                    <div className={styles.footerLinks}>
                        <div className={styles.footerLinksTitle}>Company</div>
                        <Link href="#" className={styles.footerLink}>
                            About Us
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Contact
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Privacy Policy
                        </Link>
                        <Link href="#" className={styles.footerLink}>
                            Terms of Service
                        </Link>
                    </div>
                </div>
                <div className={styles.footerBottom}>
                    <p className={styles.footerCopyright}>
                        © 2026 AI Assist Living Finder. All rights reserved.
                        Focused on Massachusetts assisted living.
                    </p>
                </div>
            </footer>
        </>
    );
}
