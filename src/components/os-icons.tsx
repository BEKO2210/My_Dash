// Minimal, monochrome OS glyphs (currentColor) for the download section.
// Kept as small inline SVGs so no icon dependency or brand asset is needed.

export function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 4.6 10.4 3.58V11.3H3zM11.55 3.43 21 2.1V11.3h-9.45zM3 12.7h7.4v7.72L3 19.4zM11.55 12.7H21v9.2l-9.45-1.3z" />
    </svg>
  );
}

export function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8C2.54 18.18 1.5 15.37 1.5 12.72c0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

export function LinuxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2c2.1 0 3.6 1.62 3.6 3.82 0 1.03.3 1.6 1 2.3C18.4 9.86 19.7 11.7 19.7 15.1c0 3.65-2.3 6.5-7.7 6.5S4.3 18.75 4.3 15.1c0-3.4 1.3-5.24 3.1-6.98.7-.7 1-1.27 1-2.3C8.4 3.62 9.9 2 12 2zm-1.75 3.2a1 1 0 100 2 1 1 0 000-2zm3.5 0a1 1 0 100 2 1 1 0 000-2z"
      />
    </svg>
  );
}
