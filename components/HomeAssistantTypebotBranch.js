import HomeAssistantPlayerBranch from "./HomeAssistantPlayerBranch";

/**
 * `NEXT_PUBLIC_HOMEPAGE_ASSISTANT=typebot` used to load the @typebot.io React embed; those
 * components were removed from this repo. This branch reuses the in-house player so the
 * app still builds and the assistant still works.
 */
export default function HomeAssistantTypebotBranch(props) {
    return <HomeAssistantPlayerBranch {...props} />;
}
