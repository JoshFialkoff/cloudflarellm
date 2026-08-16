import { Html, Head, Main, NextScript } from 'next/document'

const GTM_ID = 'GTM-5MZDBQ5P'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script
          dangerouslySetInnerHTML={{
            __html: 'window.dataLayer=window.dataLayer||[];',
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');
            `.trim(),
          }}
        />
        <link
          rel="icon"
          href="/favicon.png"
          type="image/png"
          sizes="512x512"
        />
      </Head>
      <body suppressHydrationWarning>
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
