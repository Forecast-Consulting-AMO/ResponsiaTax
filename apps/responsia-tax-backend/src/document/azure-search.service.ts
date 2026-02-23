import { Injectable, Logger } from '@nestjs/common';
import { SettingService } from '../setting/setting.service';

// Use runtime require to bypass webpack bundling
declare const __non_webpack_require__: NodeRequire | undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtimeRequire: NodeRequire =
  typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__
    : require;

const INDEX_NAME = 'responsia-tax-chunks';

/** Fields in our Azure AI Search index */
interface ChunkIndexDoc {
  chunk_id: string;
  content: string;
  dossier_id: string;
  document_id: string;
  filename: string;
  doc_type: string;
  section_title: string;
}

export interface SemanticSearchResult {
  id: string;
  content: string;
  section_title: string | null;
  filename: string;
  doc_type: string;
  score: number;
}

@Injectable()
export class AzureSearchService {
  private readonly logger = new Logger(AzureSearchService.name);
  private indexReady = false;

  constructor(private readonly settingService: SettingService) {}

  /** Check if Azure AI Search is configured */
  async isConfigured(): Promise<boolean> {
    const endpoint = await this.settingService.get('azure_search_endpoint');
    const key = await this.settingService.get('azure_search_key');
    return !!(endpoint && key);
  }

  /** Get or create the search index client */
  private async getClients(): Promise<{
    searchClient: any;
    indexClient: any;
  }> {
    const endpoint = await this.settingService.get('azure_search_endpoint');
    const key = await this.settingService.get('azure_search_key');

    if (!endpoint || !key) {
      throw new Error(
        'Azure AI Search not configured. Set azure_search_endpoint and azure_search_key in Settings.',
      );
    }

    const {
      SearchClient,
      SearchIndexClient,
      AzureKeyCredential,
    } = runtimeRequire('@azure/search-documents');

    const credential = new AzureKeyCredential(key);
    const searchClient = new SearchClient(endpoint, INDEX_NAME, credential);
    const indexClient = new SearchIndexClient(endpoint, credential);

    return { searchClient, indexClient };
  }

  /** Create the index with semantic configuration if it doesn't exist */
  async ensureIndex(): Promise<void> {
    if (this.indexReady) return;

    try {
      const configured = await this.isConfigured();
      if (!configured) return;

      const { indexClient } = await this.getClients();

      const index = {
        name: INDEX_NAME,
        fields: [
          {
            name: 'chunk_id',
            type: 'Edm.String',
            key: true,
            filterable: true,
          },
          {
            name: 'content',
            type: 'Edm.String',
            searchable: true,
            analyzerName: 'fr.microsoft',
          },
          {
            name: 'dossier_id',
            type: 'Edm.String',
            filterable: true,
          },
          {
            name: 'document_id',
            type: 'Edm.String',
            filterable: true,
          },
          {
            name: 'filename',
            type: 'Edm.String',
            searchable: true,
            filterable: true,
          },
          {
            name: 'doc_type',
            type: 'Edm.String',
            filterable: true,
          },
          {
            name: 'section_title',
            type: 'Edm.String',
            searchable: true,
          },
        ],
        semanticSearch: {
          configurations: [
            {
              name: 'default',
              prioritizedFields: {
                contentFields: [{ name: 'content' }],
                titleFields: [{ name: 'filename' }],
              },
            },
          ],
          defaultConfiguration: 'default',
        },
      };

      await indexClient.createOrUpdateIndex(index);
      this.indexReady = true;
      this.logger.log(`Azure AI Search index '${INDEX_NAME}' ready`);
    } catch (err: any) {
      this.logger.warn(`Could not ensure Azure AI Search index: ${err.message}`);
    }
  }

  /** Push chunks to the Azure AI Search index */
  async indexChunks(
    chunks: Array<{
      id: string;
      content: string;
      dossierId: string;
      documentId: string;
      filename: string;
      docType: string;
      sectionTitle?: string;
    }>,
  ): Promise<number> {
    const configured = await this.isConfigured();
    if (!configured) return 0;

    await this.ensureIndex();
    const { searchClient } = await this.getClients();

    const docs: ChunkIndexDoc[] = chunks.map((c) => ({
      chunk_id: c.id,
      content: c.content,
      dossier_id: c.dossierId,
      document_id: c.documentId,
      filename: c.filename,
      doc_type: c.docType,
      section_title: c.sectionTitle || '',
    }));

    // Upload in batches of 100
    let indexed = 0;
    for (let i = 0; i < docs.length; i += 100) {
      const batch = docs.slice(i, i + 100);
      await searchClient.mergeOrUploadDocuments(batch);
      indexed += batch.length;
    }

    this.logger.log(
      `Indexed ${indexed} chunks for document ${chunks[0]?.filename}`,
    );
    return indexed;
  }

  /** Delete chunks for a document from the index */
  async deleteDocumentChunks(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    const configured = await this.isConfigured();
    if (!configured) return;

    const { searchClient } = await this.getClients();

    const docsToDelete = chunkIds.map((id) => ({ chunk_id: id }));
    for (let i = 0; i < docsToDelete.length; i += 100) {
      const batch = docsToDelete.slice(i, i + 100);
      await searchClient.deleteDocuments(batch);
    }
  }

  /**
   * Semantic search: uses Azure AI Search's built-in semantic ranker
   * to find the most relevant chunks based on meaning, not just keywords.
   */
  async search(
    query: string,
    dossierId: string,
    topK = 10,
  ): Promise<SemanticSearchResult[]> {
    const configured = await this.isConfigured();
    if (!configured) return [];

    await this.ensureIndex();
    const { searchClient } = await this.getClients();

    const results: SemanticSearchResult[] = [];

    const searchResults = await searchClient.search(query, {
      filter: `dossier_id eq '${dossierId}'`,
      top: topK,
      queryType: 'semantic',
      semanticSearchOptions: {
        configurationName: 'default',
      },
    });

    for await (const result of searchResults.results) {
      const doc = result.document as ChunkIndexDoc;
      results.push({
        id: doc.chunk_id,
        content: doc.content,
        section_title: doc.section_title || null,
        filename: doc.filename,
        doc_type: doc.doc_type,
        score: result.score ?? 0,
      });
    }

    this.logger.log(
      `Azure AI Search: ${results.length} results for query (${query.substring(0, 60)}...)`,
    );
    return results;
  }
}
