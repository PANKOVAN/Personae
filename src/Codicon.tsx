import type { CSSProperties } from "react";

export type CodiconProps = {
    /** имя без префикса, напр. `book` → класс `codicon-book` */
    name: string;
    size?: number;
    className?: string;
    style?: CSSProperties;
};

export function Codicon({ name, size = 16, className, style }: CodiconProps) {
    const cn = ["codicon", `codicon-${name}`, className].filter(Boolean).join(" ");
    return (
        <span
            className={cn}
            style={{ fontSize: size, lineHeight: 1, verticalAlign: "middle", ...style }}
            aria-hidden
        />
    );
}
