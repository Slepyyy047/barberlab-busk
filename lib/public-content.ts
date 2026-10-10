import { cache } from 'react';
import { getContent } from './store';

// Deduplicate reads within a server render only; each new request sees the current CMS data.
// Admin APIs deliberately continue using the uncached store functions.
export const getPublicContent = cache(getContent);
