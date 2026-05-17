import { describe, expect, it } from 'vitest'

import {
  getAttachmentFileSignature,
  mergeUniqueComposerAttachments,
  type ChatComposerAttachment,
} from './chat-composer'

describe('chat-composer attachments', () => {
  it('uses a stable file signature for duplicate paste events', () => {
    const fileLike = {
      name: 'screenshot.png',
      size: 1234,
      lastModified: 9876,
      type: 'image/png',
    } as File

    expect(getAttachmentFileSignature(fileLike)).toBe('screenshot.png:1234:9876:image/png')
  })

  it('dedupes image attachments with different IDs but identical image data', () => {
    const first: ChatComposerAttachment = {
      id: 'first',
      name: 'screenshot.png',
      contentType: 'image/png',
      size: 1234,
      dataUrl: 'data:image/png;base64,abc123',
      previewUrl: 'data:image/png;base64,abc123',
      kind: 'image',
    }
    const duplicate: ChatComposerAttachment = {
      ...first,
      id: 'second',
    }
    const other: ChatComposerAttachment = {
      ...first,
      id: 'third',
      dataUrl: 'data:image/png;base64,different',
      previewUrl: 'data:image/png;base64,different',
    }

    expect(mergeUniqueComposerAttachments([first], [duplicate, other])).toEqual([
      first,
      other,
    ])
  })
})
