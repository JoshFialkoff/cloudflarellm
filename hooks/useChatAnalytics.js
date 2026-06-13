import { useCallback, useRef } from "react";
import {
    messagePreview,
    trackChatCompleted,
    trackChatStarted,
    trackMessageSent,
} from "../lib/chatAnalytics";

/**
 * Stable chat analytics callbacks for React components (replaces useTypebotAnalytics).
 * Call trackChatStarted once when the widget mounts (see HomeAssistantShell).
 */
export function useChatAnalytics() {
    const messageIndexRef = useRef(0);

    const trackUserMessage = useCallback((params = {}) => {
        const message_index = messageIndexRef.current;
        messageIndexRef.current += 1;
        trackMessageSent({
            message_index,
            ...params,
            ...(params.message_preview == null && params.text != null
                ? { message_preview: messagePreview(params.text) }
                : {}),
        });
    }, []);

    const trackCompleted = useCallback((params = {}, options) => {
        trackChatCompleted(params, options);
    }, []);

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
