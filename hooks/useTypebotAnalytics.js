import { useCallback } from "react";

/**
 * Typebot lifecycle hooks for analytics. Extend with PostHog/GTM when wired.
 */
export function useTypebotAnalytics() {
    const onInit = useCallback(() => {}, []);

    const onNewInputBlock = useCallback(() => {}, []);

    const onAnswer = useCallback(() => {}, []);

    return { onInit, onNewInputBlock, onAnswer };
}
