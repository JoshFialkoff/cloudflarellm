/**
 * /budget — shortcut to the assisted living / memory care cost calculator.
 *
 * Server-side redirect avoids depending on client-side hydration and is safer
 * behind proxies/CDNs that can surface gateway timeouts for JS-only redirects.
 */
export default function BudgetRedirectPage() {
    return null;
}

export async function getServerSideProps() {
    return {
        redirect: {
            destination: "/tools/cost-calculator",
            permanent: false,
        },
    };
}
