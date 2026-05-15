import HomeTypebotHeroEmbed from "./HomeTypebotHeroEmbed";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";
import { useTypebotStandardLoader } from "../hooks/useTypebotStandardLoader";

/**
 * Legacy homepage assistant: Typebot.io React embed.
 * Enable with `NEXT_PUBLIC_HOMEPAGE_ASSISTANT=typebot` (see `HomeAssistantShell.js`).
 */
export default function HomeAssistantTypebotBranch({
    prefilledVariables,
    homepage_layout,
}) {
    const typebotAnalytics = useTypebotAnalytics({ homepage_layout });
    const {
        typebotSectionRef,
        TypebotStandard,
        typebotImportError,
        retryTypebotImport,
    } = useTypebotStandardLoader();

    return (
        <HomeTypebotHeroEmbed
            typebotSectionRef={typebotSectionRef}
            TypebotStandard={TypebotStandard}
            typebotImportError={typebotImportError}
            onRetryTypebotImport={retryTypebotImport}
            prefilledVariables={prefilledVariables}
            onInit={typebotAnalytics.onInit}
            onNewInputBlock={typebotAnalytics.onNewInputBlock}
            onAnswer={typebotAnalytics.onAnswer}
            onEnd={typebotAnalytics.onEnd}
        />
    );
}
