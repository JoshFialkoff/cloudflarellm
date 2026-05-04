/** Shared house glyph for nav + banner home affordances. */
export default function HomeIconSvg({ className, size = 22 }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width={size}
            height={size}
            aria-hidden="true"
            focusable="false"
        >
            <path
                fill="currentColor"
                d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"
            />
        </svg>
    );
}
