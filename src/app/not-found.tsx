import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-white">
      <p className="text-sm text-slate-400">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
        Back to dashboard
      </Link>
    </main>
  );
}
