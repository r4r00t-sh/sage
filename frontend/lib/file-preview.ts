/**
 * File preview utilities
 * Supports previewing various file types using online viewers and native browser capabilities
 */

export interface PreviewConfig {
  type: 'image' | 'pdf' | 'office' | 'google-viewer' | 'microsoft-viewer' | 'download';
  url: string;
  fallback?: string;
}

/**
 * Get preview configuration for a file based on its MIME type
 */
export function getFilePreviewConfig(
  fileUrl: string,
  mimeType: string,
  filename?: string
): PreviewConfig {
  // Images - direct display
  if (mimeType.startsWith('image/')) {
    return {
      type: 'image',
      url: fileUrl,
    };
  }

  // PDF - direct iframe
  if (mimeType === 'application/pdf') {
    return {
      type: 'pdf',
      url: fileUrl,
    };
  }

  // Microsoft Word documents
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    filename?.endsWith('.doc') ||
    filename?.endsWith('.docx')
  ) {
    return {
      type: 'google-viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    };
  }

  // Microsoft Excel documents
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    filename?.endsWith('.xls') ||
    filename?.endsWith('.xlsx')
  ) {
    return {
      type: 'google-viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    };
  }

  // Microsoft PowerPoint
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    filename?.endsWith('.ppt') ||
    filename?.endsWith('.pptx')
  ) {
    return {
      type: 'google-viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    };
  }

  // OpenDocument formats (ODT, ODS, ODP)
  if (
    mimeType === 'application/vnd.oasis.opendocument.text' ||
    mimeType === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mimeType === 'application/vnd.oasis.opendocument.presentation' ||
    filename?.endsWith('.odt') ||
    filename?.endsWith('.ods') ||
    filename?.endsWith('.odp')
  ) {
    return {
      type: 'google-viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    };
  }

  // Text files
  if (
    mimeType.startsWith('text/') ||
    filename?.endsWith('.txt') ||
    filename?.endsWith('.csv')
  ) {
    return {
      type: 'google-viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    };
  }

  // HTML files
  if (mimeType === 'text/html' || filename?.endsWith('.html') || filename?.endsWith('.htm')) {
    return {
      type: 'pdf',
      url: fileUrl,
    };
  }

  // Try Google Viewer as fallback for other document types
  if (
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation')
  ) {
    return {
      type: 'google-viewer',
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`,
    };
  }

  // Default: show download option
  return {
    type: 'download',
    url: fileUrl,
  };
}

/**
 * Check if a file type can be previewed
 */
export function canPreviewFile(mimeType: string, filename?: string): boolean {
  // Images
  if (mimeType.startsWith('image/')) return true;

  // PDF
  if (mimeType === 'application/pdf') return true;

  // Office documents
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'application/vnd.oasis.opendocument.text' ||
    mimeType === 'application/vnd.oasis.opendocument.spreadsheet' ||
    mimeType === 'application/vnd.oasis.opendocument.presentation' ||
    filename?.endsWith('.doc') ||
    filename?.endsWith('.docx') ||
    filename?.endsWith('.xls') ||
    filename?.endsWith('.xlsx') ||
    filename?.endsWith('.ppt') ||
    filename?.endsWith('.pptx') ||
    filename?.endsWith('.odt') ||
    filename?.endsWith('.ods') ||
    filename?.endsWith('.odp')
  ) {
    return true;
  }

  // Text files
  if (mimeType.startsWith('text/') || filename?.endsWith('.txt') || filename?.endsWith('.csv')) {
    return true;
  }

  // HTML
  if (mimeType === 'text/html' || filename?.endsWith('.html') || filename?.endsWith('.htm')) {
    return true;
  }

  return false;
}

