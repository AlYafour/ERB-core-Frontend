// Server component — route segment config is only respected in server components.
// Rendering is delegated to the client component in _content.tsx.
export const dynamic = 'force-dynamic';
export { default } from './_content';
