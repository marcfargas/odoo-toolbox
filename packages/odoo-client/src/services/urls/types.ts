/**
 * Types for URL generation services.
 */

/**
 * Options for portal URL generation.
 */
export interface PortalUrlOptions {
  /**
   * Suffix to append to the access URL path, before the query string.
   * Example: '/accept' for sale order confirmation links.
   */
  suffix?: string;

  /**
   * Report type query parameter (e.g., 'html', 'pdf', 'text').
   * Commonly used for invoice/quote download links.
   */
  reportType?: 'html' | 'pdf' | 'text';

  /**
   * When true, adds the download=true query parameter.
   * Used with reportType for direct file downloads.
   */
  download?: boolean;
}

/**
 * Result of a portal URL lookup.
 */
export interface PortalUrlResult {
  /** Full portal URL with base URL and access token */
  url: string;

  /** The access_url path from the record (e.g., '/my/orders/42') */
  accessUrl: string;

  /** The access token included in the URL */
  accessToken: string;
}
