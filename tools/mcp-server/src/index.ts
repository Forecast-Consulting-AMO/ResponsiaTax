#!/usr/bin/env node
/**
 * ResponsiaTax MCP Server
 *
 * Exposes tax audit dossier management, document OCR/RAG search,
 * LLM chat, and DOCX export as MCP tools for Claude Desktop/Code.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ResponsiaTaxClient } from './api-client.js';

// ---- Configuration ----

const BASE_URL = process.env.RESPONSIA_TAX_URL || 'https://responsia-tax.azurewebsites.net';
const client = new ResponsiaTaxClient(BASE_URL);

const server = new McpServer({
  name: 'responsia-tax',
  version: '1.0.0',
});

// ---- Helper ----

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] };
}

function error(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true as const };
}

// ---- Tools ----

// 1. list_dossiers
server.tool(
  'list_dossiers',
  'List all tax audit dossiers. Returns id, name, company, status, tax year, and counts.',
  { status: z.enum(['open', 'in_progress', 'completed', 'closed']).optional().describe('Filter by status') },
  async ({ status }) => {
    try {
      const result = await client.listDossiers(status);
      const lines = result.data.map((d) =>
        `- **${d.name}** (${d.company_name}) [${d.status}] — ${d.tax_type} ${d.tax_year} | ${d.rounds_count ?? '?'} rounds, ${d.documents_count ?? '?'} docs | id: ${d.id}`,
      );
      return text(`Found ${result.total} dossier(s):\n\n${lines.join('\n')}`);
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 2. get_dossier
server.tool(
  'get_dossier',
  'Get full details of a dossier including its rounds and documents.',
  { dossier_id: z.string().uuid().describe('Dossier UUID') },
  async ({ dossier_id }) => {
    try {
      const [dossier, rounds, docs] = await Promise.all([
        client.getDossier(dossier_id),
        client.listRounds(dossier_id),
        client.listDocuments(dossier_id),
      ]);

      const roundLines = rounds.map((r) =>
        `  - Round ${r.round_number} [${r.status}] — received: ${r.received_date ?? 'N/A'}, deadline: ${r.deadline ?? 'N/A'} | id: ${r.id}`,
      );
      const docLines = docs.map((d) =>
        `  - ${d.filename} (${d.doc_type}) — ${d.file_size} bytes, OCR: ${d.ocr_text ? 'yes' : 'no'} | id: ${d.id}`,
      );

      return text([
        `# ${dossier.name}`,
        `Company: ${dossier.company_name} | Tax: ${dossier.tax_type} ${dossier.tax_year} | Status: ${dossier.status}`,
        dossier.reference ? `Reference: ${dossier.reference}` : '',
        dossier.notes ? `Notes: ${dossier.notes}` : '',
        '',
        `## Rounds (${rounds.length})`,
        ...roundLines,
        '',
        `## Documents (${docs.length})`,
        ...docLines,
      ].filter(Boolean).join('\n'));
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 3. list_questions
server.tool(
  'list_questions',
  'List all questions for a round, with their response status.',
  { round_id: z.string().uuid().describe('Round UUID') },
  async ({ round_id }) => {
    try {
      const questions = await client.listQuestions(round_id);
      if (questions.length === 0) return text('No questions found for this round.');

      const lines = questions.map((q) => {
        const hasResponse = q.response_text ? 'has response' : 'no response';
        const preview = q.question_text.length > 120
          ? q.question_text.slice(0, 120) + '...'
          : q.question_text;
        return `- **Q${q.question_number}** [${q.status}] (${hasResponse}) — ${preview} | id: ${q.id}`;
      });
      return text(`${questions.length} question(s):\n\n${lines.join('\n')}`);
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 4. get_question
server.tool(
  'get_question',
  'Get a question with its full text, current response, and chat history.',
  { question_id: z.string().uuid().describe('Question UUID') },
  async ({ question_id }) => {
    try {
      const [question, messages] = await Promise.all([
        client.getQuestion(question_id),
        client.getMessages(question_id),
      ]);

      const parts = [
        `# Question ${question.question_number} [${question.status}]`,
        '',
        '## Question Text',
        question.question_text,
        '',
        '## Current Response',
        question.response_text || '*(no response yet)*',
      ];

      if (question.notes) {
        parts.push('', '## Notes', question.notes);
      }

      if (messages.length > 0) {
        parts.push('', `## Chat History (${messages.length} messages)`);
        for (const m of messages) {
          const role = m.role.toUpperCase();
          const preview = m.content.length > 500 ? m.content.slice(0, 500) + '...' : m.content;
          parts.push(`\n**[${role}]** ${m.model ? `(${m.model})` : ''}\n${preview}`);
        }
      }

      return text(parts.join('\n'));
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 5. upload_document
server.tool(
  'upload_document',
  'Upload a file to a dossier. Triggers automatic OCR and RAG chunking in the background. Supported: PDF, DOCX, XLSX, PNG, JPG, TIFF.',
  {
    dossier_id: z.string().uuid().describe('Dossier UUID to upload into'),
    file_path: z.string().describe('Absolute path to the file on disk'),
    doc_type: z.enum(['question_dr', 'support', 'response_draft', 'other']).default('support').describe('Document type classification'),
    round_id: z.string().uuid().optional().describe('Optional round UUID to associate the document with'),
  },
  async ({ dossier_id, file_path, doc_type, round_id }) => {
    try {
      const doc = await client.uploadDocument(dossier_id, file_path, doc_type, round_id);
      return text(
        `Uploaded **${doc.filename}** (${doc.doc_type}, ${doc.file_size} bytes).\n` +
        `Document id: ${doc.id}\n` +
        `OCR and RAG chunking are running in the background. Use \`search_documents\` after a few seconds to verify.`,
      );
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 6. search_documents
server.tool(
  'search_documents',
  'Search document chunks using full-text search and trigram matching (RAG). Returns the most relevant excerpts from uploaded documents.',
  {
    dossier_id: z.string().uuid().describe('Dossier UUID to search within'),
    query: z.string().min(1).describe('Search query (natural language or keywords)'),
    top_k: z.number().int().min(1).max(50).default(10).describe('Number of results to return'),
    document_ids: z.array(z.string().uuid()).optional().describe('Optional: restrict search to specific document UUIDs'),
  },
  async ({ dossier_id, query, top_k, document_ids }) => {
    try {
      const results = await client.searchChunks(dossier_id, query, top_k, document_ids);
      if (results.length === 0) return text('No matching document chunks found.');

      const lines = results.map((r, i) => {
        const preview = r.content.length > 400 ? r.content.slice(0, 400) + '...' : r.content;
        return `### Result ${i + 1} — ${r.filename} (${r.doc_type}) [score: ${Number(r.score).toFixed(3)}]\n${preview}`;
      });
      return text(`Found ${results.length} relevant chunk(s):\n\n${lines.join('\n\n')}`);
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 7. chat_question
server.tool(
  'chat_question',
  'Send a message to the LLM for a specific question. The system automatically injects RAG context from uploaded documents, previous rounds, and the question text. Returns the LLM response.',
  {
    question_id: z.string().uuid().describe('Question UUID'),
    message: z.string().min(1).describe('Your message to the LLM'),
    model: z.string().default('openai/gpt-4.1').describe('LLM model id (e.g. openai/gpt-4.1, anthropic/claude-sonnet-4-6)'),
    auto_apply: z.boolean().default(false).describe('If true, automatically save the LLM response as the question response'),
    document_ids: z.array(z.string().uuid()).optional().describe('Optional: restrict RAG to specific documents'),
  },
  async ({ question_id, message, model, auto_apply, document_ids }) => {
    try {
      const response = await client.chat(question_id, message, model, {
        autoApplyToResponse: auto_apply,
        documentIds: document_ids,
      });

      const parts = [
        `**Model:** ${response.model}`,
        `**Tokens:** ${response.tokensIn ?? '?'} in / ${response.tokensOut ?? '?'} out`,
        auto_apply ? '*(Response automatically saved to the question)*' : '',
        '',
        response.content,
      ];
      return text(parts.filter(Boolean).join('\n'));
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 8. save_response
server.tool(
  'save_response',
  'Save or update the response text for a question. Supports Markdown formatting.',
  {
    question_id: z.string().uuid().describe('Question UUID'),
    response_text: z.string().describe('The response text (Markdown supported)'),
    status: z.enum(['pending', 'drafting', 'reviewed', 'approved']).optional().describe('Optional: update the question status'),
  },
  async ({ question_id, response_text, status }) => {
    try {
      const data: { response_text?: string; status?: string } = { response_text };
      if (status) data.status = status;
      const updated = await client.updateQuestion(question_id, data);
      return text(
        `Saved response for Q${updated.question_number} [${updated.status}] — ${response_text.length} characters.`,
      );
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 9. export_round
server.tool(
  'export_round',
  'Export a round as a formatted DOCX document with all questions and responses.',
  {
    round_id: z.string().uuid().describe('Round UUID to export'),
    output_path: z.string().describe('Absolute file path to save the .docx file'),
  },
  async ({ round_id, output_path }) => {
    try {
      const fs = await import('node:fs');
      const buffer = await client.exportRound(round_id);
      fs.writeFileSync(output_path, buffer);
      return text(`Exported round to **${output_path}** (${buffer.length} bytes).`);
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// 10. list_models
server.tool(
  'list_models',
  'List all available LLM models for chat (OpenAI, Anthropic, Azure).',
  {},
  async () => {
    try {
      const models = await client.listModels();
      const lines = models.map((m) => `- **${m.name}** (${m.provider}) — id: \`${m.id}\``);
      return text(`${models.length} models available:\n\n${lines.join('\n')}`);
    } catch (e: any) {
      return error(e.message);
    }
  },
);

// ---- Start ----

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ResponsiaTax MCP server connected (API: ${BASE_URL})`);
}

main().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});
