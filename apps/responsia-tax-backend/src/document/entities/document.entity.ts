import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dossier } from '../../dossier/entities/dossier.entity';
import { Round } from '../../round/entities/round.entity';

export enum DocType {
  QUESTION_DR = 'question_dr',
  SUPPORT = 'support',
  RESPONSE_DRAFT = 'response_draft',
  OTHER = 'other',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'dossier_id' })
  dossier_id!: string;

  @Column({ type: 'uuid', name: 'round_id', nullable: true })
  round_id!: string | null;

  @Column({
    type: 'enum',
    enum: DocType,
    name: 'doc_type',
  })
  doc_type!: DocType;

  @Column({ type: 'varchar', length: 500 })
  filename!: string;

  @Column({ type: 'varchar', length: 1000, name: 'file_path' })
  file_path!: string;

  @Column({ type: 'varchar', length: 255, name: 'mime_type' })
  mime_type!: string;

  @Column({ type: 'int', name: 'file_size' })
  file_size!: number;

  @Column({ type: 'text', name: 'ocr_text', nullable: true })
  ocr_text!: string | null;

  @Column({ type: 'jsonb', name: 'ocr_pages_json', nullable: true })
  ocr_pages_json!: Record<string, unknown>[] | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @ManyToOne(() => Dossier, (dossier) => dossier.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dossier_id' })
  dossier!: Dossier;

  @ManyToOne(() => Round, (round) => round.documents, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'round_id' })
  round!: Round | null;
}
