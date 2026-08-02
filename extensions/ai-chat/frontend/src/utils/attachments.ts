/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/**
 * Files and screenshots the user attaches to a message.
 *
 * Attachments are read in the browser and travel with the user turn, so they
 * stay in context for follow-up questions without server-side storage. Text
 * files become delimited blocks inside the message and images travel beside
 * it as image parts. Both are bounded here and framed as data by the system
 * prompt, which tells the model that attachments are reference material and
 * never instructions.
 */
import { translation } from '@apache-superset/core';
import type { AttachmentRef, ProtocolImage, ProtocolMessage } from '../types';

const { t } = translation;

/** Extensions that carry text the model can read */
export const TEXT_EXTENSIONS = [
  '.csv',
  '.json',
  '.log',
  '.md',
  '.py',
  '.sql',
  '.tsv',
  '.txt',
  '.yaml',
  '.yml',
];

/** Image types every vision-capable provider accepts */
export const IMAGE_MEDIA_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const IMAGE_EXTENSIONS = Object.keys(IMAGE_MEDIA_TYPES);

/** `accept` value for the file picker */
export const ATTACHMENT_ACCEPT = [...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS].join(
  ',',
);

export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 1024 * 1024;
/** Roughly a few thousand tokens per file, leaving room for the answer */
export const MAX_ATTACHMENT_CHARS = 20_000;

/** Screenshots are downscaled before sending, so the raw file can be large */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Longest edge kept after downscaling: readable text, far fewer tokens */
export const MAX_IMAGE_EDGE = 1400;
/** Above this, an image is worth re-encoding before it is sent */
export const SOFT_IMAGE_BASE64_CHARS = 400_000;
/** Mirrors the gateway's per-image hard bound */
export const MAX_IMAGE_BASE64_CHARS = 4_000_000;
/** Mirrors the gateway's bound across every image of one request */
export const MAX_TOTAL_IMAGE_BASE64_CHARS = 8_000_000;

export const BLOCK_OPEN = 'ATTACHED-FILE';

export interface TextAttachment {
  kind: 'text';
  id: string;
  name: string;
  /** File text, already bounded and stripped of block markers */
  text: string;
  truncated: boolean;
}

export interface ImageAttachment {
  kind: 'image';
  id: string;
  name: string;
  mediaType: string;
  /** Base64 payload sent to the gateway, without the data URL prefix */
  data: string;
  /** Data URL used for the on-screen preview */
  preview: string;
}

export type Attachment = TextAttachment | ImageAttachment;

// Markers a file could use to close its own block and carry on as if it were
// the user speaking
const MARKERS = /<\/?(?:ATTACHED-FILE|UNTRUSTED-CONTENT)[^>]*>/gi;

/** A file name is a label: no control characters, quotes or angle brackets */
function sanitizeName(raw: string): string {
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/["<>]/g, '')
    .trim();
  return cleaned.slice(0, 100) || t('attachment');
}

function attachmentId(name: string): string {
  return `file_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}_${name}`;
}

function extensionOf(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot < 0 ? '' : lower.slice(dot);
}

/** FileReader rather than `Blob.text()`, which is not available everywhere */
function read(
  file: File,
  as: 'text' | 'dataUrl',
  name: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(t('%s could not be read.', name)));
    if (as === 'text') reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

function base64Of(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/**
 * Re-encodes an image with its longest edge bounded, since a screenshot from
 * a high-density display costs tokens and latency for detail no model needs.
 * Browser only, so callers treat a rejection as "keep the original".
 */
export function shrinkImage(
  dataUrl: string,
  maxEdge = MAX_IMAGE_EDGE,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const longest = Math.max(image.width, image.height) || 1;
      const scale = Math.min(1, maxEdge / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('canvas unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    image.onerror = () => reject(new Error('image could not be decoded'));
    image.src = dataUrl;
  });
}

async function readImage(file: File, name: string): Promise<ImageAttachment> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      t(
        '%s is too large. Images are limited to %s MB.',
        name,
        Math.round(MAX_IMAGE_BYTES / 1024 / 1024),
      ),
    );
  }
  const original = await read(file, 'dataUrl', name);
  let dataUrl = original;
  // Trust the browser's sniffing over the extension when it recognizes the
  // bytes, otherwise a JPEG saved as .png is mislabelled and the provider
  // rejects it
  const declared = original.slice(5, Math.max(original.indexOf(';'), 5));
  let mediaType = Object.values(IMAGE_MEDIA_TYPES).includes(declared)
    ? declared
    : IMAGE_MEDIA_TYPES[extensionOf(file.name)];
  if (base64Of(original).length > SOFT_IMAGE_BASE64_CHARS) {
    // Not fatal: the original is used when it still fits
    const shrunk = await shrinkImage(original).catch(() => null);
    if (shrunk && shrunk.length < original.length) {
      dataUrl = shrunk;
      mediaType = 'image/jpeg';
    }
  }
  const data = base64Of(dataUrl);
  if (data.length > MAX_IMAGE_BASE64_CHARS) {
    throw new Error(t('%s could not be prepared. Try a smaller image.', name));
  }
  return {
    kind: 'image',
    id: attachmentId(name),
    name,
    mediaType,
    data,
    preview: dataUrl,
  };
}

async function readTextFile(file: File, name: string): Promise<TextAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      t(
        '%s is too large. Attachments are limited to %s KB.',
        name,
        Math.round(MAX_ATTACHMENT_BYTES / 1024),
      ),
    );
  }
  const cleaned = (await read(file, 'text', name)).replace(MARKERS, '');
  const truncated = cleaned.length > MAX_ATTACHMENT_CHARS;
  const text = truncated
    ? `${cleaned.slice(0, MAX_ATTACHMENT_CHARS)}\n[truncated: only the first ${MAX_ATTACHMENT_CHARS} characters of this file are included]`
    : cleaned;
  return { kind: 'text', id: attachmentId(name), name, text, truncated };
}

/**
 * Reads a picked file into an attachment, rejecting with a user-facing
 * message when the file cannot be used.
 */
export async function readAttachment(file: File): Promise<Attachment> {
  const name = sanitizeName(file.name);
  const extension = extensionOf(file.name);
  if (extension in IMAGE_MEDIA_TYPES) return readImage(file, name);
  if (TEXT_EXTENSIONS.includes(extension)) return readTextFile(file, name);
  throw new Error(
    t(
      '%s cannot be attached. Supported file types: %s.',
      name,
      [...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS].join(', '),
    ),
  );
}

/**
 * Builds the message sent to the gateway: the typed text followed by one
 * delimited block per attached text file. Only this composed form enters the
 * conversation history, which keeps attachments available for follow-up
 * questions while the transcript shows the typed text alone. Images are not
 * included here; they travel as image parts on the same message.
 */
export function composeMessage(
  text: string,
  attachments: Attachment[],
): string {
  const blocks = attachments
    .filter((file): file is TextAttachment => file.kind === 'text')
    .map(
      file =>
        `<${BLOCK_OPEN} name="${file.name}">\n${file.text}\n</${BLOCK_OPEN}>`,
    );
  return [text, ...blocks].filter(Boolean).join('\n\n');
}

/** The image parts of one message, in protocol shape */
export function attachmentImages(attachments: Attachment[]): ProtocolImage[] {
  return attachments
    .filter((file): file is ImageAttachment => file.kind === 'image')
    .map(file => ({
      media_type: file.mediaType,
      data: file.data,
      name: file.name,
    }));
}

/**
 * Whether sending these images would exceed what the gateway accepts.
 *
 * The gateway sums image payloads across the whole replayed history, and a
 * rejected turn stays in that history, so an oversized message would make
 * every later turn fail the same way. Refusing before the message is
 * recorded keeps the conversation usable.
 */
export function exceedsImageBudget(
  history: ProtocolMessage[],
  adding: ProtocolImage[],
): boolean {
  const size = (images: ProtocolImage[] | undefined) =>
    (images || []).reduce((total, image) => total + image.data.length, 0);
  const already = history.reduce(
    (total, message) => total + size(message.images),
    0,
  );
  return already + size(adding) > MAX_TOTAL_IMAGE_BASE64_CHARS;
}

/** The transcript view of a set of attachments */
export function attachmentRefs(attachments: Attachment[]): AttachmentRef[] {
  return attachments.map(file =>
    file.kind === 'image'
      ? { name: file.name, preview: file.preview }
      : { name: file.name, truncated: file.truncated },
  );
}
