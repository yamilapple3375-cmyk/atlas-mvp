"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", match: (path: string) => path === "/" },
  {
    href: "/context",
    label: "Watch",
    match: (path: string) =>
      path.startsWith("/context") ||
      path.startsWith("/recommendation") ||
      path.startsWith("/discovery-weekly"),
  },
  { href: "/library", label: "Library", match: (path: string) => path.startsWith("/library") },
  {
    href: "/favorites",
    label: "Favorites",
    match: (path: string) => path.startsWith("/favorites"),
  },
  { href: "/account", label: "Account", match: (path: string) => path.startsWith("/account") },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/onboarding")) return null;

  return (
    <nav className="sticky bottom-0 z-10 border-t border-zinc-800 bg-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition ${
                active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span className={`h-1 w-1 rounded-full ${active ? "bg-white" : "bg-transparent"}`} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
