import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity';

@Entity('document_chunks')
@Index('idx_chunks_dossier', ['dossier_id'])
export class DocumentChunk {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ type: 'uuid', name: 'dossier_id' })
  dossier_id!: string;

  @Column({ type: 'uuid', name: 'document_id' })
  document_id!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'section_title' })
  section_title!: string | null;

  @Column({ type: 'int', name: 'start_char' })
  start_char!: number;

  @Column({ type: 'int', name: 'end_char' })
  end_char!: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Document;
}
