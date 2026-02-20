/// <reference types="multer" />
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocType } from './entities/document.entity';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentService {
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Document)
    private readonly docRepo: Repository<Document>,
  ) {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(
    dossierId: string,
    file: Express.Multer.File,
    docType: DocType,
    roundId?: string,
  ): Promise<Document> {
    // Build a unique filename with timestamp prefix
    const timestamp = Date.now();
    const safeFilename = `${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(this.uploadDir, dossierId, safeFilename);

    // Ensure dossier subdirectory exists
    const dossierDir = path.join(this.uploadDir, dossierId);
    if (!fs.existsSync(dossierDir)) {
      fs.mkdirSync(dossierDir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, file.buffer);

    const doc = this.docRepo.create({
      dossier_id: dossierId,
      round_id: roundId || null,
      doc_type: docType,
      filename: file.originalname,
      file_path: filePath,
      mime_type: file.mimetype,
      file_size: file.size,
    });

    return this.docRepo.save(doc);
  }

  async findAllByDossier(
    dossierId: string,
    roundId?: string,
    docType?: DocType,
  ): Promise<Document[]> {
    const where: Record<string, unknown> = { dossier_id: dossierId };
    if (roundId) where['round_id'] = roundId;
    if (docType) where['doc_type'] = docType;

    return this.docRepo.find({
      where,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Document> {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return doc;
  }

  async remove(id: string): Promise<void> {
    const doc = await this.findOne(id);
    // Remove physical file
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }
    await this.docRepo.remove(doc);
  }

  async updateOcr(id: string, ocrText: string, ocrPagesJson?: Record<string, unknown>[]): Promise<Document> {
    const doc = await this.findOne(id);
    doc.ocr_text = ocrText;
    if (ocrPagesJson) {
      doc.ocr_pages_json = ocrPagesJson;
    }
    return this.docRepo.save(doc);
  }

  getFilePath(doc: Document): string {
    if (!fs.existsSync(doc.file_path)) {
      throw new NotFoundException(`File not found on disk: ${doc.filename}`);
    }
    return doc.file_path;
  }
}
