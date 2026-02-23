import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DocumentChunk } from './entities/document-chunk.entity';
import { AzureSearchService } from './azure-search.service';

export interface ChunkResult {
  id: string;
  content: string;
  section_title: string | null;
  filename: string;
  doc_type: string;
  score: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    private readonly dataSource: DataSource,
    private readonly azureSearch: AzureSearchService,
  ) {}

  /**
   * Ensure pg_trgm extension is available (idempotent).
   * Called once at startup from the module.
   */
  async ensureExtensions(): Promise<void> {
    try {
      await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      this.logger.log('pg_trgm extension ready');
    } catch (err) {
      this.logger.warn('Could not create pg_trgm extension (may need superuser): ' + err);
    }
  }

  /**
   * Ensure tsvector + trgm indexes exist on document_chunks.
   * Called after TypeORM sync creates the table.
   */
  async ensureIndexes(): Promise<void> {
    try {
      // Full-text search index
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_search
        ON document_chunks USING GIN (to_tsvector('french', content))
      `);
      // Trigram index for fallback fuzzy search
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_trgm
        ON document_chunks USING GIN (content gin_trgm_ops)
      `);
      this.logger.log('RAG indexes ready');
    } catch (err) {
      this.logger.warn('Could not create RAG indexes: ' + err);
    }
  }

  // ---- Chunking ----

  /**
   * Split text into overlapping chunks, respecting paragraph/sentence boundaries.
   * Mirrors the ReponsIA approach: ~1500 chars, 200 overlap.
   */
  chunkText(
    text: string,
    maxChars = 1500,
    overlap = 200,
  ): Array<{ content: string; startChar: number; endChar: number }> {
    // Normalize whitespace
    const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
    if (!normalized) return [];

    const chunks: Array<{ content: string; startChar: number; endChar: number }> = [];
    let pos = 0;

    while (pos < normalized.length) {
      let end = Math.min(pos + maxChars, normalized.length);

      // If we're not at the end, try to break at a good boundary
      if (end < normalized.length) {
        // Try paragraph break first
        const paraBreak = normalized.lastIndexOf('\n\n', end);
        if (paraBreak > pos + maxChars * 0.3) {
          end = paraBreak + 2; // include the double newline
        } else {
          // Try sentence break
          const sentenceBreak = Math.max(
            normalized.lastIndexOf('. ', end),
            normalized.lastIndexOf('.\n', end),
            normalized.lastIndexOf(';\n', end),
            normalized.lastIndexOf(':\n', end),
          );
          if (sentenceBreak > pos + maxChars * 0.3) {
            end = sentenceBreak + 1;
          }
        }
      }

      const chunk = normalized.slice(pos, end).trim();
      if (chunk.length >= 50) {
        chunks.push({ content: chunk, startChar: pos, endChar: end });
      }

      // Move forward, but overlap by `overlap` chars
      pos = end - overlap;
      if (pos <= chunks[chunks.length - 1]?.startChar) {
        // Prevent infinite loop
        pos = end;
      }
    }

    return chunks;
  }

  /**
   * Chunk a document's OCR text and store in document_chunks.
   * Deletes existing chunks for that document first (idempotent).
   */
  async chunkDocument(
    documentId: string,
    dossierId: string,
    ocrText: string,
    filename: string,
    docType = 'other',
  ): Promise<number> {
    // Remove old chunks for this document
    const oldChunks = await this.chunkRepo.find({
      where: { document_id: documentId },
      select: ['id'],
    });
    if (oldChunks.length > 0) {
      const oldIds = oldChunks.map((c) => c.id);
      await this.chunkRepo.delete({ document_id: documentId });
      // Also remove from Azure AI Search index
      this.azureSearch.deleteDocumentChunks(oldIds).catch((err) => {
        this.logger.warn(`Failed to delete old chunks from search index: ${err.message}`);
      });
    }

    const rawChunks = this.chunkText(ocrText);
    if (rawChunks.length === 0) {
      this.logger.warn(`No chunks generated for document ${documentId} (${filename})`);
      return 0;
    }

    const entities = rawChunks.map((c) =>
      this.chunkRepo.create({
        dossier_id: dossierId,
        document_id: documentId,
        content: c.content,
        start_char: c.startChar,
        end_char: c.endChar,
      }),
    );

    await this.chunkRepo.save(entities);

    // Push to Azure AI Search index (fire-and-forget)
    this.azureSearch
      .indexChunks(
        entities.map((e) => ({
          id: e.id,
          content: e.content,
          dossierId,
          documentId,
          filename,
          docType,
        })),
      )
      .catch((err) => {
        this.logger.warn(`Failed to index chunks in Azure AI Search: ${err.message}`);
      });

    this.logger.log(
      `Chunked document ${filename}: ${entities.length} chunks (${ocrText.length} chars)`,
    );
    return entities.length;
  }

  // ---- Retrieval ----

  /**
   * Semantic search via Azure AI Search (preferred), with PostgreSQL FTS fallback.
   * Returns top-k results scoped to a dossier.
   * If documentIds is provided, only chunks from those documents are returned.
   */
  async search(
    query: string,
    dossierId: string,
    topK = 10,
    documentIds?: string[],
  ): Promise<ChunkResult[]> {
    // When specific documentIds are requested, use Postgres directly (supports native filtering)
    if (documentIds?.length) {
      return this.searchPostgres(query, dossierId, topK, documentIds);
    }

    // Try Azure AI Search first (semantic ranking)
    const azureConfigured = await this.azureSearch.isConfigured();
    if (azureConfigured) {
      try {
        const results = await this.azureSearch.search(query, dossierId, topK);
        if (results.length > 0) {
          return results;
        }
        this.logger.warn('Azure AI Search returned 0 results, falling back to PostgreSQL FTS');
      } catch (err: any) {
        this.logger.warn(`Azure AI Search failed, falling back to PostgreSQL FTS: ${err.message}`);
      }
    }

    // Fallback: PostgreSQL full-text + trigram
    return this.searchPostgres(query, dossierId, topK);
  }

  /** PostgreSQL FTS + trigram fallback search */
  private async searchPostgres(
    query: string,
    dossierId: string,
    topK: number,
    documentIds?: string[],
  ): Promise<ChunkResult[]> {
    const words = query
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[^a-zA-ZÀ-ÿ0-9]/g, ''))
      .filter(Boolean);

    if (words.length === 0) return [];

    const tsQuery = words.join(' | ');
    const docFilter = documentIds?.length
      ? `AND c.document_id = ANY($4::uuid[])`
      : '';
    const params = documentIds?.length
      ? [tsQuery, dossierId, topK, documentIds]
      : [tsQuery, dossierId, topK];

    // Stage 1: Full-text search
    const fullTextResults: ChunkResult[] = await this.dataSource.query(
      `SELECT c.id, c.content, c.section_title,
              d.filename, d.doc_type,
              ts_rank_cd(to_tsvector('french', c.content), to_tsquery('french', $1)) AS score
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.dossier_id = $2
         AND to_tsvector('french', c.content) @@ to_tsquery('french', $1)
         ${docFilter}
       ORDER BY score DESC
       LIMIT $3`,
      params,
    );

    if (fullTextResults.length >= topK) {
      return fullTextResults;
    }

    // Stage 2: Trigram fallback for remaining slots
    const remaining = topK - fullTextResults.length;
    const excludeIds = fullTextResults.map((r) => r.id);

    let trigramResults: ChunkResult[] = [];
    try {
      const baseIdx = documentIds?.length ? 5 : 4;
      if (excludeIds.length > 0) {
        const trigramDocFilter = documentIds?.length
          ? `AND c.document_id = ANY($${baseIdx}::uuid[])`
          : '';
        const trigramParams = documentIds?.length
          ? [query, dossierId, excludeIds, remaining, documentIds]
          : [query, dossierId, excludeIds, remaining];

        trigramResults = await this.dataSource.query(
          `SELECT c.id, c.content, c.section_title,
                  d.filename, d.doc_type,
                  similarity(c.content, $1) AS score
           FROM document_chunks c
           JOIN documents d ON d.id = c.document_id
           WHERE c.dossier_id = $2
             AND c.id != ALL($3::uuid[])
             AND similarity(c.content, $1) > 0.05
             ${trigramDocFilter}
           ORDER BY score DESC
           LIMIT $4`,
          trigramParams,
        );
      } else {
        const trigramDocFilter = documentIds?.length
          ? `AND c.document_id = ANY($4::uuid[])`
          : '';
        const trigramParams = documentIds?.length
          ? [query, dossierId, remaining, documentIds]
          : [query, dossierId, remaining];

        trigramResults = await this.dataSource.query(
          `SELECT c.id, c.content, c.section_title,
                  d.filename, d.doc_type,
                  similarity(c.content, $1) AS score
           FROM document_chunks c
           JOIN documents d ON d.id = c.document_id
           WHERE c.dossier_id = $2
             AND similarity(c.content, $1) > 0.05
             ${trigramDocFilter}
           ORDER BY score DESC
           LIMIT $3`,
          trigramParams,
        );
      }
    } catch (err) {
      this.logger.warn('Trigram search failed (pg_trgm may not be available): ' + err);
    }

    return [...fullTextResults, ...trigramResults];
  }

  /**
   * Get chunk count for a dossier (for UI indicators).
   */
  async getChunkCount(dossierId: string): Promise<number> {
    return this.chunkRepo.count({ where: { dossier_id: dossierId } });
  }
}
