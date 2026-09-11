export function downloadDataUri(dataUri, filename) {
  if (typeof document === 'undefined') {
    throw new Error('Downloads are only available in a browser.');
  }

  const [header, encodedData] = String(dataUri).split(',', 2);
  if (!header || !encodedData) {
    throw new Error('The generated PDF is invalid.');
  }

  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) {
    throw new Error('The generated PDF has an unsupported format.');
  }

  const binary = window.atob(encodedData);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeMatch[1] }));
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
