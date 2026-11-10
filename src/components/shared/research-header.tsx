import type { ReactNode } from "react";
import "./research-premium.css";

export function ResearchHeader({
  index,
  category,
  title,
  description,
  tone = "lime",
  children,
}: {
  index: string;
  category: string;
  title: string;
  description: string;
  tone?: "lime" | "lilac" | "peach";
  children?: ReactNode;
}) {
  return (
    <header className={`page-intro research-header research-tone-${tone}`}>
      <div className="research-heading-copy">
        <div className="research-kicker">
          <span className="research-index" aria-hidden="true">{index}</span>
          <p className="eyebrow">{category}</p>
        </div>
        <h1 className="page-heading">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children && <div className="research-header-actions">{children}</div>}
    </header>
  );
}
