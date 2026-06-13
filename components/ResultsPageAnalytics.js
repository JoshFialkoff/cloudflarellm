import { useEffect, useRef } from "react";
import {
    trackAuthResultsDataViewed,
    trackAuthResultsPageViewed,
} from "../lib/authAnalytics";

export default function ResultsPageAnalytics({ authenticated, resultSnapshot }) {
    const viewedRef = useRef(false);
    const dataViewedRef = useRef(false);

    useEffect(() => {
        if (viewedRef.current) return;
        viewedRef.current = true;
        trackAuthResultsPageViewed({
            auth_surface: "results_page",
            authenticated,
            has_result_snapshot: Boolean(resultSnapshot),
            snapshot_kind: resultSnapshot?.kind || undefined,
        });
    }, [authenticated, resultSnapshot]);

    useEffect(() => {
        if (!authenticated || !resultSnapshot || dataViewedRef.current) return;
        dataViewedRef.current = true;
        trackAuthResultsDataViewed({
            auth_surface: "results_page",
            snapshot_kind: resultSnapshot.kind,
        });
    }, [authenticated, resultSnapshot]);

    return null;
}
