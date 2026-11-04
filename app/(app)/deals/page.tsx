import { redirect } from "next/navigation";

/** The proposal board lives at /crm; this keeps older links and bookmarks working. */
export default function DealsPage() {
  redirect("/crm");
}
