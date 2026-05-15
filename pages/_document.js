import { Html, Head, Main, NextScript } from 'next/document'

const GTM_ID = 'GTM-5MZDBQ5P'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.dataLayer=window.dataLayer||[];',
          }}
        />
        <link
          rel="icon"
          href="/favicon.png"
          type="image/png"
          sizes="512x512"
        />
      </Head>
      <body>
        {process.env.NODE_ENV !== 'production' ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `
(function () {
  var maxMs = 6000;
  var start = Date.now();
  function stripFouc() {
    try {
      document.querySelectorAll('[data-next-hide-fouc]').forEach(function (n) {
        if (n && n.parentNode) n.parentNode.removeChild(n);
      });
    } catch (e) {}
  }
  var id = setInterval(function () {
    if (!document.querySelector('[data-next-hide-fouc]')) {
      clearInterval(id);
      return;
    }
    if (Date.now() - start > maxMs) {
      stripFouc();
      clearInterval(id);
    }
  }, 150);
})();
              `.trim(),
            }}
          />
        ) : null}
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
