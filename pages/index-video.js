import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import LandingBanner from "../components/LandingBanner";
import HeroYouTubeFacade from "../components/HeroYouTubeFacade";
import HomeBelowHero from "../components/HomeBelowHero";
import HomeTypebotHeroEmbed from "../components/HomeTypebotHeroEmbed";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";
import HomeHeroActions from "../components/HomeHeroActions";
import { HOMEPAGE_LAYOUT, captureLandingEvent } from "../lib/landingAnalytics";
import { useTypebotStandardLoader } from "../hooks/useTypebotStandardLoader";
import { TYPEBOT_API_ORIGIN } from "../lib/homeTypebotBootstrap";
import {
    homePageVideoVariant,
    metaDescription,
} from "../lib/homePageCopy";

export default function HomeVideoVariant() {
    const [email, setEmail] = useState("");
    const router = useRouter();
    const homepage_layout = HOMEPAGE_LAYOUT.youtube_inline;
    const typebotAnalytics = useTypebotAnalytics({ homepage_layout });
    const { typebotSectionRef, TypebotStandard } = useTypebotStandardLoader();

    const handleTypebotInit = () => {
        typebotAnalytics.onInit?.();
    };

    const handleTypebotNewInputBlock = (input) => {
        typebotAnalytics.onNewInputBlock?.(input);
    };

    const handleCta = (e) => {
        e.preventDefault();
        captureLandingEvent("landing_footer_get_started", {
            homepage_layout,
            has_email: Boolean(email && email.trim()),
        });
        router.push(
            `/search${email ? `?email=${encodeURIComponent(email)}` : ""}`,
        );
    };

    return (
        <>
            <Head>
                <title>{homePageVideoVariant.headTitle}</title>
                <meta name="description" content={metaDescription} />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <meta name="app-shell" content="no-global-navbar" />
                <link rel="dns-prefetch" href={TYPEBOT_API_ORIGIN} />
                <link
                    rel="preconnect"
                    href={TYPEBOT_API_ORIGIN}
                    crossOrigin="anonymous"
                />
            </Head>

            <LandingBanner />

            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <div
                        className={`${styles.heroContent} ${styles.heroHomeContent}`}
                    >
                        <h1 className={styles.heroTitle}>
                            {homePageVideoVariant.heroTitle}
                        </h1>
                        <p className={styles.heroSubtitle}>
                            {homePageVideoVariant.heroSubtitle}
                        </p>
                        <HomeHeroActions homepage_layout={homepage_layout} />
                        <div className={styles.heroHomeVideo}>
                            <HeroYouTubeFacade
                                homepageLayout={homepage_layout}
                                inviteTitle={
                                    homePageVideoVariant.heroVideoInviteTitle
                                }
                                iframeTitle={
                                    homePageVideoVariant.heroVideoInviteTitle
                                }
                            />
                        </div>
                    </div>
                    <HomeTypebotHeroEmbed
                        typebotSectionRef={typebotSectionRef}
                        TypebotStandard={TypebotStandard}
                        onInit={handleTypebotInit}
                        onNewInputBlock={handleTypebotNewInputBlock}
                        onAnswer={typebotAnalytics.onAnswer}
                        onEnd={typebotAnalytics.onEnd}
                    />
                </div>
            </section>

            <HomeBelowHero
                email={email}
                onEmailChange={(e) => setEmail(e.target.value)}
                onCtaSubmit={handleCta}
            />
        </>
    );
}
