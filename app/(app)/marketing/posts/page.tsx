import { redirect } from "next/navigation";

/** Posts are listed on the approvals board. */
export default function PostsIndex() {
  redirect("/marketing/approvals");
}
