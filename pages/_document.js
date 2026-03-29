import { Html, Head, Main, NextScript } from 'next/document'

const GTM_ID = 'GTM-5MZDBQ5P'

export default function Document() {
  return (
    <Html lang="en">
      <Head />
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
