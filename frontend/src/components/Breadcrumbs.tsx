import React from "react";
import type { ID } from "@/types";

export type Crumb = { id?: ID; label: string };

type Props = {
  items: Crumb[];
  onClick?: (id?: ID) => void;
};

export default function Breadcrumbs({ items, onClick }: Props) {
  return (
    <nav className="text-sm text-slate-600">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center">
              {!isLast ? (
                <button
                  onClick={() => onClick?.(c.id)}
                  className="hover:underline text-blue-700"
                >
                  {c.label}
                </button>
              ) : (
                <span className="font-medium">{c.label}</span>
              )}
              {!isLast && <span className="mx-2 text-slate-400">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
