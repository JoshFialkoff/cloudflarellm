import Head from "next/head";
import Link from "next/link";
import ConsumerLeadCapture from "./ConsumerLeadCapture";
import storyStyles from "../styles/BrandStoryPageWrapper.module.css";
import growthStyles from "../styles/GrowthMvp.module.css";

function SectionBlock({ heading, body }) {
  return (
    <section>
      <h2>{heading}</h2>
      {body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}

export default function TrustCenterPage({ slug, page }) {
  const isPrivacy = slug === "privacy";
  // For privacy page, split sections around the lead-capture form
  const beforeForm = isPrivacy ? page.sections.slice(0, 2) : [];
  const afterForm = isPrivacy ? page.sections.slice(2) : page.sections;

  return (
    <>
      <Head>
        <title>{page.title} | Assistedly.ai</title>
        <meta name="description" content={page.description} />
      </Head>
      <main className={storyStyles.page}>
        <section className={storyStyles.hero}>
          <div className={storyStyles.copy}>
            <p className={storyStyles.eyebrow}>Trust Center</p>
            <h1>{page.title}</h1>
            <p className={storyStyles.subtitle}>{page.description}</p>
            <p className={storyStyles.subtitle}>
              Assistedly.ai is designed to feel like Consumer Reports for assisted living:
              transparent, plain-English, and focused on family decisions rather than sales.
            </p>
          </div>
          <div className={growthStyles.matchCta}>
            <ConsumerLeadCapture
              page={`/${slug}`}
              leadMagnet={slug}
              title="Get trust updates and planning tools"
              description="Email yourself the transparency checklist, Massachusetts guide, and tour questions."
            />
          </div>
        </section>
        <article className={storyStyles.story}>
          {beforeForm.map((section) => (
            <SectionBlock key={section.heading} heading={section.heading} body={section.body} />
          ))}
          {isPrivacy && (
            <div className={growthStyles.matchCta} style={{ margin: "2rem 0" }}>
              <ConsumerLeadCapture
                page={`/${slug}`}
                leadMagnet={slug}
                title="Get trust updates and planning tools"
                description="Email yourself the transparency checklist, Massachusetts guide, and tour questions."
              />
            </div>
          )}
          {afterForm.map((section) => (
            <SectionBlock key={section.heading} heading={section.heading} body={section.body} />
          ))}
          <section>
            <h2>Related trust pages</h2>
            <ul>
              <li><Link href="/how-we-work">How we work</Link></li>
              <li><Link href="/how-we-make-money">How we make money</Link></li>
              <li><Link href="/methodology">Methodology</Link></li>
              <li><Link href="/data-sources">Data sources</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/editorial-policy">Editorial policy</Link></li>
            </ul>
          </section>
        </article>
      </main>
    </>
  );
}
