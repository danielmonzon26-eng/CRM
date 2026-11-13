import { redirect } from "next/navigation";

/** Marketing items now live in the planner's table view. */
export default function DeliverablesPage() {
  redirect("/marketing/planner?view=table");
}
