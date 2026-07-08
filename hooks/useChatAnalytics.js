import { useCallback, useRef } from "react";
import {
    messagePreview,
    trackChatCompleted,
    trackChatStarted,
    trackMessageSent,
} from "../lib/chatAnalytics";

const EMPTY_ANALYTICS_PARAMS = Object.freeze({});

/**
 * Stable chat analytics callbacks for React components (replaces useTypebotAnalytics).
 * `trackMessageSent` auto-emits one chat_started event on first interaction.
 */
export function useChatAnalytics(defaultParams = EMPTY_ANALYTICS_PARAMS) {
    const messageIndexRef = useRef(0);
    const startedRef = useRef(false);

    const trackUserMessage = useCallback((params = {}) => {
        const message_index = messageIndexRef.current;
        const mergedParams = { ...defaultParams, ...params };
        if (!startedRef.current) {
            startedRef.current = true;
            trackChatStarted({
                ...mergedParams,
                funnel_stage: "chat_started",
            });
        }
        messageIndexRef.current += 1;
        trackMessageSent({
            message_index,
            ...mergedParams,
            ...(mergedParams.message_preview == null && mergedParams.text != null
                ? { message_preview: messagePreview(mergedParams.text) }
                : {}),
        });
    }, [defaultParams]);

    const trackCompleted = useCallback((params = {}, options) => {
        trackChatCompleted({ ...defaultParams, ...params }, options);
    }, [defaultParams]);

    return {
        trackChatStarted,
        trackMessageSent: trackUserMessage,
        trackChatCompleted: trackCompleted,
        messagePreview,
    };
}

export {
    messagePreview,
    trackChatCompleted,
    trackChatStarted,
    trackMessageSent,
} from "../lib/chatAnalytics";
