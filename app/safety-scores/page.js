import { redirect } from "next/navigation";

export default function SafetyScoresRedirect() {
  redirect("/top-rated");
}
