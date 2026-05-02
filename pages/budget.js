import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * /budget — shortcut to the assisted living / memory care cost calculator.
 * Preserves any query params so links like /budget?care_type=memory still work.
 */
export default function BudgetRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        if (!router.isReady) return;
        const { ...rest } = router.query;
        router.replace({
            pathname: "/tools/cost-calculator",
            query: rest,
        });
    }, [router]);

    return null;
}
