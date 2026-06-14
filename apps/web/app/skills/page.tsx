import { redirect } from "next/navigation";

/** The skills browse moved to /registry (richer: names, descriptions, provider scores). */
export default function SkillsPage() {
  redirect("/registry");
}
