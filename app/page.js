import HomePageClient from "./HomePageClient";
import { metaDescription } from "../lib/homePageCopy";

export const metadata = {
  title: "Unbiased AI Finds Best Assisted Living in Massachusetts | Assistedly.ai",
  description: metaDescription,
  metadataBase: new URL("https://assistedly.ai"),
  openGraph: {
    title: "Unbiased AI Finds Best Assisted Living in Massachusetts | Assistedly.ai",
    description: metaDescription,
    url: "https://assistedly.ai",
    siteName: "Assistedly.ai",
    images: [
      {
        url: "/aialc-hero-banner.png",
        width: 1200,
        height: 630,
        alt: "Assistedly.ai assisted living matching platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unbiased AI Finds Best Assisted Living in Massachusetts | Assistedly.ai",
    description: metaDescription,
    images: ["/aialc-hero-banner.png"],
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
