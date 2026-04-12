import { Html, Head, Main, NextScript } from 'next/document'
import { typebotViewerOrigin } from '../lib/typebotEnv'

const GTM_ID = 'GTM-5MZDBQ5P'
const typebotOrigin = typebotViewerOrigin()

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="dns-prefetch" href={typebotOrigin} />
        <link rel="preconnect" href={typebotOrigin} crossOrigin="" />
        <link
          rel="icon"
          href="/favicon.png"
          type="image/png"
          sizes="512x512"
        />
      </Head>
      <body>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
