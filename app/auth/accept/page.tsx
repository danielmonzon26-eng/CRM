import { AcceptForm } from "./accept-form";

export const dynamic = "force-dynamic";

export default async function AcceptPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: tokenHash, type } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-popover">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-wide text-slate-900">CATAPULT</h1>
          <p className="mt-0.5 text-sm text-slate-600">Set your password to sign in</p>
        </div>
        {tokenHash && type ? (
          <AcceptForm tokenHash={tokenHash} type={type} />
        ) : (
          <p role="alert" className="text-sm text-rose-700">This link isn&apos;t complete. Ask an admin for a new one.</p>
        )}
      </div>
    </main>
  );
}
