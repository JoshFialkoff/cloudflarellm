import dynamic from "next/dynamic";
import { homepageUsesTypebotEmbed } from "../lib/homepageAssistantKind";

const HomeAssistantTypebotBranch = dynamic(
    () => import("./HomeAssistantTypebotBranch"),
    { ssr: false },
);

const HomeAssistantPlayerBranch = dynamic(
    () => import("./HomeAssistantPlayerBranch"),
    { ssr: true },
);

/**
 * Homepage #assistant: default = in-house streaming player; opt-in Typebot embed.
 */
export default function HomeAssistantShell({
    prefilledVariables,
    homepage_layout,
}) {
    if (homepageUsesTypebotEmbed()) {
        return (
            <HomeAssistantTypebotBranch
                prefilledVariables={prefilledVariables}
                homepage_layout={homepage_layout}
            />
        );
    }
    return (
        <HomeAssistantPlayerBranch
            prefilledVariables={prefilledVariables}
            homepage_layout={homepage_layout}
        />
    );
}
