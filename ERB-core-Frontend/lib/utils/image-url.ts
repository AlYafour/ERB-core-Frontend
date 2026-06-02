/**
 * Utility function to ensure image URLs use HTTPS in production
 * and handle relative/absolute URLs correctly
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url || url === '' || url === 'null' || url === 'undefined') {
    return null;
  }

  // If already a full HTTPS URL, return as is
  if (url.startsWith('https://')) {
    return url;
  }

  // If HTTP URL, convert to HTTPS in production
  if (url.startsWith('http://')) {
    // In production, convert to HTTPS
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      return url.replace('http://', 'https://');
    }
    return url;
  }

  // If relative path starting with /, prepend API URL
  if (url.startsWith('/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // Remove /api if present (since we're adding /media)
    const baseUrl = apiUrl.replace('/api', '');
    return `${baseUrl}${url}`;
  }

  // If path contains /media/, it's a media path
  if (url.includes('/media/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const baseUrl = apiUrl.replace('/api', '');
    if (url.startsWith('/media/')) {
      return `${baseUrl}${url}`;
    }
    return `${baseUrl}/${url}`;
  }

  // Otherwise, assume it's a media filename
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const baseUrl = apiUrl.replace('/api', '');
  return `${baseUrl}/media/${url}`;
}

