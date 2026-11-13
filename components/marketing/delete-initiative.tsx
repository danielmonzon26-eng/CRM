"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteInitiative } from "@/app/actions/marketing";
import { buttonClass } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback";

export function DeleteInitiativeButton({ id, name, postCount }: { id: string; name: string; postCount: number }) {
  const router = useRouter();
  const { confirm, toast } = useFeedback();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Delete "${name}"?`,
          body: postCount ? `Its ${postCount} ${postCount === 1 ? "post stays" : "posts stay"} on the planner, no longer part of an initiative.` : "This can't be undone.",
          confirmLabel: "Delete initiative",
          danger: true,
        });
        if (!ok) return;
        startTransition(async () => {
          const result = await deleteInitiative(id).catch(() => ({ error: "That initiative wasn't deleted. Please try again." }));
          if (result.error) toast(result.error, "error");
          else {
            toast("Initiative deleted.");
            router.push("/marketing/initiatives");
          }
        });
      }}
      className={`${buttonClass("ghost")} text-rose-700 hover:bg-rose-50`}
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} />
      Delete
    </button>
  );
}
