import type { ReactNode } from "react";

type Props = {
  title: string;
  src: string;
  subtitle?: ReactNode;
  variant?: "default" | "etf";
};

export default function IframeEmbedPage({ title, src, subtitle, variant = "default" }: Props) {
  const pageClass = variant === "default" ? "holdings-page" : `holdings-page holdings-page--${variant}`;

  return (
    <div className={pageClass}>
      <div className="holdings-header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <div className="holdings-sub">{subtitle}</div> : null}
        </div>
        <div className="header-actions">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            title="在新窗口打开"
          >
            ↗ 新窗口打开
          </a>
        </div>
      </div>

      <div className="holdings-frame-wrap">
        <iframe
          src={src}
          title={title}
          className="holdings-frame"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
