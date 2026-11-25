import crypto from 'crypto';

export class CrmChunker {
  constructor(options = {}) {
    // Configurable chunk parameters
    this.maxChunkSize = options.maxChunkSize || 900;
    this.chunkOverlap = options.chunkOverlap || 120;
    this.minChunkSize = options.minChunkSize || 100;
  }

  /**
   * Split document into logical markdown sections (by ## or ### headers)
   */
  splitByHeaders(content) {
    const lines = content.split('\n');
    const sections = [];
    let currentHeader = 'Introduction';
    let currentLines = [];

    for (const line of lines) {
      if (/^#{1,4}\s+/.test(line)) {
        if (currentLines.length > 0) {
          sections.push({
            header: currentHeader,
            text: currentLines.join('\n').trim()
          });
          currentLines = [];
        }
        currentHeader = line.replace(/^#{1,4}\s+/, '').trim();
      }
      currentLines.push(line);
    }

    if (currentLines.length > 0) {
      sections.push({
        header: currentHeader,
        text: currentLines.join('\n').trim()
      });
    }

    return sections;
  }

  /**
   * Sub-chunk a large text block while preserving paragraphs, tables, and sentence boundaries
   */
  subdivideText(text, header) {
    if (text.length <= this.maxChunkSize) {
      return [text];
    }

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let current = '';

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;

      if ((current + '\n\n' + trimmed).length <= this.maxChunkSize) {
        current = current ? `${current}\n\n${trimmed}` : trimmed;
      } else {
        if (current.length >= this.minChunkSize) {
          chunks.push(current);
          // Overlap: retain last sentence or portion
          const words = current.split(/\s+/);
          const overlapText = words.slice(-20).join(' ');
          current = overlapText ? `${overlapText}\n\n${trimmed}` : trimmed;
        } else {
          // Paragraph itself is very long, split by sentences or lines
          const subparts = trimmed.split(/(?<=[.!?])\s+|\n/);
          for (const sp of subparts) {
            if ((current + ' ' + sp).length <= this.maxChunkSize) {
              current = current ? `${current} ${sp}` : sp;
            } else {
              if (current.length >= this.minChunkSize) chunks.push(current);
              current = sp;
            }
          }
        }
      }
    }

    if (current && current.trim().length >= this.minChunkSize) {
      chunks.push(current.trim());
    }

    return chunks;
  }

  /**
   * Chunk an individual document into structured, metadata-rich chunks
   */
  chunkDocument(doc) {
    const sections = this.splitByHeaders(doc.content);
    const chunks = [];
    let chunkIndex = 0;

    for (const sec of sections) {
      const rawChunks = this.subdivideText(sec.text, sec.header);

      for (const piece of rawChunks) {
        if (!piece || piece.trim().length < this.minChunkSize) continue;

        // Ensure header context is present in the chunk text for strong semantic retrieval
        let enrichedText = piece;
        if (!piece.startsWith('#') && sec.header && sec.header !== 'Introduction') {
          enrichedText = `[Section: ${sec.header}]\n${piece}`;
        }

        const chunkId = `crm_chunk_${crypto.createHash('md5').update(`${doc.id}_${chunkIndex}_${enrichedText.slice(0, 30)}`).digest('hex').slice(0, 16)}`;

        chunks.push({
          id: chunkId,
          documentId: doc.id,
          chunkIndex,
          content: enrichedText,
          contentHash: crypto.createHash('sha256').update(enrichedText).digest('hex'),
          header: sec.header,
          metadata: {
            ...doc.metadata,
            chunk_id: chunkId,
            chunk_index: chunkIndex,
            section_header: sec.header,
            source_reference: doc.metadata.source_reference,
            char_count: enrichedText.length
          }
        });

        chunkIndex++;
      }
    }

    return chunks;
  }

  /**
   * Process an entire collection of documents into chunks
   */
  chunkAllDocuments(documents) {
    const allChunks = [];
    for (const doc of documents) {
      const chunks = this.chunkDocument(doc);
      allChunks.push(...chunks);
    }
    return allChunks;
  }
}

